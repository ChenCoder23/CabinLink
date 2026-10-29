import subprocess,os,pathlib
root=pathlib.Path('/opt/cabinlink/releases/20261014-study-887f81a')
fd=os.open(root/'timer.log',os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
with os.fdopen(fd,'w') as log:
    child=subprocess.Popen(['python3',str(root/'check-study-timer.py')],stdout=log,stderr=subprocess.STDOUT,stdin=subprocess.DEVNULL,start_new_session=True)
print('Timer verification started',child.pid)
