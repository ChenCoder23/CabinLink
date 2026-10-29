import fs from 'node:fs';import path from 'node:path';
const revision=process.argv[2],tag='20261014-study-'+revision,release=path.resolve('.deployment',tag);
fs.mkdirSync(release,{recursive:true,mode:0o700});fs.cpSync('dist',path.join(release,'dist'),{recursive:true});fs.mkdirSync(path.join(release,'dist/server/migrations'),{recursive:true});for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')))fs.copyFileSync('drizzle/'+f,path.join(release,'dist/server/migrations',f));
fs.mkdirSync(path.join(release,'docker'));fs.writeFileSync(path.join(release,'docker/start.sh'),fs.readFileSync('docker/start.sh','utf8').replace(/\r\n/g,'\n'));fs.mkdirSync(path.join(release,'scripts'));for(const f of ['start-production.mjs','word-scheduler.mjs','seed-workbench.py','seed-study-profile.py'])fs.copyFileSync('scripts/'+f,path.join(release,'scripts',f));for(const [source,name] of [['.secrets/workbench-seed.json','workbench-seed.json'],['.secrets/study-profile-v2.json','study-profile-v2.json']]){fs.copyFileSync(source,path.join(release,name));fs.chmodSync(path.join(release,name),0o600);}
fs.writeFileSync(path.join(release,'Dockerfile'),`FROM cabinlink:release-20261014-study-887f81a\nRUN rm -rf /app/dist\nCOPY dist /app/dist\nCOPY docker/start.sh /app/start.sh\nCOPY scripts/start-production.mjs scripts/word-scheduler.mjs /app/scripts/\nRUN chmod 755 /app/start.sh\nLABEL org.opencontainers.image.revision="${revision}"\n`);
let deploy=fs.readFileSync('.deployment/20261013-upgrade-17382f8/deploy.py','utf8').replaceAll('20261013-upgrade-17382f8',tag);
deploy=deploy.replace("def launch(name,folder,port,config):",`def private_snapshot(folder):
 c=database(folder);tasks=c.execute('SELECT * FROM workbench_tasks ORDER BY id').fetchall();profile=c.execute('SELECT user_id,introduction FROM workbench_profile ORDER BY user_id').fetchall();c.close();return [tasks,profile]

def verify_private_before(before,folder):
 after=private_snapshot(folder);assert before[0]==after[0],'Existing milestone data changed'
 c=database(folder)
 for user,intro in before[1]:
  current=c.execute('SELECT introduction FROM workbench_profile WHERE user_id=?',(user,)).fetchone()[0]
  if intro!=current:assert c.execute('SELECT 1 FROM workbench_profile_history WHERE user_id=? AND introduction=?',(user,intro)).fetchone(),'Previous private archive lost'
 c.close()

def study_smoke(folder,port,write=False):
 c=database(folder);owner=c.execute('SELECT user_id FROM workbench_owner WHERE id=1').fetchone()[0]
 token=secrets.token_urlsafe(32);sid=str(uuid.uuid4());now=datetime.datetime.now(datetime.timezone.utc);stamp=lambda d:d.isoformat(timespec='milliseconds').replace('+00:00','Z')
 c.execute('INSERT INTO sessions VALUES(?,?,?,?,?)',(sid,owner,hashlib.sha256(token.encode()).hexdigest(),stamp(now+datetime.timedelta(minutes=15)),stamp(now)));c.commit();cookie='cabinlink_session='+token
 try:
  assert http('/admin/workbench',port,cookie=cookie)[0]==200
  assert http('/admin/workbench',port)[0]==404
  for endpoint in ['study','courses','agent']:
   assert http('/api/workbench/'+endpoint,port)[0]==404
   assert http('/api/workbench/'+endpoint,port,cookie=cookie)[0]==200
  data=json.loads(http('/api/workbench/study',port,cookie=cookie)[1]);assert 'key_cipher' not in data['agent']
  assert data['settings']['config']['admission_year']=='2028'
  assert c.execute('SELECT 1 FROM workbench_profile_history WHERE user_id=?',(owner,)).fetchone()
  source=json.loads(http('/api/workbench/courses',port,cookie=cookie)[1]);assert len(source['nodes'])>40 and all(x['kind']=='textbook' for x in source['sources'])
  assert http('/pdf.worker.min.mjs',port)[0]==200
  assert (folder/'secrets/study-agent.key').stat().st_mode&0o777==0o600
  if write:
   def post(endpoint,body):
    code,raw,_=http('/api/workbench/'+endpoint,port,body,cookie);assert code==200,(code,raw);return json.loads(raw)
   draft=post('courses',{'action':'draft','verified':True,'label':'__candidate_study__'})
   post('courses',{'action':'activate','id':draft['id']})
   config=data['settings']['config'];config.update(confirmed=True,enabled=True,weekday_minutes=90,weekend_minutes=90)
   post('study',{'action':'settings','config':config,'revision':data['settings']['revision']})
   post('study',{'action':'generate'});post('study',{'action':'generate'})
   current=json.loads(http('/api/workbench/study',port,cookie=cookie)[1]);assert len(current['plans'])==14
   today=(now+datetime.timedelta(hours=8)).date().isoformat();plan=next(p for p in current['plans'] if p['study_date']==today)
   assert len(plan['tasks'])<=3 and sum(t['minutes'] for t in plan['tasks'])<=81
   reply=post('agent',{'action':'chat','text':'今天只有30分钟'});assert reply['mode']=='local'
   post('agent',{'action':'apply','id':reply['proposal']});post('agent',{'action':'undo','id':reply['proposal']})
   current=json.loads(http('/api/workbench/study',port,cookie=cookie)[1]);plan=next(p for p in current['plans'] if p['study_date']==today)
   post('study',{'action':'task','date':today,'id':plan['tasks'][0]['id'],'event':'complete','revision':plan['revision'],'minutes':30,'rating':'hard','notes':'candidate feedback'})
   print('PASS candidate approved catalogue, real generation, feedback and preview/apply/undo',flush=True)
  print('PASS private planner APIs, source metadata, PDF worker, archive preservation and encrypted-key permissions',flush=True)
 finally:
  c.execute('DELETE FROM sessions WHERE id=?',(sid,));c.commit();c.close()

def launch(name,folder,port,config):`);
deploy=deploy.replace("subprocess.check_call(['python3',str(RELEASE/'scripts/seed-workbench.py'),filename,str(RELEASE/'workbench-seed.json'),'chenhuichuangChc2324'])","subprocess.check_call(['python3',str(RELEASE/'scripts/seed-workbench.py'),filename,str(RELEASE/'workbench-seed.json'),'chenhuichuangChc2324'])\n subprocess.check_call(['python3',str(RELEASE/'scripts/seed-study-profile.py'),filename,str(RELEASE/'study-profile-v2.json'),'chenhuichuangChc2324'])");
deploy=deploy.replace("upgrade_smoke(CANDIDATE,8092,False)","upgrade_smoke(CANDIDATE,8092,False)\n study_smoke(CANDIDATE,8092,True)");
deploy=deploy.replace("before=summary(DATA);run('docker','stop','cabinlink')","before=summary(DATA);private_before=private_snapshot(DATA);run('docker','stop','cabinlink')");
deploy=deploy.replace("run('docker','rename','cabinlink',PREVIOUS)","BACKUP.chmod(0o600)\n  run('docker','rename','cabinlink',PREVIOUS)");
deploy=deploy.replace("after=summary(DATA);assert before==after,(before,after)","after=summary(DATA);assert before==after,(before,after)\n  verify_private_before(private_before,DATA)");
deploy=deploy.replace("upgrade_smoke(DATA,80,False)","upgrade_smoke(DATA,80,False);study_smoke(DATA,80,False)");
deploy=deploy.replace("(RELEASE/'workbench-seed.json').unlink();", "(RELEASE/'workbench-seed.json').unlink();(RELEASE/'study-profile-v2.json').unlink();");
fs.writeFileSync(path.join(release,'deploy.py'),deploy.replace(/\r\n/g,'\n'));console.log(release);
