# WalkSafe 🚶

A mobile app for finding safe, healthy walking routes. It combines real-time map navigation with an intelligent routing engine that factors in air quality (AQI), tree cover, traffic, and elevation to suggest the best path between two points.

## Tech Stack

- **Frontend** — React Native (Expo), TypeScript
- **Backend** — Django REST API, PostgreSQL
- **Routing engine** — Python, A\* algorithm, OpenStreetMap graph, AQI & traffic data
- **Infrastructure** — Docker Compose

## Project Structure

```
WalkSafe_Mobile/
├── frontend/          # React Native / Expo app
├── backend/
│   ├── apps/          # Django apps (accounts, routes, tags, reviews)
│   ├── route_backend/ # A* routing engine with GIS & AQI data
│   └── server/        # Django project settings
└── docker-compose.yml
```

## Getting Started

### Prerequisites

- [Docker](https://www.docker.com/get-started) and Docker Compose
- [Node.js](https://nodejs.org/) and npm
- A [Mapbox](https://account.mapbox.com) access token

### 1. Environment variables

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Open `frontend/.env` and fill in your values:

```env
EXPO_PUBLIC_API_URL=http://<your-local-ip>:8000
MAPBOX_ACCESS_TOKEN=<your-mapbox-token>
```

> **Note:** Use your machine's local IP (not `localhost`) so the app can reach the backend from a physical device or emulator.
>
> Find it with:
> - **macOS/Linux**: `ifconfig | grep "inet " | grep -v 127.0.0.1`
> - **Windows**: `ipconfig`

### 2. Start the backend

```bash
docker-compose up -d
```

This starts:
- PostgreSQL on port `5433`
- Django API on `http://localhost:8000`

### 3. Start the frontend

```bash
cd frontend
npm install
npx expo start
```

Then:
- Scan the QR code with **Expo Go** on your phone
- Press `i` for the iOS simulator
- Press `a` for the Android emulator

### 4. Stop the backend

```bash
docker-compose down

# To also remove the database volume:
docker-compose down -v
```

## Manual Setup (Without Docker)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser  # optional
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
npx expo start
```

## Features

- 🗺️ Interactive map with real-time location tracking
- 🧭 Turn-by-turn navigation view
- 🌿 Smart routing based on AQI, tree cover, traffic & elevation
- 🔍 Search and explore saved routes
- 👤 User accounts and profiles
- ⭐ Route reviews
- 📶 Offline mode with automatic sync on reconnect

## API

The Django admin panel is available at `http://localhost:8000/admin`.

## Links

- [Expo documentation](https://docs.expo.dev/)
- [Django documentation](https://docs.djangoproject.com/)
- [Docker documentation](https://docs.docker.com/)
- [Mapbox](https://docs.mapbox.com/)
