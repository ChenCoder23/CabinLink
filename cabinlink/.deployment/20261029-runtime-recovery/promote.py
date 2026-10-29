import datetime, hashlib, json, pathlib, sqlite3, subprocess, tarfile, time, urllib.request

ROOT=pathlib.Path('/opt/cabinlink/releases/20261029-runtime-recovery')
DATA=pathlib.Path('/var/lib/docker/volumes/cabinlink_data/_data')
IMAGE='cabinlink:release-20261029-runtime-recovery'
PREVIOUS='cabinlink-prev-20261029-runtime-recovery'
def run(*args):return subprocess.check_output(args,text=True).strip()
def inspect(name):return json.loads(run('docker','inspect',name))[0]
def fingerprint():
    result={}
    for path in DATA.glob('v3/d1/**/*.sqlite'):
        db=sqlite3.connect('file:'+str(path)+'?mode=ro',uri=True)
        assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
        tables=[row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
        result[str(path.relative_to(DATA))]={}
        for table in tables:
            rows=db.execute('SELECT * FROM "'+table.replace('"','""')+'"').fetchall()
            # Private data stays in memory; evidence contains only hashes/counts.
            encoded=sorted(json.dumps(row,default=lambda b:b.hex(),ensure_ascii=False) for row in rows)
            result[str(path.relative_to(DATA))][table]={'rows':len(rows),'sha256':hashlib.sha256('\n'.join(encoded).encode()).hexdigest()}
        db.close()
    return result
def ready():
    deadline=time.monotonic()+110
    while time.monotonic()<deadline:
        try:
            with urllib.request.urlopen('http://127.0.0.1/api/site-settings',timeout=5) as response:
                assert response.status==200 and json.load(response)['desktopTitle']
            return
        except Exception:time.sleep(1)
    raise RuntimeError('Production readiness timeout')

verification=json.loads((ROOT/'verification.json').read_text())
assert verification['databaseIntegrity']=='ok' and verification['httpRecovery'].startswith('PASS') and verification['memoryRecovery'].startswith('PASS')
cfg=inspect('cabinlink')
assert cfg['Config']['Image']=='cabinlink:release-20261014-outline-175'
assert not any(e.startswith('SERVICE_') for e in cfg['Config']['Env'])
timestamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
backup=pathlib.Path('/opt/cabinlink/backups')/('data-before-runtime-recovery-'+timestamp+'.tar.gz')
print('Stopping previous runtime for a consistent backup and replacement',flush=True)
run('docker','stop','-t','20','cabinlink')
before=fingerprint()
with tarfile.open(backup,'w:gz') as archive:archive.add(DATA,arcname='data')
backup.chmod(0o600)
with tarfile.open(backup) as archive:assert len(archive.getmembers())>10
(ROOT/'before-fingerprints.json').write_text(json.dumps(before,indent=2));(ROOT/'before-fingerprints.json').chmod(0o600)
print('Backup:',backup,flush=True)
renamed=False;created=False
try:
    run('docker','rename','cabinlink',PREVIOUS);renamed=True
    args=['docker','run','-d','--name','cabinlink','--restart','unless-stopped','--memory','1200m','--memory-swap','1500m','--log-opt','max-size=10m','--log-opt','max-file=3']
    for port,bindings in cfg['HostConfig']['PortBindings'].items():
        for binding in bindings:args+=['-p',(binding['HostIp']+':' if binding['HostIp'] else '')+binding['HostPort']+':'+port]
    for mount in cfg['Mounts']:
        assert mount['Type']=='volume' and mount['Destination']=='/data'
        args+=['-v',mount['Name']+':'+mount['Destination']]
    for value in cfg['Config']['Env']:args+=['-e',value]
    run(*args,IMAGE);created=True
    ready()
    # The scheduler may publish legitimately due work; compare all sensitive
    # business/profile/progress tables, while preserving changes from active users.
    after=fingerprint()
    protected=['users','cabinets','themes','files','workbench_owner','workbench_profile','workbench_tasks','study_settings','study_courses','study_plans','study_progress','study_records','study_agent_config']
    mismatches=[]
    for database,tables in before.items():
        for table in protected:
            if table in tables and tables[table]!=after[database].get(table):mismatches.append(table)
    if mismatches:raise RuntimeError('Protected data changed during runtime-only replacement: '+','.join(mismatches))
    logs=run('docker','logs','cabinlink')
    assert 'inspector disabled' in logs
    (ROOT/'after-fingerprints.json').write_text(json.dumps(after,indent=2));(ROOT/'after-fingerprints.json').chmod(0o600)
    print('PASS all protected business, workbench, settings, plans, progress and encrypted-key data unchanged',flush=True)
    print('PASS production HTTP/SQLite readiness; inspector disabled; rollback retained:',PREVIOUS,flush=True)
except Exception:
    if created:subprocess.run(['docker','rm','-f','cabinlink'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    if renamed:run('docker','rename',PREVIOUS,'cabinlink')
    run('docker','start','cabinlink')
    print('Replacement failed; previous runtime restored. Backup retained.',flush=True)
    raise
