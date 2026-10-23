#!/bin/sh
set -e

echo "[AFK OS ENTRYPOINT] Starting AFK THEORY Business OS..."

# Run database migrations and first-run initialization
node /app/scripts/init-db.cjs

echo "[AFK OS ENTRYPOINT] Database ready. Starting Next.js standalone server..."
exec node server.js
