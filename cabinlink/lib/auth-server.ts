import { env } from "cloudflare:workers";
import { hashToken, newToken, requireStorage, resolveCabinet, tokenFrom, type Role } from "@/lib/cabinet-server";

const SESSION_DAYS = 30;
const CODE_MINUTES = 10;
const CODE_RESEND_SECONDS = 60;
const CODE_SEND_LIMIT = 5;
const CODE_ATTEMPT_LIMIT = 5;

export type SessionUser = { id: string; username: string | null; email: string | null };
type CodePurpose = "login" | "bind";
type CodeRow = { email: string; purpose: string; user_id: string | null; code_hash: string | null; expires_at: string; attempts: number; sent_at: string; window_started_at: string; sends_in_window: number };

function hex(bytes: ArrayBuffer) { return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join(""); }
function cookieValue(request: Request, name: string) { return request.headers.get("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1) ?? ""; }
export function validUsername(value: unknown) { return typeof value === "string" && /^[A-Za-z0-9_\-\u4e00-\u9fa5]{3,32}$/.test(value); }
export function validPassword(value: unknown) { return typeof value === "string" && value.length >= 6 && value.length <= 128; }
export function normalizeEmail(value: unknown) { if (typeof value !== "string") return null; const email = value.trim().toLowerCase(); return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null; }
export async function passwordHash(password: string, salt: string) { const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]); const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: 100_000 }, key, 256); return hex(bits); }
export async function sessionUser(request: Request): Promise<SessionUser | null> { const token = cookieValue(request, "cabinlink_session"); if (!token) return null; const { db } = requireStorage(); return db.prepare("SELECT u.id, u.username, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? LIMIT 1").bind(await hashToken(token), new Date().toISOString()).first<SessionUser>(); }
export async function createSession(userId: string) { const token = newToken(); const now = new Date(); const expiresAt = new Date(now.getTime() + SESSION_DAYS * 86_400_000).toISOString(); const { db } = requireStorage(); await db.prepare("INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)").bind(crypto.randomUUID(), userId, await hashToken(token), expiresAt, now.toISOString()).run(); return { token, expiresAt }; }
function requestIsSecure(request: Request) { return new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https"; }
export function publicOrigin(request: Request) { const url = new URL(request.url); if (requestIsSecure(request)) url.protocol = "https:"; return url.origin; }
export function sessionCookie(token: string, request: Request) { const secure = requestIsSecure(request) ? "; Secure" : ""; return `cabinlink_session=${token}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${SESSION_DAYS * 86_400}`; }
export function clearSessionCookie(request: Request) { const secure = requestIsSecure(request) ? "; Secure" : ""; return `cabinlink_session=; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=0`; }
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin"); if (!origin) return true;
  try {
    const source = new URL(origin); const target = new URL(request.url);
    return source.host === target.host && (source.protocol === target.protocol || (source.protocol === "https:" && target.protocol === "http:"));
  } catch { return false; }
}

export async function authorizeCabinet(request: Request, cabinetId: string, requiredRole: Role = "share") {
  const user = await sessionUser(request); if (!user) return null;
  const fromLink = await resolveCabinet(tokenFrom(request), requiredRole); if (fromLink?.id === cabinetId) return fromLink;
  const { db } = requireStorage();
  const cabinet = await db.prepare("SELECT id, name, quota_bytes FROM cabinets WHERE id = ? AND owner_user_id = ? AND closed_at IS NULL LIMIT 1").bind(cabinetId, user.id).first<{ id: string; name: string; quota_bytes: number }>();
  if (cabinet) return { ...cabinet, closed_at: null, role: "admin" as const };
  if (requiredRole === "admin") return null;
  const joined = await db.prepare("SELECT c.id, c.name, c.quota_bytes FROM cabinet_memberships m JOIN cabinets c ON c.id = m.cabinet_id WHERE m.cabinet_id = ? AND m.user_id = ? AND c.closed_at IS NULL LIMIT 1").bind(cabinetId, user.id).first<{ id: string; name: string; quota_bytes: number }>();
  return joined ? { ...joined, closed_at: null, role: "share" as const } : null;
}

export function emailConfig() {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL || !env.EMAIL_CODE_SECRET) throw new Error("邮箱登录尚未配置。");
  return { apiKey: env.RESEND_API_KEY, from: env.RESEND_FROM_EMAIL, secret: env.EMAIL_CODE_SECRET };
}
async function codeHash(email: string, purpose: CodePurpose, code: string) {
  const { secret } = emailConfig();
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${email}:${purpose}:${code}`)));
}
export async function sendEmailCode(email: string, purpose: CodePurpose, userId: string | null) {
  const { db } = requireStorage(); const { apiKey, from } = emailConfig();
  const now = new Date(); const nowIso = now.toISOString();
  const prior = await db.prepare("SELECT * FROM email_codes WHERE email = ?").bind(email).first<CodeRow>();
  if (prior && now.getTime() - Date.parse(prior.sent_at) < CODE_RESEND_SECONDS * 1000) return "rate_limited" as const;
  const withinHour = prior && now.getTime() - Date.parse(prior.window_started_at) < 3_600_000;
  if (withinHour && prior.sends_in_window >= CODE_SEND_LIMIT) return "rate_limited" as const;
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
  const digest = await codeHash(email, purpose, code);
  const expiresAt = new Date(now.getTime() + CODE_MINUTES * 60_000).toISOString();
  if (prior) {
    const result = await db.prepare("UPDATE email_codes SET purpose = ?, user_id = ?, code_hash = ?, expires_at = ?, attempts = 0, sent_at = ?, window_started_at = ?, sends_in_window = ? WHERE email = ? AND sent_at = ?").bind(purpose, userId, digest, expiresAt, nowIso, withinHour ? prior.window_started_at : nowIso, withinHour ? prior.sends_in_window + 1 : 1, email, prior.sent_at).run();
    if (!result.meta.changes) return "rate_limited" as const;
  } else {
    try { await db.prepare("INSERT INTO email_codes (email, purpose, user_id, code_hash, expires_at, attempts, sent_at, window_started_at, sends_in_window) VALUES (?, ?, ?, ?, ?, 0, ?, ?, 1)").bind(email, purpose, userId, digest, expiresAt, nowIso, nowIso).run(); }
    catch { return "rate_limited" as const; }
  }
  try {
    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [email], subject: "柜联登录验证码", text: `您的柜联验证码是 ${code}，10 分钟内有效。如非本人操作，请忽略此邮件。` }) });
    if (!response.ok) throw new Error(`Resend HTTP ${response.status}`);
    return "sent" as const;
  } catch (error) {
    console.error("发送验证码失败", error);
    await db.prepare("UPDATE email_codes SET code_hash = NULL WHERE email = ? AND code_hash = ?").bind(email, digest).run();
    return "send_failed" as const;
  }
}
export async function consumeEmailCode(email: string, purpose: CodePurpose, code: unknown, userId: string | null) {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) return false;
  const { db } = requireStorage();
  const row = await db.prepare("SELECT * FROM email_codes WHERE email = ?").bind(email).first<CodeRow>();
  if (!row || row.purpose !== purpose || row.user_id !== userId || !row.code_hash || row.expires_at <= new Date().toISOString() || row.attempts >= CODE_ATTEMPT_LIMIT) return false;
  const digest = await codeHash(email, purpose, code);
  if (digest !== row.code_hash) { await db.prepare("UPDATE email_codes SET attempts = attempts + 1 WHERE email = ? AND code_hash = ? AND attempts < ?").bind(email, row.code_hash, CODE_ATTEMPT_LIMIT).run(); return false; }
  const result = await db.prepare("UPDATE email_codes SET code_hash = NULL, attempts = ? WHERE email = ? AND code_hash = ? AND attempts < ? AND expires_at > ?").bind(CODE_ATTEMPT_LIMIT, email, row.code_hash, CODE_ATTEMPT_LIMIT, new Date().toISOString()).run();
  return Boolean(result.meta.changes);
}
