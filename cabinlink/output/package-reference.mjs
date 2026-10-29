import fs from 'node:fs';import path from 'node:path';
const revision=process.argv[2],tag='20261014-reference-'+revision,release=path.resolve('.deployment',tag);
fs.mkdirSync(release,{recursive:true});fs.cpSync('dist',path.join(release,'dist'),{recursive:true});fs.mkdirSync(path.join(release,'dist/server/migrations'),{recursive:true});for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')))fs.copyFileSync(path.join('drizzle',f),path.join(release,'dist/server/migrations',f));
fs.mkdirSync(path.join(release,'docker'));fs.writeFileSync(path.join(release,'docker/start.sh'),fs.readFileSync('docker/start.sh','utf8').replace(/\r\n/g,'\n'));
fs.mkdirSync(path.join(release,'scripts'));for(const f of ['start-production.mjs','word-scheduler.mjs','seed-workbench.py'])fs.copyFileSync('scripts/'+f,path.join(release,'scripts',f));
fs.copyFileSync('.secrets/workbench-seed.json',path.join(release,'workbench-seed.json'));
fs.writeFileSync(path.join(release,'Dockerfile'),`FROM cabinlink:release-20261013-dashboard-c60c501\nRUN rm -rf /app/dist\nCOPY dist /app/dist\nCOPY docker/start.sh /app/start.sh\nCOPY scripts/start-production.mjs scripts/word-scheduler.mjs /app/scripts/\nRUN chmod 755 /app/start.sh\nLABEL org.opencontainers.image.revision="${revision}"\n`);
let deploy=fs.readFileSync('.deployment/20261013-upgrade-17382f8/deploy.py','utf8').replaceAll('20261013-upgrade-17382f8',tag);
deploy=deploy.replace("assert http('/api/internal/word-scheduler',port,body={})[0]==404,'Scheduler endpoint exposed'",`assert http('/api/internal/word-scheduler',port,body={})[0]==404,'Scheduler endpoint exposed'
  assert http('/admin/workbench',port,cookie=cookie)[0]==200,'Owner page inaccessible'
  assert http('/admin/workbench',port)[0]==404,'Private admin page exposed'
  assert http('/home-banner.png',port)[0]==200
  assert http('/workbench-banner.png',port)[0]==200
  c.execute('SELECT hero_title,hero_description,hero_background FROM workbench_profile WHERE user_id=?',(owner[0],)).fetchone()
  print('PASS canonical private admin page and independent banners',flush=True)`);
deploy=deploy.replace("def launch(name,folder,port,config):",`def private_snapshot(folder):
 c=database(folder);tasks=c.execute('SELECT * FROM workbench_tasks ORDER BY id').fetchall();profile=c.execute('SELECT user_id,introduction FROM workbench_profile ORDER BY user_id').fetchall();c.close();return [tasks,profile]

def launch(name,folder,port,config):`);
deploy=deploy.replace("before=summary(DATA);run('docker','stop','cabinlink')","before=summary(DATA);private_before=private_snapshot(DATA);run('docker','stop','cabinlink')");
deploy=deploy.replace("run('docker','rename','cabinlink',PREVIOUS)","BACKUP.chmod(0o600)\n  run('docker','rename','cabinlink',PREVIOUS)");
deploy=deploy.replace("after=summary(DATA);assert before==after,(before,after)","after=summary(DATA);assert before==after,(before,after)\n  assert private_before==private_snapshot(DATA),'Private task data changed'");
fs.writeFileSync(path.join(release,'deploy.py'),deploy.replace(/\r\n/g,'\n'));console.log(release);
