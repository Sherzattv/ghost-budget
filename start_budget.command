#!/bin/bash
cd "$(dirname "$0")"
echo "🚀 Ghost Budget Engine Starting..."
echo "📂 Serving: $(pwd)/public"
echo "🌐 URL: http://localhost:8080"

# Open Browser (Mac)
# Open Browser (Mac) with Cache Busting
open "http://localhost:8080/?v=$(date +%s)"

# Start Server
npx -y serve public -l 8080
