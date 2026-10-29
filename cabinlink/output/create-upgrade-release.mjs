import fs from 'node:fs';
import path from 'node:path';
const revision=process.argv[2]||'candidate',tag='20261013-upgrade-'+revision,release=path.resolve('.deployment',tag);
fs.mkdirSync(release,{recursive:true});fs.cpSync('dist',path.join(release,'dist'),{recursive:true});fs.mkdirSync(path.join(release,'dist/server/migrations'),{recursive:true});for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')))fs.copyFileSync(path.join('drizzle',f),path.join(release,'dist/server/migrations',f));
fs.mkdirSync(path.join(release,'docker'));fs.writeFileSync(path.join(release,'docker/start.sh'),fs.readFileSync('docker/start.sh','utf8').replace(/\r\n/g,'\n'));fs.mkdirSync(path.join(release,'scripts'));for(const f of ['start-production.mjs','word-scheduler.mjs','seed-workbench.py'])fs.copyFileSync('scripts/'+f,path.join(release,'scripts',f));
fs.writeFileSync(path.join(release,'Dockerfile'),`FROM cabinlink:release-20261012-glass-f480cc0\nRUN rm -rf /app/dist\nCOPY dist /app/dist\nCOPY docker/start.sh /app/start.sh\nCOPY scripts/start-production.mjs scripts/word-scheduler.mjs /app/scripts/\nRUN chmod 755 /app/start.sh\nLABEL org.opencontainers.image.revision="${revision}"\n`);
fs.copyFileSync('.secrets/workbench-seed.json',path.join(release,'workbench-seed.json'));
let deploy=fs.readFileSync('.deployment/glass-f480cc0/deploy.py','utf8').replace("TAG='20261012-glass-f480cc0'",`TAG='${tag}'`);
const helpers=`
def seed(folder):
 c=database(folder)
 filename=c.execute('PRAGMA database_list').fetchone()[2];c.close()
 subprocess.check_call(['python3',str(RELEASE/'scripts/seed-workbench.py'),filename,str(RELEASE/'workbench-seed.json'),'chenhuichuangChc2324'])

def upgrade_smoke(folder,port,timer_test):
 c=database(folder); owner=c.execute('SELECT user_id FROM workbench_owner WHERE id=1').fetchone();assert owner,'Missing private owner'
 user=c.execute('SELECT role FROM users WHERE id=?',(owner[0],)).fetchone();assert user and user[0]=='admin','Requested account is not administrator'
 token=secrets.token_urlsafe(32);sid=str(uuid.uuid4());now=datetime.datetime.now(datetime.timezone.utc);stamp=lambda d:d.isoformat(timespec='milliseconds').replace('+00:00','Z')
 c.execute('INSERT INTO sessions(id,user_id,token_hash,expires_at,created_at) VALUES(?,?,?,?,?)',(sid,owner[0],hashlib.sha256(token.encode()).hexdigest(),stamp(now+datetime.timedelta(minutes=15)),stamp(now)));c.commit();cookie='cabinlink_session='+token
 try:
  code,body,_=http('/api/workbench',port,cookie=cookie);assert code==200,'Private workbench unavailable';data=json.loads(body);assert len(data['tasks'])>=13 and data['profile']['introduction'],'Private seed unavailable'
  assert http('/api/workbench',port)[0]==404,'Anonymous private access allowed'
  assert http('/api/admin/word-schedules',port,cookie=cookie)[0]==200,'Schedule administration unavailable'
  code,body,_=http('/api/personal',port,cookie=cookie);assert code==200 and json.loads(body)['limit']==209715200,'Quota endpoint unavailable'
  code,body,_=http('/api/auth/session',port,cookie=cookie);assert code==200 and json.loads(body)['user']['canWorkbench'],'Private navigation unavailable'
  assert http('/api/internal/word-scheduler',port,body={})[0]==404,'Scheduler endpoint exposed'
  if timer_test:
   category=str(uuid.uuid4());library=str(uuid.uuid4());schedule=str(uuid.uuid4());today=(now+datetime.timedelta(hours=8)).date().isoformat()
   c.execute('INSERT INTO word_categories VALUES(?,?,?)',(category,'__timer_smoke__',stamp(now)))
   c.execute("INSERT INTO word_libraries(id,category_id,uploader_id,name,status,total,imported,created_at) VALUES(?,?,?,?,'ready',1,1,?)",(library,category,owner[0],'timer smoke',stamp(now)))
   c.execute('INSERT INTO word_library_entries VALUES(?,?,?,?)',(library,0,'timer','定时'))
   c.execute("INSERT INTO word_schedules VALUES(?,?,?,?,?,'active',?)",(schedule,library,today,'00:00',1,stamp(now)));c.commit()
   for attempt in range(45):
    if c.execute('SELECT COUNT(*) FROM word_schedule_runs WHERE schedule_id=?',(schedule,)).fetchone()[0]:break
    time.sleep(2)
   else:raise Exception('Independent scheduler did not publish due batch')
   assert c.execute('SELECT status FROM word_schedules WHERE id=?',(schedule,)).fetchone()[0]=='finished'
   print('PASS independent timer published without browser request',flush=True)
  print('PASS private owner, anonymous denial, quota, schedule APIs and private seed',flush=True)
 finally:
  c.execute('DELETE FROM sessions WHERE id=?',(sid,));c.commit();c.close()
`;
deploy=deploy.replace('mode=sys.argv[1]',helpers+'\nmode=sys.argv[1]');
deploy=deploy.replace("print('candidate',summary(CANDIDATE),flush=True)","seed(CANDIDATE)\n print('candidate',summary(CANDIDATE),flush=True)");
deploy=deploy.replace("smoke(CANDIDATE,8092,True)","smoke(CANDIDATE,8092,True)\n upgrade_smoke(CANDIDATE,8092,True)");
deploy=deploy.replace("after=summary(DATA);assert before==after", "seed(DATA)\n  after=summary(DATA);assert before==after");
deploy=deploy.replace("smoke(DATA,80,False)","smoke(DATA,80,False);upgrade_smoke(DATA,80,False)");
deploy=deploy.replace("(RELEASE/'runtime-config.json').unlink();", "(RELEASE/'runtime-config.json').unlink();(RELEASE/'workbench-seed.json').unlink();");
fs.writeFileSync(path.join(release,'deploy.py'),deploy.replace(/\r\n/g,'\n'));console.log(release);
