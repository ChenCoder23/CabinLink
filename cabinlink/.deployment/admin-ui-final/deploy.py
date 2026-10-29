import sys,json,subprocess,sqlite3,pathlib,shutil,time,urllib.request,urllib.error,tarfile,hashlib,secrets,uuid,datetime
TAG='20261012-admin-ui-aaa7ba2'
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
mode=sys.argv[1]
if mode=='candidate':
 cfg=inspect('cabinlink');(RELEASE/'runtime-config.json').write_text(json.dumps(cfg));(RELEASE/'runtime-config.json').chmod(0o600)
 shutil.copytree(DATA,CANDIDATE,ignore=shutil.ignore_patterns('*-wal','*-shm'))
 for p in DATA.rglob('*.sqlite'):
  source=sqlite3.connect('file:'+str(p)+'?mode=ro',uri=True);dest=sqlite3.connect(CANDIDATE/p.relative_to(DATA));source.backup(dest);dest.close();source.close()
 print('before',summary(DATA),flush=True)
 launch('cabinlink-candidate-'+TAG,CANDIDATE,'127.0.0.1:8092',cfg);ready(8092)
 print('candidate',summary(CANDIDATE),flush=True)
 for path,status in [('/',200),('/admin',200),('/api/admin',401),('/api/site-settings',200)]:assert http(path,8092)[0]==status,path
 print('PASS candidate HTTP and migrations',flush=True)
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
  after=summary(DATA);assert before==after,(before,after)
  assert http('/admin')[0]==200;assert http('/api/admin')[0]==401
  print('PASS production',after,'backup',str(BACKUP),flush=True)
 except Exception:
  subprocess.run(['docker','rm','-f','cabinlink'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  # Added tables and columns preserve compatibility with the previous app.
  subprocess.run(['docker','rename',PREVIOUS,'cabinlink'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  subprocess.run(['docker','start','cabinlink'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  raise
elif mode=='admin':
 body=json.loads(sys.stdin.readline());username=body['username'];password=body['password'];c=database(DATA)
 assert c.execute('SELECT COUNT(*) FROM users WHERE username=?',(username,)).fetchone()[0]==0,'Account already exists; refusing overwrite'
 salt=secrets.token_urlsafe(32);digest=hashlib.pbkdf2_hmac('sha256',password.encode(),salt.encode(),100000).hex();user_id=str(uuid.uuid4());now=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
 c.execute("INSERT INTO users(id,username,password_salt,password_hash,created_at,role) VALUES(?,?,?,?,?,'admin')",(user_id,username,salt,digest,now));c.commit();c.close()
 code,data,headers=http('/api/auth/login',body=body);assert code==200,'Admin login failed'
 cookie=headers.get('Set-Cookie').split(';')[0];code,data,_=http('/api/admin',cookie=cookie);assert code==200,'Admin API failed'
 result=json.loads(data);assert any(u['id']==user_id and u['role']=='admin' for u in result['users']);print('PASS new administrator login and authorized dashboard',result['stats'],flush=True)
 req=urllib.request.Request('http://127.0.0.1/api/auth/session',method='DELETE',headers={'Cookie':cookie});urllib.request.urlopen(req,timeout=10).close()
elif mode=='cleanup':
 run('docker','rm','cabinlink-candidate-'+TAG);shutil.rmtree(CANDIDATE);(RELEASE/'runtime-config.json').unlink();print('Temporary candidate removed; previous container and backup retained')
