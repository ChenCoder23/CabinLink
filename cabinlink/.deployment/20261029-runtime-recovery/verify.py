import concurrent.futures, datetime, hashlib, json, os, pathlib, secrets, shutil, signal, sqlite3, subprocess, tarfile, time, urllib.request, uuid

RELEASE = pathlib.Path('/opt/cabinlink/releases/20261029-runtime-recovery')
DATA = pathlib.Path('/var/lib/docker/volumes/cabinlink_data/_data')
CANDIDATE = RELEASE / 'candidate-data'
IMAGE = 'cabinlink:release-20261029-runtime-recovery'
NAME = 'cabinlink-runtime-candidate'

def run(*args): return subprocess.check_output(args, text=True, stderr=subprocess.STDOUT).strip()
def inspect(name): return json.loads(run('docker', 'inspect', name))[0]
def database(folder):
    for path in folder.glob('v3/d1/**/*.sqlite'):
        db = sqlite3.connect(path, timeout=20)
        if db.execute("SELECT 1 FROM sqlite_master WHERE name='users'").fetchone(): return db
        db.close()
    raise RuntimeError('Application database missing')

def snapshot():
    if CANDIDATE.exists(): raise RuntimeError('Candidate folder already exists')
    shutil.copytree(DATA, CANDIDATE, ignore=lambda folder,names:[name for name in names if name.endswith(('.sqlite','-wal','-shm'))])
    for path in DATA.glob('v3/d1/**/*.sqlite'):
        target=CANDIDATE/path.relative_to(DATA);target.parent.mkdir(parents=True,exist_ok=True)
        source=sqlite3.connect('file:'+str(path)+'?mode=ro',uri=True,timeout=20)
        dest=sqlite3.connect(target);source.backup(dest)
        assert dest.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
        source.close();dest.close();target.chmod(0o600)

def launch(image, name=NAME, port=8092, folder=CANDIDATE, fast=True):
    cfg=inspect('cabinlink')
    args=['docker','run','-d','--name',name,'--restart','unless-stopped','--memory','1200m','--memory-swap','1500m','--log-opt','max-size=10m','--log-opt','max-file=3','-p','127.0.0.1:'+str(port)+':80','-v',str(folder)+':/data']
    for value in cfg['Config']['Env']:args+=['-e',value]
    if fast: args+=['-e','SERVICE_HEALTH_INTERVAL_MS=2000','-e','SERVICE_HEALTH_TIMEOUT_MS=1000','-e','SERVICE_STARTUP_GRACE_MS=30000']
    # The copy already has all production migrations. Bypass the separate
    # migration CLI during fault tests so its known 90-second shutdown wait
    # cannot hide the supervisor behavior being exercised.
    if image==IMAGE:
        args+=['--workdir','/app/dist/server','--entrypoint','node']
        return run(*args,image,'../../scripts/start-production.mjs')
    return run(*args,image)

def http(path, cookie='', port=8092):
    req=urllib.request.Request('http://127.0.0.1:'+str(port)+path,headers={'Cookie':cookie})
    with urllib.request.urlopen(req,timeout=10) as response:
        assert response.status==200
        return response.read()

def ready(port=8092):
    deadline=time.monotonic()+100
    while time.monotonic()<deadline:
        try:
            assert json.loads(http('/api/site-settings',port=port))['desktopTitle']
            return
        except Exception: time.sleep(1)
    raise RuntimeError('Readiness timeout')

def rss(name=NAME):
    pids=[row.split()[0] for row in run('docker','top',name,'-eo','pid').splitlines()[1:]]
    total=0
    for pid in pids:
        try:
            for line in pathlib.Path('/proc/'+pid+'/status').read_text().splitlines():
                if line.startswith('VmRSS:'):total+=int(line.split()[1])
        except FileNotFoundError:pass
    return round(total/1024,1)

def load(cookie,count):
    start=time.monotonic()
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        sizes=list(pool.map(lambda _:len(http('/api/workbench/study',cookie)),range(count)))
    return {'requests':count,'responseBytes':sizes[0],'seconds':round(time.monotonic()-start,1),'rssMiB':rss()}

def session():
    db=database(CANDIDATE);owner=db.execute('SELECT user_id FROM workbench_owner WHERE id=1').fetchone()[0]
    token=secrets.token_urlsafe(32);sid=str(uuid.uuid4());now=datetime.datetime.now(datetime.timezone.utc)
    stamp=lambda value:value.isoformat(timespec='milliseconds').replace('+00:00','Z')
    db.execute('INSERT INTO sessions VALUES(?,?,?,?,?)',(sid,owner,hashlib.sha256(token.encode()).hexdigest(),stamp(now+datetime.timedelta(hours=1)),stamp(now)))
    db.commit();db.close();return 'cabinlink_session='+token,sid

def verify():
    RELEASE.mkdir(mode=0o700,exist_ok=True)
    with tarfile.open('/opt/cabinlink/releases/20261029-runtime-recovery.tar.gz') as archive:archive.extractall(RELEASE,filter='data')
    run('docker','build','-t',IMAGE,str(RELEASE))
    print('PASS runtime-only image built; application bundle unchanged',flush=True)
    snapshot();cookie,sid=session();results={}
    try:
        launch(inspect('cabinlink')['Config']['Image']);ready()
        results['before']={'initialRssMiB':rss(),'batch':load(cookie,300)}
        print('Baseline:',json.dumps(results['before']),flush=True)
        run('docker','stop','-t','20',NAME);run('docker','rm',NAME)
        launch(IMAGE);ready()
        assert b'Agent' in http('/admin/workbench',cookie)
        results['after']={'initialRssMiB':rss(),'batches':[]}
        for _ in range(3):
            results['after']['batches'].append(load(cookie,300))
            print('Patched load:',json.dumps(results['after']['batches'][-1]),flush=True)
        logs=run('docker','logs',NAME)
        assert 'inspector disabled' in logs
        assert 'Network.dataReceived' not in logs
        # A stopped workerd reproduces an alive container with a dead HTTP server.
        state=inspect(NAME);before=state['RestartCount'];started=state['State']['StartedAt']
        workers=[int(row.split()[0]) for row in run('docker','top',NAME,'-eo','pid,comm').splitlines()[1:] if row.split()[-1]=='workerd']
        assert workers
        os.kill(workers[0],signal.SIGSTOP)
        deadline=time.monotonic()+85
        while time.monotonic()<deadline:
            state=inspect(NAME)
            if state['RestartCount']>before and state['State']['StartedAt']!=started:
                ready();break
            time.sleep(2)
        else: raise RuntimeError('Supervisor did not recover stopped workerd')
        assert 'http-health-failed' in run('docker','logs',NAME)
        assert json.loads(http('/api/workbench/study',cookie))['course']
        results['httpRecovery']='PASS stopped workerd detected and container automatically restarted'
        print(results['httpRecovery'],flush=True)
        # Exercise real RSS guard without allocating dangerous amounts of RAM.
        run('docker','stop','-t','20',NAME);run('docker','rm',NAME)
        launch(IMAGE,fast=False)
        ready()
        # A separate one-shot candidate uses a low test-only budget and no restart loop.
        run('docker','stop','-t','20',NAME);run('docker','rm',NAME)
        cfg=inspect('cabinlink');args=['docker','run','-d','--name',NAME,'-p','127.0.0.1:8092:80','-v',str(CANDIDATE)+':/data']
        for value in cfg['Config']['Env']:args+=['-e',value]
        args+=['-e','SERVICE_MEMORY_LIMIT_MIB=1','-e','SERVICE_HEALTH_INTERVAL_MS=2000','-e','SERVICE_STARTUP_GRACE_MS=30000']
        run(*args,IMAGE)
        deadline=time.monotonic()+65
        while time.monotonic()<deadline and inspect(NAME)['State']['Running']:time.sleep(2)
        state=inspect(NAME)
        assert not state['State']['Running'] and state['State']['ExitCode']==1
        assert 'memory-budget-exceeded' in run('docker','logs',NAME)
        results['memoryRecovery']='PASS memory budget exits PID 1 with code 1'
        print(results['memoryRecovery'],flush=True)
        db=database(CANDIDATE);assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok';db.close()
        results['databaseIntegrity']='ok'
        (RELEASE/'verification.json').write_text(json.dumps(results,indent=2));print(json.dumps(results),flush=True)
    finally:
        subprocess.run(['docker','stop','-t','20',NAME],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        subprocess.run(['docker','rm',NAME],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        db=database(CANDIDATE);db.execute('DELETE FROM sessions WHERE id=?',(sid,));db.commit();db.close()

if __name__=='__main__':verify()
