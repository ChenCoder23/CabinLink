import { clearSessionCookie, sessionUser } from "@/lib/auth-server";
import { workbenchUser } from "@/lib/personal-server";
import { hashToken, jsonError, requireStorage } from "@/lib/cabinet-server";

export async function GET(request: Request) { try { const user=await sessionUser(request); return Response.json({ user: user?{...user,canWorkbench:!!await workbenchUser(request)}:null }, { headers: { "Cache-Control": "private, no-store" } }); } catch { return jsonError("读取登录状态失败。", 500); } }
export async function DELETE(request: Request) { try { const token = request.headers.get("cookie")?.match(/(?:^|;\s*)cabinlink_session=([^;]+)/)?.[1]; if (token) { const { db } = requireStorage(); await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await hashToken(token)).run(); } return new Response(null, { status: 204, headers: { "Set-Cookie": clearSessionCookie(request) } }); } catch { return jsonError("退出登录失败。", 500); } }
