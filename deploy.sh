#!/bin/bash
# Deploy script for Metrika app

set -e

echo "🚀 Deploying Metrika..."

# Push to git
echo "📤 Pushing to GitHub..."
git push

# Deploy to server
echo "🔄 Updating server..."
ssh vps-marais2 "cd /home/skull/production/maraisnext && git pull && docker compose up -d --build"

echo "✅ Deploy complete!"
echo "🌐 Site: https://app.marais.ru"
