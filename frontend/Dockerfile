# Use Node.js LTS version
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install Expo CLI globally
RUN npm install -g expo-cli @expo/ngrok

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy project files
COPY . .

# Expose Metro bundler port and Expo dev server
EXPOSE 8081 19000 19001 19002

# Set environment variable for Expo
ENV EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0

# Start Expo
CMD ["npx", "expo", "start", "--tunnel"]
