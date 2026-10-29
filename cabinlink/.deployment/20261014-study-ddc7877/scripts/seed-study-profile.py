"""Import an explicitly supplied private profile, retaining the previous version.
The seed file is private deployment data, never an application/public asset.
Existing study settings and an already-imported profile are not overwritten.
"""
import datetime, json, sqlite3, sys, uuid
db_path, seed_path, username = sys.argv[1:4]
with open(seed_path, encoding='utf-8') as handle:
    seed = json.load(handle)
with sqlite3.connect(db_path) as db:
    owner = db.execute("SELECT u.id FROM workbench_owner o JOIN users u ON u.id=o.user_id WHERE o.id=1 AND u.username=? AND u.role='admin' AND u.banned_at IS NULL", (username,)).fetchone()
    if not owner:
        raise RuntimeError('Private owner not configured; no profile changes made')
    user = owner[0]
    intro = seed['introduction']
    if not isinstance(intro, str) or len(intro) > 20000:
        raise RuntimeError('Invalid private introduction')
    profile = db.execute('SELECT introduction FROM workbench_profile WHERE user_id=?', (user,)).fetchone()
    stamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    previous_import = db.execute('SELECT id FROM workbench_profile_history WHERE id=?', (user+':archive-v2-import',)).fetchone()
    if not previous_import:
        db.execute('INSERT INTO workbench_profile_history VALUES(?,?,?,?)', (user+':archive-v2-import',user,profile[0] if profile else '',stamp))
        db.execute('INSERT INTO workbench_profile(user_id,introduction) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET introduction=excluded.introduction', (user,intro))
    if 'config' in seed:
        db.execute('INSERT OR IGNORE INTO study_settings VALUES(?,?,0,?)', (user,json.dumps(seed['config'],ensure_ascii=False),stamp))
    print('Private profile version imported; previous archive and existing study settings retained')
