#!/bin/bash

# WalkSafe Development Startup Script

set -e

echo "🚀 Starting WalkSafe Development Environment"
echo "==========================================="
echo ""

# Detect IP
echo "🔍 Detecting local IP..."
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)

if [ -z "$LOCAL_IP" ]; then
    echo "❌ Could not detect local IP address"
    exit 1
fi

echo "✅ IP: $LOCAL_IP"
echo ""

# Update configuration
echo "📝 Updating configuration files..."
./update-ip.sh > /dev/null 2>&1
echo "✅ Configuration updated"
echo ""

# Check Docker
echo "🐳 Checking Docker services..."
if ! docker-compose ps | grep -q "walksafe-backend"; then
    echo "⚠️  Backend not running. Starting Docker services..."
    docker-compose up -d
    echo "⏳ Waiting for backend to be ready..."
    sleep 5
fi

# Verify backend is accessible
echo "🔍 Verifying backend connectivity..."
if curl -s -o /dev/null -w "%{http_code}" "http://${LOCAL_IP}:8000/api/token/" | grep -q "405\|200"; then
    echo "✅ Backend is accessible at http://${LOCAL_IP}:8000"
else
    echo "❌ Backend not accessible. Check Docker logs: docker-compose logs backend"
    exit 1
fi

echo ""
echo "==========================================="
echo "✅ Setup complete!"
echo ""
echo "📱 Backend API: http://${LOCAL_IP}:8000"
echo ""
echo "Starting Expo..."
echo "==========================================="
echo ""

# Start Expo
cd frontend
npx expo start --clear
