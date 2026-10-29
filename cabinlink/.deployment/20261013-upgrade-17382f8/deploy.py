import sys,json,subprocess,sqlite3,pathlib,shutil,time,urllib.request,urllib.error,tarfile,hashlib,secrets,uuid,datetime
TAG='20261013-upgrade-17382f8'
IMAGE='cabinlink:release-'+TAG
RELEASE=pathlib.Path('/opt/cabinlink/releases')/TAG
DATA=pathlib.Path('/var/lib/docker/volumes/cabinlink_data/_data')
CANDIDATE=RELEASE/'candidate-data'
PREVIOUS='cabinlink-prev-'+TAG
BACKUP=pathlib.Path('/opt/cabinlink/backups')/('data-before-'+TAG+'.tar.gz')
def run(*args):return subprocess.check_output(args,text=True).strip()
def inspect(name):return json.loads(run('docker','inspect',name))[0]
def database(folder):
 for p in folder.glob('v3/d1/**/*.sqlite'):
  c=sqlite3.connect(p)
  if c.execute("SELECT COUNT(*) FROM sqlite_master WHERE name='users'").fetchone()[0]:return c
  c.close()
 raise Exception('No application database')
def summary(folder):
 c=database(folder); result={t:c.execute('SELECT COUNT(*) FROM '+t).fetchone()[0] for t in ['users','cabinets','themes','files']};result['integrity']=c.execute('PRAGMA integrity_check').fetchone()[0];c.close();return result
def launch(name,folder,port,config):
 args=['docker','run','-d','--name',name,'--restart',config['HostConfig']['RestartPolicy']['Name'],'-p',port+':80','-v',str(folder)+':/data']
 for v in config['Config']['Env']:args+=['-e',v]
 args+=[IMAGE];run(*args)
def ready(port):
 for _ in range(80):
  try:
   with urllib.request.urlopen('http://127.0.0.1:'+str(port)+'/api/auth/session',timeout=4) as r:
    if r.status==200:return
  except Exception:pass
  time.sleep(2)
 raise Exception('Readiness timeout')
def http(path,port=80,body=None,cookie=None):
 headers={'Content-Type':'application/json'}
 if cookie:headers['Cookie']=cookie
 req=urllib.request.Request('http://127.0.0.1:'+str(port)+path,data=json.dumps(body).encode() if body is not None else None,headers=headers)
 try:
  with urllib.request.urlopen(req,timeout=10) as r:return r.status,r.read(),r.headers
 except urllib.error.HTTPError as e:return e.code,e.read(),e.headers

def smoke(folder,port,write):
 import io,zipfile
 c=database(folder);admin=c.execute("SELECT id FROM users WHERE role='admin' AND banned_at IS NULL LIMIT 1").fetchone();assert admin,'No existing active administrator'
 token=secrets.token_urlsafe(32);sid=str(uuid.uuid4());now=datetime.datetime.now(datetime.timezone.utc);stamp=lambda d:d.isoformat(timespec='milliseconds').replace('+00:00','Z')
 c.execute('INSERT INTO sessions(id,user_id,token_hash,expires_at,created_at) VALUES(?,?,?,?,?)',(sid,admin[0],hashlib.sha256(token.encode()).hexdigest(),stamp(now+datetime.timedelta(minutes=15)),stamp(now)));c.commit()
 cookie='cabinlink_session='+token
 try:
  code,body,_=http('/api/admin/wordbook',port,cookie=cookie);assert code==200,(code,body)
  for table in ['word_categories','word_batches','word_entries','word_tags','word_tag_links']:c.execute('SELECT COUNT(*) FROM '+table).fetchone()
  code,template,headers=http('/api/admin/wordbook?template=1',port,cookie=cookie);assert code==200 and template[:2]==b'PK','Template failure'
  code,body,_=http('/api/wordbook',port,cookie=cookie);assert code==200,(code,body)
  code,body,_=http('/api/auth/cabinets',port,cookie=cookie);assert code==200
  if write:
   code,_,_=http('/api/admin/wordbook',port,{'action':'category','name':'__release_smoke__'},cookie);assert code==200
   cats=json.loads(http('/api/admin/wordbook',port,cookie=cookie)[1])['categories'];category=next(x['id'] for x in cats if x['name']=='__release_smoke__')
   output=io.BytesIO()
   sheet=b'<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:B2"/><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>ENGLISH_HEADER</t></is></c><c r="B1" t="inlineStr"><is><t>CHINESE_HEADER</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>apple</t></is></c><c r="B2" t="inlineStr"><is><t>MEANING</t></is></c></row></sheetData></worksheet>'
   sheet=sheet.replace(b'ENGLISH_HEADER','英文'.encode()).replace(b'CHINESE_HEADER','中文意思'.encode()).replace(b'MEANING','苹果'.encode())
   with zipfile.ZipFile(io.BytesIO(template)) as zin,zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as zout:
    for info in zin.infolist():zout.writestr(info.filename,sheet if info.filename=='xl/worksheets/sheet1.xml' else zin.read(info.filename))
   boundary='Wordbook'+secrets.token_hex(12);payload=b''
   today=(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(hours=8)).date().isoformat()
   for key,value in [('category',category),('date',today)]:payload+=('--'+boundary+'\r\nContent-Disposition: form-data; name="'+key+'"\r\n\r\n'+value+'\r\n').encode()
   payload+=('--'+boundary+'\r\nContent-Disposition: form-data; name="file"; filename="smoke.xlsx"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n').encode()+output.getvalue()+('\r\n--'+boundary+'--\r\n').encode()
   req=urllib.request.Request('http://127.0.0.1:'+str(port)+'/api/admin/wordbook',data=payload,headers={'Cookie':cookie,'Content-Type':'multipart/form-data; boundary='+boundary})
   with urllib.request.urlopen(req,timeout=30) as response:assert json.loads(response.read())['count']==1
   result=json.loads(http('/api/wordbook?category='+category+'&date='+today,port,cookie=cookie)[1]);assert result['words'][0]['chinese']=='苹果' and result['words'][0]['uploaded_at']
   code,_,_=http('/api/wordbook',port,{'action':'createTag','name':'__release_tag__','color':'#ff0000'},cookie);assert code==200
   result=json.loads(http('/api/wordbook?category='+category,port,cookie=cookie)[1]);tag=next(t['id'] for t in result['tags'] if t['name']=='__release_tag__');word=result['words'][0]['id']
   code,_,_=http('/api/wordbook',port,{'action':'applyTag','tagId':tag,'ids':[word]},cookie);assert code==200
   result=json.loads(http('/api/wordbook?category='+category+'&tag='+tag,port,cookie=cookie)[1]);assert len(result['words'])==1 and result['links']
  print('PASS authenticated '+('candidate Excel import, publication, personal tags and filtering' if write else 'production wordbook, admin template and cabinet APIs'),flush=True)
 finally:
  c.execute('DELETE FROM sessions WHERE id=?',(sid,));c.commit();c.close()


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

mode=sys.argv[1]
if mode=='candidate':
 cfg=inspect('cabinlink');(RELEASE/'runtime-config.json').write_text(json.dumps(cfg));(RELEASE/'runtime-config.json').chmod(0o600)
 shutil.copytree(DATA,CANDIDATE,ignore=shutil.ignore_patterns('*-wal','*-shm'))
 for p in DATA.rglob('*.sqlite'):
  source=sqlite3.connect('file:'+str(p)+'?mode=ro',uri=True);dest=sqlite3.connect(CANDIDATE/p.relative_to(DATA));source.backup(dest);dest.close();source.close()
 print('before',summary(DATA),flush=True)
 launch('cabinlink-candidate-'+TAG,CANDIDATE,'127.0.0.1:8092',cfg);ready(8092)
 seed(CANDIDATE)
 print('candidate',summary(CANDIDATE),flush=True)
 for path,status in [('/',200),('/admin',200),('/wordbook',200),('/api/admin',401),('/api/wordbook',401),('/api/admin/wordbook',401),('/api/site-settings',200)]:assert http(path,8092)[0]==status,path
 smoke(CANDIDATE,8092,False)
 upgrade_smoke(CANDIDATE,8092,False)
 print('PASS candidate HTTP, wordbook Excel import and migrations',flush=True)
elif mode=='promote':
 cfg=json.loads((RELEASE/'runtime-config.json').read_text());run('docker','stop','cabinlink-candidate-'+TAG)
 before=summary(DATA);run('docker','stop','cabinlink')
 try:
  with tarfile.open(BACKUP,'w:gz') as tar:tar.add(DATA,arcname='data')
  run('docker','rename','cabinlink',PREVIOUS)
  args=['docker','run','-d','--name','cabinlink','--restart',cfg['HostConfig']['RestartPolicy']['Name']]
  for port,bindings in cfg['HostConfig']['PortBindings'].items():
   for b in bindings:args+=['-p',(b['HostIp']+':' if b['HostIp'] else '')+b['HostPort']+':'+port]
  args+=['-v','cabinlink_data:/data']
  for v in cfg['Config']['Env']:args+=['-e',v]
  args+=[IMAGE];run(*args);ready(80)
  seed(DATA)
  after=summary(DATA);assert before==after,(before,after)
  assert http('/admin')[0]==200;assert http('/api/admin')[0]==401;assert http('/wordbook')[0]==200;assert http('/api/wordbook')[0]==401;smoke(DATA,80,False);upgrade_smoke(DATA,80,False)
  print('PASS production',after,'backup',str(BACKUP),flush=True)
 except Exception:
  subprocess.run(['docker','rm','-f','cabinlink'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  # Added tables and columns preserve compatibility with the previous app.
  subprocess.run(['docker','rename',PREVIOUS,'cabinlink'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  subprocess.run(['docker','start','cabinlink'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  raise
elif mode=='cleanup':
 run('docker','rm','cabinlink-candidate-'+TAG);shutil.rmtree(CANDIDATE);(RELEASE/'runtime-config.json').unlink();(RELEASE/'workbench-seed.json').unlink();print('Temporary candidate removed; previous container and backup retained')
