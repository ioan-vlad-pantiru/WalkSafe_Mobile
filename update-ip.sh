#!/bin/bash

# Auto-configure IP address for Expo development

echo "🔍 Detecting your local IP address..."

# Get the current local IP (excluding localhost)
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)

if [ -z "$LOCAL_IP" ]; then
    echo "❌ Could not detect local IP address"
    exit 1
fi

echo "✅ Detected IP: $LOCAL_IP"
echo ""

# Update app.json
echo "📝 Updating frontend/app.json..."
sed -i '' "s|\"API_BASE_URL\": \"http://[0-9.]*:8000/\"|\"API_BASE_URL\": \"http://$LOCAL_IP:8000/\"|g" frontend/app.json

# Update .env if it exists
if [ -f "frontend/.env" ]; then
    echo "📝 Updating frontend/.env..."
    sed -i '' "s|EXPO_PUBLIC_API_URL=http://[0-9.]*:8000|EXPO_PUBLIC_API_URL=http://$LOCAL_IP:8000|g" frontend/.env
else
    echo "📝 Creating frontend/.env..."
    cat > frontend/.env << EOF
# API Configuration
# Your local machine IP address (so your phone can connect)
EXPO_PUBLIC_API_URL=http://$LOCAL_IP:8000
EOF
fi

echo ""
echo "✅ Configuration updated successfully!"
echo ""
echo "📱 Your API URL is now: http://$LOCAL_IP:8000"
echo ""
echo "Next steps:"
echo "  1. Restart Expo: cd frontend && npx expo start -c"
echo "  2. Scan the QR code with your phone"
echo ""
