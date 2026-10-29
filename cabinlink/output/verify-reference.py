import runpy,sys
sys.argv=['deploy.py','verify-only']
s=runpy.run_path('/opt/cabinlink/releases/20261014-reference-73a8070/deploy.py')
s['smoke'](s['CANDIDATE'],8092,False)
s['upgrade_smoke'](s['CANDIDATE'],8092,False)
for url in ['/wordbook','/dashboard-illustrations.png']:
    assert s['http'](url,8092)[0]==200
print('PASS all candidate verification complete',flush=True)
