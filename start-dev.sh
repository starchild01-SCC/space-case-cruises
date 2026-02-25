#!/bin/bash

# Space Case Cruises - Development Server Launcher
# Starts both the Express API and Vite UI in parallel

set -e

echo "🚀 Starting Space Case Cruises development environment..."
echo ""

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing root dependencies..."
  npm install
fi

if [ ! -d "ui/node_modules" ]; then
  echo "📦 Installing UI dependencies..."
  cd ui
  npm install --cache .npm-cache
  cd ..
fi

echo ""
echo "🎯 Launching servers..."
echo "   API: http://localhost:4000"
echo "   UI: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Start API server in background
npm run dev &
API_PID=$!

# Start UI server in background
(cd ui && npm run dev) &
UI_PID=$!

# Handle cleanup on exit
cleanup() {
  echo ""
  echo "🛑 Shutting down servers..."
  kill $API_PID 2>/dev/null || true
  kill $UI_PID 2>/dev/null || true
  wait $API_PID 2>/dev/null || true
  wait $UI_PID 2>/dev/null || true
  echo "✅ Servers stopped"
}

trap cleanup EXIT

# Wait for both processes
wait
