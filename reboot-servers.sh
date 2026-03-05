#!/bin/bash

# Reboot API server
cd ~/space-case-cruises || exit 1
echo "Restarting API server..."
pkill -f start-dev.sh
./start-dev.sh &

# Reboot UI server
cd ~/space-case-cruises/ui || exit 1
echo "Restarting UI server..."
pkill -f vite
npm run dev &

echo "Both servers rebooted."
