import { hashToken, newToken, requireStorage, resolveCabinet, tokenFrom, type Role } from "@/lib/cabinet-server";

const SESSION_DAYS = 30;
export type SessionUser = { id: string; username: string };

function hex(bytes: ArrayBuffer) { return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join(""); }
function cookieValue(request: Request, name: string) { return request.headers.get("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1) ?? ""; }
export function validUsername(value: unknown) { return typeof value === "string" && /^[A-Za-z0-9_\-\u4e00-\u9fa5]{3,32}$/.test(value); }
export function validPassword(value: unknown) { return typeof value === "string" && value.length >= 6 && value.length <= 128; }
export async function passwordHash(password: string, salt: string) { const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]); const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: 100_000 }, key, 256); return hex(bits); }
export async function sessionUser(request: Request): Promise<SessionUser | null> { const token = cookieValue(request, "cabinlink_session"); if (!token) return null; const { db } = requireStorage(); return db.prepare("SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? LIMIT 1").bind(await hashToken(token), new Date().toISOString()).first<SessionUser>(); }
export async function createSession(userId: string) { const token = newToken(); const now = new Date(); const expiresAt = new Date(now.getTime() + SESSION_DAYS * 86_400_000).toISOString(); const { db } = requireStorage(); await db.prepare("INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)").bind(crypto.randomUUID(), userId, await hashToken(token), expiresAt, now.toISOString()).run(); return { token, expiresAt }; }
export function sessionCookie(token: string) { return `cabinlink_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86_400}`; }
export function clearSessionCookie() { return "cabinlink_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"; }
export async function authorizeCabinet(request: Request, cabinetId: string, requiredRole: Role = "share") {
  const fromLink = await resolveCabinet(tokenFrom(request), requiredRole); if (fromLink?.id === cabinetId) return fromLink;
  const user = await sessionUser(request); if (!user) return null; const { db } = requireStorage();
  const cabinet = await db.prepare("SELECT id, name, quota_bytes FROM cabinets WHERE id = ? AND owner_user_id = ? AND closed_at IS NULL LIMIT 1").bind(cabinetId, user.id).first<{ id: string; name: string; quota_bytes: number }>();
  return cabinet ? { ...cabinet, closed_at: null, role: "admin" as const } : null;
}
