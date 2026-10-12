import { sessionUser } from "@/lib/auth-server";
import { jsonError } from "@/lib/cabinet-server";
export async function requireAdmin(request: Request) {
  const user = await sessionUser(request);
  if (!user) return { response: jsonError("请先登录。", 401) };
  if (user.role !== "admin") return { response: jsonError("仅系统管理员可访问。", 403) };
  return { user };
}
export const adminHeaders = { "Cache-Control": "private, no-store" };
