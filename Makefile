.PHONY: help build up down restart logs clean migrate shell superuser test

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

update-ip: ## Auto-detect and update IP address for Expo
	./update-ip.sh

dev: ## Start complete development environment (backend + frontend)
	./start-dev.sh

build: ## Build all Docker images
	docker-compose build

up: ## Start all services
	docker-compose up

up-d: ## Start all services in detached mode
	docker-compose up -d

down: ## Stop all services
	docker-compose down

down-v: ## Stop all services and remove volumes
	docker-compose down -v

restart: ## Restart all services
	docker-compose restart

logs: ## View logs from all services
	docker-compose logs -f

logs-backend: ## View backend logs
	docker-compose logs -f backend

logs-frontend: ## View frontend logs
	docker-compose logs -f frontend

logs-db: ## View database logs
	docker-compose logs -f db

clean: ## Stop services and remove containers, networks, volumes, and images
	docker-compose down -v --rmi all

migrate: ## Run Django migrations
	docker-compose exec backend python manage.py migrate

makemigrations: ## Create Django migrations
	docker-compose exec backend python manage.py makemigrations

shell: ## Open Django shell
	docker-compose exec backend python manage.py shell

dbshell: ## Open database shell
	docker-compose exec db psql -U walksafe_user -d walksafe

superuser: ## Create Django superuser
	docker-compose exec backend python manage.py createsuperuser

collectstatic: ## Collect static files
	docker-compose exec backend python manage.py collectstatic --noinput

test-backend: ## Run backend tests
	docker-compose exec backend python manage.py test

npm-install: ## Install frontend dependencies
	docker-compose exec frontend npm install

expo-clear: ## Clear Expo cache
	docker-compose exec frontend npx expo start -c

backup-db: ## Backup database to backup.sql
	docker-compose exec db pg_dump -U walksafe_user walksafe > backup.sql
	@echo "Database backed up to backup.sql"

restore-db: ## Restore database from backup.sql
	cat backup.sql | docker-compose exec -T db psql -U walksafe_user walksafe
	@echo "Database restored from backup.sql"

migrate-local-db: ## Migrate data from local PostgreSQL to Docker
	./migrate-data.sh

backup-local-db: ## Backup local PostgreSQL database
	@echo "Enter your local database details when prompted..."
	@read -p "Database name [walksafe]: " DB_NAME; \
	read -p "Database user [postgres]: " DB_USER; \
	read -p "Database host [localhost]: " DB_HOST; \
	read -p "Database port [5432]: " DB_PORT; \
	DB_NAME=$${DB_NAME:-walksafe}; \
	DB_USER=$${DB_USER:-postgres}; \
	DB_HOST=$${DB_HOST:-localhost}; \
	DB_PORT=$${DB_PORT:-5432}; \
	BACKUP_FILE="local_backup_$$(date +%Y%m%d_%H%M%S).sql"; \
	pg_dump -h $$DB_HOST -p $$DB_PORT -U $$DB_USER -d $$DB_NAME > $$BACKUP_FILE; \
	echo "Backup saved to $$BACKUP_FILE"

ps: ## Show running containers
	docker-compose ps

rebuild: down build up ## Rebuild and restart all services
