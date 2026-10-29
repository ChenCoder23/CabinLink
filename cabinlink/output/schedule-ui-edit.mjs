import fs from 'node:fs';
let p='components/wordbook-admin.tsx';fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace('<WordScheduleAdmin/>','<WordScheduleAdmin categories={categories}/>'));
p='components/word-schedule-admin.tsx';let s=fs.readFileSync(p,'utf8').replace('{l.status}',"{{importing:'导入中',ready:'已就绪',failed:'导入失败'}[l.status]}").replace('{s.status}',"{{active:'运行中',paused:'已暂停',finished:'已完成'}[s.status]}");fs.writeFileSync(p,s);
