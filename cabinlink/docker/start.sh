#!/bin/sh
set -eu

cd /app/dist/server
node ../../node_modules/wrangler/bin/wrangler.js d1 migrations apply DB --local --config wrangler.json --persist-to /data
exec node ../../node_modules/wrangler/bin/wrangler.js dev --local --config wrangler.json --persist-to /data --ip 0.0.0.0 --port 80
