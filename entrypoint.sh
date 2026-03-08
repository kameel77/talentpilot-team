#!/bin/sh
set -e

echo "🔄 Running Prisma migrations..."
./node_modules/.bin/prisma db push --skip-generate --accept-data-loss 2>&1 || npx prisma db push --skip-generate --accept-data-loss 2>&1 || echo "⚠️ Migration skipped"

echo "🌱 Seeding admin user..."
node prisma/seed.js 2>&1 || echo "⚠️ Seed skipped (admin may already exist)"

echo "🚀 Starting application..."
exec node server.js
