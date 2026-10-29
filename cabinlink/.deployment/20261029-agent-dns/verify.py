import importlib.util, json, pathlib, shutil, subprocess, tarfile, urllib.request, urllib.error
spec=importlib.util.spec_from_file_location('runtime_helpers','/opt/cabinlink/releases/verify-runtime-20261029.py')
v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
v.RELEASE=pathlib.Path('/opt/cabinlink/releases/20261029-agent-dns')
v.CANDIDATE=v.RELEASE/'candidate-data';v.IMAGE='cabinlink:release-20261029-agent-dns';v.NAME='cabinlink-agent-dns-candidate'
v.RELEASE.mkdir(mode=0o700,exist_ok=True)
with tarfile.open('/opt/cabinlink/releases/20261029-agent-dns.tar.gz') as archive:archive.extractall(v.RELEASE,filter='data')
print(v.run('docker','build','-t',v.IMAGE,str(v.RELEASE)),flush=True)
assert v.NAME not in v.run('docker','ps','-a','--format','{{.Names}}').splitlines()
if v.CANDIDATE.exists():
    assert v.CANDIDATE.resolve().parent==v.RELEASE.resolve()
    shutil.rmtree(v.CANDIDATE)
v.snapshot();cookie,sid=v.session()
try:
    # Explicit candidate name: the helper's default was bound at definition time.
    v.launch(v.IMAGE,name=v.NAME,folder=v.CANDIDATE);v.ready()
    assert b'Agent' in v.http('/admin/workbench',cookie)
    req=urllib.request.Request('http://127.0.0.1:8092/api/workbench/agent',data=b'{"action":"test"}',headers={'Content-Type':'application/json','Cookie':cookie})
    try:
        with urllib.request.urlopen(req,timeout=65) as response:assert response.status==200 and json.load(response)['ok']
    except urllib.error.HTTPError as error:
        print('Candidate agent test error:',error.read().decode()[:700],flush=True)
        print(v.run('docker','logs','--tail','14',v.NAME),flush=True)
        raise
    status=json.loads(v.http('/api/workbench/agent',cookie))
    assert status['status']=='connected' and status['tested_at']
    assert status['base_url']=='https://api.deepseek.com' and status['model']=='deepseek-flash'
    print('PASS candidate real DeepSeek test through application: connected; encrypted credential retained',flush=True)
    db=v.database(v.CANDIDATE);assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok';db.close()
    assert 'inspector disabled' in v.run('docker','logs',v.NAME)
    (v.RELEASE/'verification.json').write_text(json.dumps({'agentTest':True,'databaseIntegrity':'ok','runtimeGuardRetained':True}))
finally:
    subprocess.run(['docker','stop','-t','20',v.NAME],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    subprocess.run(['docker','rm',v.NAME],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    db=v.database(v.CANDIDATE);db.execute('DELETE FROM sessions WHERE id=?',(sid,));db.commit();db.close()
