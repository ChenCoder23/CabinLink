import runpy,sys
sys.argv=['deploy.py','audit']
n=runpy.run_path('/opt/cabinlink/releases/20261014-outline-175/deploy.py')
n['study_smoke'](n['DATA'],80,False)
print('LIVE DATA',n['summary'](n['DATA']),flush=True)
c=n['database'](n['DATA'])
row=c.execute('SELECT config_json FROM study_settings WHERE user_id=(SELECT user_id FROM workbench_owner WHERE id=1)').fetchone()
config=n['json'].loads(row[0]); print('COUNTDOWN',config.get('exam_date') or config.get('target_month'), 'enabled',config['enabled'],'confirmed',config['confirmed'],flush=True)
c.close()
