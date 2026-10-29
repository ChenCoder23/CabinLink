import sqlite3,pathlib,json,time
root=pathlib.Path('/opt/cabinlink/releases/20261014-study-887f81a/candidate-data')
for file in root.glob('v3/d1/**/*.sqlite'):
    db=sqlite3.connect(file)
    if db.execute("SELECT 1 FROM sqlite_master WHERE name='study_settings'").fetchone():break
    db.close()
owner=db.execute('SELECT user_id FROM workbench_owner WHERE id=1').fetchone()[0]
config=json.loads(db.execute('SELECT config_json FROM study_settings WHERE user_id=?',(owner,)).fetchone()[0]);config['enabled']=True;config['generation_time']='00:00'
db.execute('UPDATE study_settings SET config_json=? WHERE user_id=?',(json.dumps(config),owner));db.execute('DELETE FROM study_plans WHERE user_id=?',(owner,));db.commit()
for attempt in range(38):
    count=db.execute('SELECT COUNT(*) FROM study_plans WHERE user_id=?',(owner,)).fetchone()[0]
    if count==14:break
    time.sleep(2)
else:raise RuntimeError('Independent study scheduler did not create plans')
assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
db.close();print('PASS independent service generated 14 study plans without page access or generation API',flush=True)
