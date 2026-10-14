import type { CourseNode, Source } from './types';
export const SOURCES:Source[]=[
 {id:'ds-2025',title:'数据结构复习全书基础知识篇',url:'https://www.tup.tsinghua.edu.cn/bookscenter/book_09892801.html',publisher:'清华大学出版社',published_at:'2025-04-01',exam_year:'',kind:'textbook',verified_at:'2026-10-14',scope:'教材目录；目标年度官方考试大纲尚未核验'},
 {id:'co-2024',title:'计算机组成原理：微课视频版',url:'https://www.tup.tsinghua.edu.cn/bookscenter/book_09302401.html',publisher:'清华大学出版社',published_at:'2024-12-01',exam_year:'',kind:'textbook',verified_at:'2026-10-14',scope:'教材章节及简介，非官方大纲'},
 {id:'os-2021',title:'操作系统复习指导与真题解析',url:'https://www.tup.tsinghua.edu.cn/bookscenter/book_08987801.html',publisher:'清华大学出版社',published_at:'2021-08-01',exam_year:'',kind:'textbook',verified_at:'2026-10-14',scope:'历史教材目录，需核对目标年度'},
 {id:'net-2025',title:'408考研直通车：计算机网络强化复习',url:'https://www.tup.tsinghua.edu.cn/booksCenter/book_11216901.html',publisher:'清华大学出版社',published_at:'2025-10-01',exam_year:'',kind:'textbook',verified_at:'2026-10-14',scope:'教材目录，非官方大纲'}
];
const chapters=[['数据结构','ds-2025',['概念与算法','线性表','栈、队列和数组','树与二叉树','图','查找','排序']],['计算机组成原理','co-2024',['计算机概述','数据表示与运算','存储器','指令系统','中央处理器','总线','输入输出']],['操作系统','os-2021',['操作系统概述','进程与线程','处理机调度','同步与死锁','内存管理','文件系统','I/O管理']],['计算机网络','net-2025',['网络概述','物理层','数据链路层','网络层','传输层','应用层']]] as const;
const points:Record<string,string[][]>={
 'ds-2025':[['数据结构基本概念','算法与评价'],['线性表操作','顺序存储','链式存储'],['栈','队列','数组与特殊矩阵'],['树的概念','二叉树存储与遍历','树与森林'],['图（细目待补充）'],['查找（细目待补充）'],['排序（细目待补充）']],
 'co-2024':[['计算机组成与性能'],['数制与编码','定点和浮点','算术运算与ALU'],['主存储器','高速缓存','虚拟存储'],['指令格式与寻址','CISC与RISC'],['指令执行与数据通路','控制器','流水线'],['总线分类与结构','仲裁与定时'],['I/O接口与查询','中断','DMA与通道']],
 'os-2021':[['概念、特征与服务','运行环境与体系结构'],['进程','线程'],['调度'],['同步','死锁'],['内存管理基础','虚拟内存'],['文件基础与实现','磁盘组织管理'],['I/O概述与核心子系统']],
 'net-2025':[['概念与交换','性能与分层'],['接口与介质','编码与调制','信道容量与复用'],['帧与差错检测','可靠传输与PPP','以太网与VLAN','无线局域网与介质访问'],['IPv4与ARP','路由协议','ICMP与NAT','多播与移动IP','IPv6与SDN'],['TCP与连接管理','流量和拥塞控制','可靠传输'],['DNS与DHCP','FTP与电子邮件','HTTP']]
};
export const VERIFIED_DRAFT:CourseNode[]=chapters.flatMap(([subject,source,titles])=>titles.flatMap((chapter,i)=>(points[source][i]).map((title,j)=>({id:`${source.split('-')[0]}-${i+1}${j?'-'+(j+1):''}`,subject,chapter,title,source_id:source,order:i*10+j,prerequisites:j?[`${source.split('-')[0]}-${i+1}${j>1?'-'+j:''}`]:i?[`${source.split('-')[0]}-${i}${points[source][i-1].length>1?'-'+points[source][i-1].length:''}`]:[],difficulty:2,minutes:60,practice_minutes:30,review_minutes:15,scope:'出版社目录或简介的知识点摘要；非年度官方大纲。顺序、耗时与前置关系为可修改规划假设。'}))));
export function validateNodes(value:unknown):CourseNode[]{
 if(!Array.isArray(value)||!value.length||value.length>500)throw Error('目录需包含1–500个知识点');
 const seen=new Set<string>();const nodes=value.map((n:CourseNode,i)=>{if(!n||typeof n.id!=='string'||!/^[-\w]{1,80}$/.test(n.id)||seen.has(n.id))throw Error(`第${i+1}行ID无效或重复`);seen.add(n.id);for(const k of ['subject','chapter','title','source_id','scope'] as const)if(typeof n[k]!=='string'||n[k].length>500)throw Error(`第${i+1}行${k}无效`);if(!n.subject||!n.chapter||!n.title)throw Error(`第${i+1}行科目、章节和知识点必填`);for(const k of ['minutes','practice_minutes','review_minutes'] as const)if(!Number.isInteger(n[k])||n[k]<5||n[k]>600)throw Error(`第${i+1}行耗时须为5–600分钟`);if(!Array.isArray(n.prerequisites)||n.prerequisites.length>20||!Number.isInteger(n.difficulty)||n.difficulty<1||n.difficulty>5)throw Error(`第${i+1}行规划信息无效`);return {...n,order:i};});
 for(const n of nodes)if(n.prerequisites.some(id=>!seen.has(id)||id===n.id))throw Error(`${n.title}前置ID不存在`);
 const visiting=new Set<string>(),done=new Set<string>();function walk(id:string){if(visiting.has(id))throw Error('前置关系存在循环');if(done.has(id))return;visiting.add(id);nodes.find(n=>n.id===id)!.prerequisites.forEach(walk);visiting.delete(id);done.add(id);}nodes.forEach(n=>walk(n.id));return nodes;
}
export async function parseText(text:string,subject='其他'):Promise<CourseNode[]>{
 if(text.length>120000)throw Error('文本最多120000字');let chapter='待确认章节';const nodes:CourseNode[]=[];
 for(const raw of text.split(/\r?\n/)){const line=raw.trim();if(!line)continue;if(/^\[.+\]$/.test(line)){subject=line.slice(1,-1);continue;}if(/^第.{1,8}章/.test(line)&&!line.includes('|')){chapter=line;continue;}const p=line.split('|').map(x=>x.trim());const title=p.length>=3?p[2]:line;if(p.length>=3){subject=p[0];chapter=p[1];}const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${subject}|${chapter}|${title}`));const id='node-'+Array.from(new Uint8Array(digest)).slice(0,10).map(x=>x.toString(16).padStart(2,'0')).join('');nodes.push({id,subject,chapter,title,source_id:'uploaded',order:nodes.length,prerequisites:[],difficulty:2,minutes:60,practice_minutes:30,review_minutes:15,scope:'上传文本提取；内容及规划参数需确认'});}
 return validateNodes(nodes);
}
export function catalogDiff(old:CourseNode[],next:CourseNode[]){const a=new Map(old.map(n=>[n.id,n])),b=new Map(next.map(n=>[n.id,n]));return {added:next.filter(n=>!a.has(n.id)).map(n=>n.title),removed:old.filter(n=>!b.has(n.id)).map(n=>n.title),changed:next.filter(n=>a.has(n.id)&&JSON.stringify(a.get(n.id))!==JSON.stringify(n)).map(n=>n.title)};}
