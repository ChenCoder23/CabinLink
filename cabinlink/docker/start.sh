#!/bin/sh
set -eu

cd /app/dist/server

# Wrangler can keep its local migration process alive after reporting success.
# Bound startup time, then verify that every migration was marked successful.
migration_log=$(mktemp)
if timeout 90s node ../../node_modules/wrangler/bin/wrangler.js d1 migrations apply DB --local --config wrangler.json --persist-to /data >"$migration_log" 2>&1; then
  cat "$migration_log"
elif grep -q 'No migrations to apply!' "$migration_log"; then
  cat "$migration_log"
else
  pending=$(sed -n '/Migrations to be applied:/,/About to apply/p' "$migration_log" | grep -o '[[:digit:]]\{4\}_[[:alnum:]_]*\.sql' || true)
  if [ -z "$pending" ]; then
    cat "$migration_log"
    rm -f "$migration_log"
    echo "Could not verify pending migrations" >&2
    exit 1
  fi
  for name in $pending; do
    if ! grep -F "$name" "$migration_log" | grep -q '✅'; then
      cat "$migration_log"
      rm -f "$migration_log"
      echo "Migration did not complete: $name" >&2
      exit 1
    fi
  done
  cat "$migration_log"
fi
rm -f "$migration_log"

exec node ../../node_modules/wrangler/bin/wrangler.js dev --local --config wrangler.json --persist-to /data --ip 0.0.0.0 --port 80
