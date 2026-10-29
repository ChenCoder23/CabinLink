import pathlib,subprocess,sys,os
root=pathlib.Path('/opt/cabinlink/releases')/sys.argv[1]
for process in pathlib.Path('/proc').glob('[0-9]*/cmdline'):
 try:
  command=process.read_bytes()
  if bytes(str(root/'deploy.py'),'utf8') in command and b'promote' in command:raise RuntimeError('Promotion already running')
 except (FileNotFoundError,PermissionError):pass
log=root/'promote.log';descriptor=os.open(log,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
with os.fdopen(descriptor,'w') as output:
 child=subprocess.Popen(['python3',str(root/'deploy.py'),'promote'],stdout=output,stderr=subprocess.STDOUT,stdin=subprocess.DEVNULL,start_new_session=True)
print('Promotion started',child.pid)
