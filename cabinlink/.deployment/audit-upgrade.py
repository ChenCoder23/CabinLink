import json,subprocess,sqlite3,pathlib,urllib.request,urllib.error
cfg=json.loads(subprocess.check_output(['docker','inspect','cabinlink'],text=True))[0]
values=dict(item.split('=',1) for item in cfg['Config']['Env'] if '=' in item)
print('mail_configuration_present',all(values.get(k) for k in ['RESEND_API_KEY','RESEND_FROM_EMAIL','EMAIL_CODE_SECRET']))
print('restart_count',cfg['RestartCount'])
for file in pathlib.Path('/var/lib/docker/volumes/cabinlink_data/_data').glob('v3/d1/**/*.sqlite'):
 c=sqlite3.connect(file)
 if c.execute("SELECT COUNT(*) FROM sqlite_master WHERE name='workbench_owner'").fetchone()[0]:
  print('owner_binding_matches',bool(c.execute("SELECT 1 FROM workbench_owner o JOIN users u ON u.id=o.user_id WHERE o.id=1 AND u.username=?",('chenhuichuangChc2324',)).fetchone()))
  print('private_nodes',c.execute('SELECT COUNT(*),MAX(progress) FROM workbench_tasks').fetchone())
  print('scheduled_libraries',c.execute('SELECT COUNT(*) FROM word_libraries').fetchone()[0])
  print('database_integrity',c.execute('PRAGMA integrity_check').fetchone()[0]);c.close();break
 c.close()
for path in ['/','/wordbook','/workbench','/api/auth/session','/api/workbench']:
 try:
  with urllib.request.urlopen('http://127.0.0.1'+path,timeout=10) as r:print(path,r.status)
 except urllib.error.HTTPError as e:print(path,e.code)
