import fs from 'node:fs';
const file='.deployment/20261013-upgrade-17382f8/deploy.py';let s=fs.readFileSync(file,'utf8');s=s.replace('smoke(CANDIDATE,8092,True)','smoke(CANDIDATE,8092,False)').replace('upgrade_smoke(CANDIDATE,8092,True)','upgrade_smoke(CANDIDATE,8092,False)');fs.writeFileSync(file,s);
