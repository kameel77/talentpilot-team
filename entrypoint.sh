#!/bin/sh
set -e

echo "🔄 Running Prisma migrations..."
npx prisma db push --skip-generate --accept-data-loss 2>&1 || echo "⚠️ Migration skipped (DB may already be up-to-date)"

echo "🌱 Seeding admin user..."
node prisma/seed.js 2>&1 || echo "⚠️ Seed skipped (admin may already exist)"

echo "🚀 Starting application..."
exec node server.js
