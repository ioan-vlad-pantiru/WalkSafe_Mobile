# Welcome to WalkSafe 👋

This is a [React Native](https://reactnative.dev/) mobile application with a Django backend.

## Project Structure

- `frontend/` - React Native mobile application (Expo)
- `backend/` - Django REST API server
- `docker-compose.yml` - Docker orchestration configuration

## Quick Start with Docker (Recommended)

### Prerequisites
- [Docker](https://www.docker.com/get-started) and Docker Compose installed
- [Node.js](https://nodejs.org/) and npm (for running the frontend locally)

### Running the Application

1. **Clone the repository and navigate to the project directory**

   ```bash
   cd WalkSafe
   ```

2. **Start backend services with Docker Compose**

   ```bash
   docker-compose up -d
   ```

   This will start:
   - PostgreSQL database on port 5433
   - Django backend on http://localhost:8000

3. **Run the frontend locally**

   ```bash
   cd frontend
   npm install
   npx expo start
   ```

   The Expo development server will start and you can:
   - Scan the QR code with Expo Go app on your phone
   - Press `i` for iOS simulator
   - Press `a` for Android emulator

4. **Access the services**
   - Backend API: http://localhost:8000
   - Admin Panel: http://localhost:8000/admin
   - Frontend: Expo DevTools in your terminal

5. **Stop the backend services**

   ```bash
   docker-compose down
   ```

   To remove volumes as well:
   ```bash
   docker-compose down -v
   ```

### Migrating Existing Data

If you have an existing PostgreSQL database on your local machine:

```bash
# Quick automated migration
./migrate-data.sh

# Or using Make
make migrate-local-db
```

See `MIGRATION_GUIDE.md` for detailed instructions and alternative methods.

## Development Workflow

### Starting Development

```bash
# Terminal 1: Start backend services
docker-compose up

# Terminal 2: Start frontend
cd frontend
npx expo start
```

### Important Notes

- **Backend runs in Docker** on `localhost:8000`
- **Frontend runs locally** for better Expo/mobile development experience
- Make sure your phone and computer are on the same WiFi network for Expo Go
- The frontend connects to the backend at `localhost:8000` (update in `.env` if needed)

### Important Notes for Mobile Development

When using the frontend container, you'll need to update your local IP address in `docker-compose.yml`:

```yaml
environment:
  - REACT_NATIVE_PACKAGER_HOSTNAME=YOUR_LOCAL_IP  # e.g., 192.168.1.100
```

Find your local IP:
- **macOS/Linux**: `ifconfig | grep "inet " | grep -v 127.0.0.1`
- **Windows**: `ipconfig`

## Manual Setup (Without Docker)

### Frontend

1. Navigate to the frontend directory

   ```bash
   cd frontend
   ```

2. Install dependencies

   ```bash
   npm install
   ```

3. Start the app

   ```bash
   npx expo start
   ```

See `frontend/README.md` for more details.

### Backend

1. Navigate to the backend directory

   ```bash
   cd backend
   ```

2. Create a virtual environment

   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies

   ```bash
   pip install -r requirements.txt
   ```

4. Run migrations

   ```bash
   python manage.py migrate
   ```

5. Create a superuser (optional)

   ```bash
   python manage.py createsuperuser
   ```

6. Run the development server

   ```bash
   python manage.py runserver
   ```

## Environment Variables

Copy the example environment files and update them with your configuration:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

## Learn more

- [Expo documentation](https://docs.expo.dev/)
- [Django documentation](https://docs.djangoproject.com/)
- [Docker documentation](https://docs.docker.com/)
