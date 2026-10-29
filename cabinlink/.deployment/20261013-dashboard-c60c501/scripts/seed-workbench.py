"""Run on the deployment host with an absolute SQLite path and private JSON seed.
Never logs the seed, user identifier, or introduction; existing edits are preserved.
"""
import json, sqlite3, sys
db_path, seed_path, username = sys.argv[1:4]
with open(seed_path, encoding='utf-8') as handle:
    seed = json.load(handle)
with sqlite3.connect(db_path) as db:
    owner = db.execute('SELECT user_id FROM workbench_owner WHERE id=1').fetchone()
    user = db.execute('SELECT id FROM users WHERE username=? AND banned_at IS NULL', (username,)).fetchone()
    if not user:
        raise RuntimeError('Requested account is missing or banned; workbench remains closed')
    if owner and owner[0] != user[0]:
        raise RuntimeError('Existing private workbench owner differs; no changes made')
    db.execute('INSERT OR IGNORE INTO workbench_owner(id,user_id) VALUES(1,?)', (user[0],))
    profile = db.execute('SELECT introduction FROM workbench_profile WHERE user_id=?', (user[0],)).fetchone()
    if profile and profile[0]:
        print('Existing private profile preserved')
        sys.exit(0)
    db.execute('INSERT INTO workbench_profile(user_id,introduction) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET introduction=excluded.introduction', (user[0],seed['introduction']))
    for index, task in enumerate(seed['tasks']):
        db.execute('INSERT OR IGNORE INTO workbench_tasks(id,user_id,kind,title,description,criteria,sort_order) VALUES(?,?,?,?,?,?,?)', (f'{user[0]}:seed:{index}',user[0],*task,index))
    print('Private workbench seeded; all initial progress remains zero')
