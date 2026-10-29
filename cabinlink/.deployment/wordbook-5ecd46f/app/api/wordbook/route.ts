import { sessionUser, sameOrigin } from "@/lib/auth-server";
import { requireStorage, jsonError } from "@/lib/cabinet-server";
import { adminHeaders } from "@/lib/admin-server";

export async function GET(request: Request) {
  try {
    const user = await sessionUser(request); if (!user) return jsonError("请先登录。",401);
    const { db } = requireStorage(); const url = new URL(request.url);
    const category = url.searchParams.get("category") || "";
    const today = new Date().toLocaleDateString("en-CA", {timeZone:"Asia/Shanghai"});
    const date = url.searchParams.get("date") || today;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || date>today) return jsonError("请选择今天或之前的日期。");
    const tag = url.searchParams.get("tag") || "";
    const [categories,tags,words,dates] = await Promise.all([
      db.prepare("SELECT * FROM word_categories ORDER BY created_at,name").all(),
      db.prepare("SELECT * FROM word_tags WHERE user_id=? ORDER BY name").bind(user.id).all(),
      db.prepare(`SELECT w.*,b.uploaded_at,b.study_date FROM word_entries w JOIN word_batches b ON b.id=w.batch_id WHERE b.category_id=? AND b.study_date<=? AND (?='' OR b.study_date=?) AND (?='' OR EXISTS(SELECT 1 FROM word_tag_links l JOIN word_tags t ON t.id=l.tag_id WHERE l.word_id=w.id AND t.id=? AND t.user_id=?)) ORDER BY b.uploaded_at DESC,w.rowid`).bind(category,today,tag,date,tag,tag,user.id).all(),
      db.prepare("SELECT DISTINCT study_date FROM word_batches WHERE category_id=? AND study_date<=? ORDER BY study_date DESC").bind(category,new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Shanghai"})).all(),
    ]);
    const links = await db.prepare("SELECT l.* FROM word_tag_links l JOIN word_tags t ON t.id=l.tag_id WHERE t.user_id=?").bind(user.id).all();
    return Response.json({categories:categories.results,tags:tags.results,words:words.results,dates:dates.results,links:links.results}, {headers:adminHeaders});
  } catch (e) { console.error(e); return jsonError("单词本读取失败。",500); }
}
export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return jsonError("请求来源无效。",403);
    const user = await sessionUser(request); if (!user) return jsonError("请先登录。",401);
    const {db} = requireStorage(); const body = await request.json() as {action?:string;name?:unknown;color?:unknown;ids?:unknown;tagId?:unknown};
    if(!body || typeof body!=="object")return jsonError("请求格式无效。");
    if(body.action === "createTag") {
      if(typeof body.name!=="string" || !body.name.trim() || body.name.trim().length>30 || typeof body.color!=="string" || !/^#[0-9a-f]{6}$/i.test(body.color)) return jsonError("请输入 1–30 字的标记名称和有效颜色。");
      await db.prepare("INSERT INTO word_tags(id,user_id,name,color) VALUES(?,?,?,?) ON CONFLICT(user_id,name) DO UPDATE SET color=excluded.color").bind(crypto.randomUUID(),user.id,body.name.trim(),body.color).run();
    } else if(body.action === "applyTag" || body.action === "removeTag") {
      if(!Array.isArray(body.ids) || !body.ids.length || body.ids.length>500 || body.ids.some((id:unknown)=>typeof id!=="string")) return jsonError("请选择 1–500 个单词。");
      if(typeof body.tagId!=="string")return jsonError("请选择标记。");
      const tag=await db.prepare("SELECT id FROM word_tags WHERE id=? AND user_id=?").bind(body.tagId,user.id).first(); if(!tag)return jsonError("标记不存在。",404);
      const ids=[...new Set<string>(body.ids as string[])];
      await db.batch(ids.map(id=>body.action==="applyTag" ? db.prepare("INSERT OR IGNORE INTO word_tag_links(tag_id,word_id) SELECT ?,w.id FROM word_entries w JOIN word_batches b ON b.id=w.batch_id WHERE w.id=? AND b.study_date<=?").bind(body.tagId,id,new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Shanghai"})) : db.prepare("DELETE FROM word_tag_links WHERE tag_id=? AND word_id=?").bind(body.tagId,id)));
    } else return jsonError("未知操作。");
    return Response.json({ok:true},{headers:adminHeaders});
  } catch(e) {console.error(e);return jsonError("保存标记失败。",500);}
}
