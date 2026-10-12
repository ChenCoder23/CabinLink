import ExcelJS from "exceljs";
import { requireAdmin, adminHeaders } from "@/lib/admin-server";
import { sameOrigin } from "@/lib/auth-server";
import { requireStorage, jsonError } from "@/lib/cabinet-server";

export async function GET(request:Request) {
  try {
    const auth=await requireAdmin(request);if(auth.response)return auth.response;
    if(new URL(request.url).searchParams.has("template")) {
      const workbook=new ExcelJS.Workbook();const sheet=workbook.addWorksheet("单词导入");
      sheet.columns=[{header:"英文",key:"english",width:30},{header:"中文意思",key:"chinese",width:50}];
      sheet.getRow(1).font={bold:true};sheet.views=[{state:"frozen",ySplit:1}];
      return new Response(new Uint8Array(await workbook.xlsx.writeBuffer()),{headers:{...adminHeaders,"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":"attachment; filename=wordbook-template.xlsx"}});
    }
    const {db}=requireStorage();const [categories,batches]=await Promise.all([
      db.prepare("SELECT * FROM word_categories ORDER BY created_at,name").all(),
      db.prepare("SELECT b.*,c.name AS category_name,(SELECT COUNT(*) FROM word_entries w WHERE w.batch_id=b.id) AS count FROM word_batches b JOIN word_categories c ON c.id=b.category_id ORDER BY uploaded_at DESC LIMIT 100").all()
    ]);return Response.json({categories:categories.results,batches:batches.results},{headers:adminHeaders});
  }catch(e){console.error(e);return jsonError("单词管理读取失败。",500);}
}
export async function POST(request:Request) {
  try {
    if(!sameOrigin(request))return jsonError("请求来源无效。",403);
    const auth=await requireAdmin(request);if(auth.response)return auth.response;
    const {db}=requireStorage();
    if(request.headers.get("content-type")?.includes("application/json")) {
      const body=await request.json() as {action?:string;name?:unknown};
      if(!body || typeof body!=="object")return jsonError("请求格式无效。");
      if(body.action!=="category" || typeof body.name!=="string" || !body.name.trim() || body.name.trim().length>50)return jsonError("请输入 1–50 字的分类名称。");
      await db.prepare("INSERT OR IGNORE INTO word_categories(id,name,created_at) VALUES(?,?,?)").bind(crypto.randomUUID(),body.name.trim(),new Date().toISOString()).run();
      return Response.json({ok:true},{headers:adminHeaders});
    }
    if(Number(request.headers.get("content-length"))>2*1024*1024+16384)return jsonError("文件不能超过 2 MB。");
    const form=await request.formData();const file=form.get("file");const category=form.get("category");const date=form.get("date");
    if(!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx") || file.size>2*1024*1024)return jsonError("请上传不超过 2 MB 的 .xlsx 文件。");
    if(typeof date!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date)return jsonError("请选择有效的每日单词日期。");
    if(typeof category!=="string" || !await db.prepare("SELECT id FROM word_categories WHERE id=?").bind(category).first())return jsonError("请选择已有分类。");
    const workbook=new ExcelJS.Workbook();
    try {await workbook.xlsx.load(await file.arrayBuffer());}catch{return jsonError("Excel 文件无法读取，请使用下载的模板。");}
    const sheet=workbook.worksheets[0];if(!sheet || sheet.rowCount>501)return jsonError("每次最多导入 500 个单词。");
    if(sheet.getCell("A1").text.trim()!=="英文" || sheet.getCell("B1").text.trim()!=="中文意思")return jsonError("模板表头必须为：英文、中文意思。");
    const words:{english:string;chinese:string}[]=[];const errors:string[]=[];const seen=new Set<string>();
    for(let i=2;i<=sheet.rowCount;i++) {
      const row=sheet.getRow(i);const english=row.getCell(1).text.trim(),chinese=row.getCell(2).text.trim();
      if(!english&&!chinese)continue;
      if(row.getCell(1).type===ExcelJS.ValueType.Formula || row.getCell(2).type===ExcelJS.ValueType.Formula || !english || !chinese || english.length>200 || chinese.length>1000){errors.push(`第 ${i} 行：英文、中文意思不能为空，不支持公式，长度分别最多 200、1000 字。`);continue;}
      if(seen.has(english.toLowerCase())){errors.push(`第 ${i} 行：英文重复（${english}）。`);continue;}
      seen.add(english.toLowerCase());words.push({english,chinese});
    }
    if(errors.length)return Response.json({error:"导入失败，未保存任何单词。",errors:errors.slice(0,20)},{status:400});
    if(!words.length)return jsonError("请先在模板中填写单词。");
    const batch=crypto.randomUUID(),now=new Date().toISOString();
    await db.batch([db.prepare("INSERT INTO word_batches(id,category_id,study_date,uploaded_at,uploader_id) VALUES(?,?,?,?,?)").bind(batch,category,date,now,auth.user!.id),...words.map(w=>db.prepare("INSERT INTO word_entries(id,batch_id,english,chinese) VALUES(?,?,?,?)").bind(crypto.randomUUID(),batch,w.english,w.chinese))]);
    return Response.json({ok:true,count:words.length,uploadedAt:now},{headers:adminHeaders});
  }catch(e){console.error(e);return jsonError("保存失败，请稍后重试。",500);}
}
