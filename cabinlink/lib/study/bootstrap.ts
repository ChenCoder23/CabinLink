import {requireStorage} from '@/lib/cabinet-server';
import {OUTLINE_VERSION, OUTLINE_SOURCE, SUPPLIED_OUTLINE} from './supplied-outline';
import {validateNodes} from './catalog';
import {beijing} from './planner';
import {generatePlans} from './store';

// One-time owner-authorized import. Later personal catalogue edits are retained.
export async function ensureSuppliedOutline(user:string){
 const {db}=requireStorage(),id=`${user}:${OUTLINE_VERSION}`;
 if(await db.prepare('SELECT id FROM study_courses WHERE id=? AND user_id=?').bind(id,user).first())return;
 const nodes=validateNodes(SUPPLIED_OUTLINE),stamp=new Date().toISOString();
 await db.batch([
  db.prepare("UPDATE study_courses SET status='archived' WHERE user_id=? AND status='active' AND NOT EXISTS(SELECT 1 FROM study_courses WHERE id=?)").bind(user,id),
  db.prepare("DELETE FROM study_plans WHERE user_id=? AND study_date>=? AND NOT EXISTS(SELECT 1 FROM study_courses WHERE id=?) AND NOT EXISTS(SELECT 1 FROM json_each(study_plans.tasks_json) WHERE json_extract(value,'locked')=1 OR json_extract(value,'status')!='todo' OR json_extract(value,'kind')='custom')").bind(user,beijing(),id),
  db.prepare("INSERT OR IGNORE INTO study_courses VALUES(?,?,?,?,?,?,'active','',?,?)").bind(id,user,OUTLINE_SOURCE.title,'personal',JSON.stringify([OUTLINE_SOURCE]),JSON.stringify(nodes),'本人于2026-10-14提供并要求直接用于学习计划。',stamp)
 ]);
 await generatePlans(user);
}
