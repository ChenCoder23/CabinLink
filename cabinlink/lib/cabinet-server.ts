import { env } from "cloudflare:workers";

export const MAX_FILE_BYTES = 1024 * 1024 * 1024;
export const CHUNK_SIZE = 10 * 1024 * 1024;
export const DEFAULT_QUOTA_BYTES = 10 * 1024 * 1024 * 1024;
export type Role = "share" | "admin";
export function jsonError(message: string, status = 400) { return Response.json({ error: message }, { status }); }
export function requireStorage() { if (!env.DB || !env.BUCKET) throw new Error("存储服务暂不可用，请稍后重试。"); return { db: env.DB, bucket: env.BUCKET }; }
function hex(bytes: ArrayBuffer) { return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join(""); }
export async function hashToken(token: string) { return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))); }
export function newToken() { const bytes = new Uint8Array(32); crypto.getRandomValues(bytes); return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", ""); }
export async function shareTokenFromAdmin(adminToken: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(adminToken), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("cabinlink/share-link/v1"));
  return btoa(String.fromCharCode(...new Uint8Array(signature))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
export async function resolveCabinet(token: string, requiredRole: Role = "share") {
  if (!token || token.length < 32) return null;
  const { db } = requireStorage(); const tokenHash = await hashToken(token);
  const result = await db.prepare("SELECT id, name, quota_bytes, closed_at, CASE WHEN admin_token_hash = ? THEN 'admin' WHEN share_token_hash = ? THEN 'share' ELSE NULL END AS role FROM cabinets WHERE admin_token_hash = ? OR share_token_hash = ? LIMIT 1").bind(tokenHash, tokenHash, tokenHash, tokenHash).first<{ id: string; name: string; quota_bytes: number; closed_at: string | null; role: Role | null }>();
  if (!result || !result.role || result.closed_at || (requiredRole === "admin" && result.role !== "admin")) return null;
  return result;
}
export function tokenFrom(request: Request) { const url = new URL(request.url); return url.searchParams.get("token") || request.headers.get("x-cabinet-token") || ""; }
export async function readJson<T>(request: Request): Promise<T> { return request.json() as Promise<T>; }
export function safeName(value: unknown, max = 120) { return typeof value === "string" ? value.trim().replace(/[\\/:*?"<>|]/g, "_").slice(0, max) : ""; }
export function fileKey(cabinetId: string, fileId: string) { return `cabinets/${cabinetId}/${fileId}`; }
export function formatContentDisposition(name: string, inline: boolean) { return `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(name)}`; }
