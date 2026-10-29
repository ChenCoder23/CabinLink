import importlib.util, json, os, signal, subprocess, time
spec=importlib.util.spec_from_file_location('runtime_verification','/opt/cabinlink/releases/verify-runtime-20261029.py')
v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
results={}
cookie,sid=v.session()
try:
    v.launch(v.IMAGE);v.ready()
    assert b'Agent' in v.http('/admin/workbench',cookie)
    assert 'inspector disabled' in v.run('docker','logs',v.NAME)
    before=v.inspect(v.NAME)['RestartCount']
    workers=[int(row.split()[0]) for row in v.run('docker','top',v.NAME,'-eo','pid,comm').splitlines()[1:] if row.split()[-1]=='workerd']
    assert workers
    os.kill(workers[0],signal.SIGSTOP)
    deadline=time.monotonic()+85
    while time.monotonic()<deadline:
        if v.inspect(v.NAME)['RestartCount']>before:
            v.ready();break
        time.sleep(2)
    else:raise RuntimeError('Automatic restart did not happen')
    assert 'http-health-failed' in v.run('docker','logs',v.NAME)
    assert json.loads(v.http('/api/workbench/study',cookie))['course']
    results['httpRecovery']='PASS stopped workerd detected and container automatically restarted'
    print(results['httpRecovery'],flush=True)
    v.run('docker','stop','-t','20',v.NAME);v.run('docker','rm',v.NAME)
    cfg=v.inspect('cabinlink')
    args=['docker','run','-d','--name',v.NAME,'--memory','1200m','--memory-swap','1500m','-p','127.0.0.1:8092:80','-v',str(v.CANDIDATE)+':/data']
    for value in cfg['Config']['Env']:args+=['-e',value]
    args+=['-e','SERVICE_MEMORY_LIMIT_MIB=1','-e','SERVICE_HEALTH_INTERVAL_MS=2000','-e','SERVICE_STARTUP_GRACE_MS=30000']
    args+=['--workdir','/app/dist/server','--entrypoint','node']
    v.run(*args,v.IMAGE,'../../scripts/start-production.mjs')
    deadline=time.monotonic()+80
    while time.monotonic()<deadline and v.inspect(v.NAME)['State']['Running']:time.sleep(2)
    state=v.inspect(v.NAME)
    assert not state['State']['Running'] and state['State']['ExitCode']==1
    assert 'memory-budget-exceeded' in v.run('docker','logs',v.NAME)
    results['memoryRecovery']='PASS memory budget exits PID 1 with code 1'
    print(results['memoryRecovery'],flush=True)
    db=v.database(v.CANDIDATE);assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok';db.close()
    results['databaseIntegrity']='ok'
    (v.RELEASE/'verification.json').write_text(json.dumps(results,indent=2))
finally:
    subprocess.run(['docker','stop','-t','20',v.NAME],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    subprocess.run(['docker','rm',v.NAME],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    db=v.database(v.CANDIDATE);db.execute('DELETE FROM sessions WHERE id=?',(sid,));db.commit();db.close()
