import { requireStorage } from "@/lib/cabinet-server";
// Private initial data is seeded by the deployment operator, never shipped in client or source assets.
export async function initializeWorkbench(userId: string) { const { db } = requireStorage(); await db.prepare("INSERT OR IGNORE INTO workbench_profile(user_id,introduction) VALUES(?,'')").bind(userId).run(); }
