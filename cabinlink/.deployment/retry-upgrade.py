import sys,runpy,json,pathlib
tag=sys.argv[1];release=pathlib.Path('/opt/cabinlink/releases')/tag
sys.argv=[str(release/'deploy.py'),'skip']
ns=runpy.run_path(str(release/'deploy.py'))
ns['launch']('cabinlink-candidate-'+tag,ns['CANDIDATE'],'127.0.0.1:8092',json.loads((release/'runtime-config.json').read_text()))
ns['ready'](8092)
ns['seed'](ns['CANDIDATE'])
ns['smoke'](ns['CANDIDATE'],8092,True)
ns['upgrade_smoke'](ns['CANDIDATE'],8092,True)
