import sys,runpy,json,pathlib,shutil
tag,previous=sys.argv[1:3];release=pathlib.Path('/opt/cabinlink/releases')/tag;old=pathlib.Path('/opt/cabinlink/releases')/previous
sys.argv=[str(release/'deploy.py'),'skip'];ns=runpy.run_path(str(release/'deploy.py'))
shutil.copytree(old/'candidate-data',ns['CANDIDATE'])
config=(old/'runtime-config.json').read_text();(release/'runtime-config.json').write_text(config);(release/'runtime-config.json').chmod(0o600)
ns['launch']('cabinlink-candidate-'+tag,ns['CANDIDATE'],'127.0.0.1:8092',json.loads(config))
ns['ready'](8092);ns['seed'](ns['CANDIDATE']);ns['smoke'](ns['CANDIDATE'],8092,False);ns['upgrade_smoke'](ns['CANDIDATE'],8092,False)
print('Final candidate: passed; same scheduler already verified on prior candidate',flush=True)

# Exercise image storage using a real large PNG on the isolated candidate only.
import datetime,secrets,uuid,hashlib,base64
c=ns['database'](ns['CANDIDATE']);owner=c.execute('SELECT user_id FROM workbench_owner WHERE id=1').fetchone()[0]
token=secrets.token_urlsafe(32);sid=str(uuid.uuid4());now=datetime.datetime.now(datetime.timezone.utc);stamp=lambda d:d.isoformat(timespec='milliseconds').replace('+00:00','Z')
c.execute('INSERT INTO sessions VALUES(?,?,?,?,?)',(sid,owner,hashlib.sha256(token.encode()).hexdigest(),stamp(now+datetime.timedelta(minutes=15)),stamp(now)));c.commit();cookie='cabinlink_session='+token
http=ns['http'];image=(release/'dist/client/wordbook-background.png').read_bytes();data='data:image/png;base64,'+base64.b64encode(image).decode()
try:
 assert http('/api/personal',8092,{'avatar':data},cookie)[0]!=200 # POST is deliberately unsupported
 import urllib.request
 def put(path,body):
  req=urllib.request.Request('http://127.0.0.1:8092'+path,data=json.dumps(body).encode(),method='PUT',headers={'Cookie':cookie,'Content-Type':'application/json'})
  with urllib.request.urlopen(req,timeout=30) as response:return json.loads(response.read())
 put('/api/personal',{'avatar':data});avatar=json.loads(http('/api/personal',8092,cookie=cookie)[1])['user']['avatar_url']
 assert http(avatar,8092,cookie=cookie)[1]==image;assert http(avatar,8092)[0]==404
 put('/api/personal',{'avatar':''});assert http(avatar,8092,cookie=cookie)[0]==404
 brand=json.loads(http('/api/site-settings',8092,cookie=cookie)[1]);uploaded=put('/api/site-settings',{**brand,'heroBackground':data});assert http(uploaded['heroBackground'],8092)[1]==image;put('/api/site-settings',brand)
 task=json.loads(http('/api/workbench',8092,cookie=cookie)[1])['tasks'][0]
 assert http('/api/workbench',8092,{**task,'action':'save','focus':bool(task['focus']),'poster':data},cookie)[0]==200
 poster=c.execute('SELECT poster FROM workbench_tasks WHERE id=?',(task['id'],)).fetchone()[0];assert http(poster,8092,cookie=cookie)[1]==image;assert http(poster,8092)[0]==404
 assert http('/api/workbench',8092,{**task,'action':'save','focus':bool(task['focus'])},cookie)[0]==200
 print('PASS real R2 large avatar, banner, private poster and cleanup',flush=True)
finally:
 c.execute('DELETE FROM sessions WHERE id=?',(sid,));c.commit();c.close()
