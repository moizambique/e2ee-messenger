# E2EE Messenger Makefile

.PHONY: help setup dev build test lint format clean infra-up infra-down infra-logs seed

# Default target
help:
	@echo "Available commands:"
	@echo "  setup       - Install dependencies and setup project"
	@echo "  dev         - Start development servers"
	@echo "  build       - Build all projects"
	@echo "  test        - Run all tests"
	@echo "  lint        - Run linters"
	@echo "  format      - Format code"
	@echo "  clean       - Clean build artifacts"
	@echo "  infra-up    - Start infrastructure (Postgres, Adminer)"
	@echo "  infra-down  - Stop infrastructure"
	@echo "  infra-logs  - Show infrastructure logs"
	@echo "  seed        - Seed database with test data"

# Setup project
setup:
	@echo "Setting up project..."
	npm install
	cd app && npm install
	cd ../server && go mod tidy
	@echo "Setup complete!"

# Development
dev:
	@echo "Starting development servers..."
	npm run dev

# Build
build:
	@echo "Building projects..."
	npm run build

# Test
test:
	@echo "Running tests..."
	npm run test

# Lint
lint:
	@echo "Running linters..."
	npm run lint

# Format
format:
	@echo "Formatting code..."
	npm run format

# Clean
clean:
	@echo "Cleaning build artifacts..."
	rm -rf dist/
	rm -rf build/
	rm -rf app/dist/
	rm -rf app/build/
	rm -rf server/bin/
	rm -rf node_modules/
	rm -rf app/node_modules/

# Infrastructure
infra-up:
	@echo "Starting infrastructure..."
	cd infra && docker-compose up -d
	@echo "Infrastructure started!"
	@echo "Postgres: localhost:5432"
	@echo "Adminer: http://localhost:8088"

infra-down:
	@echo "Stopping infrastructure..."
	cd infra && docker-compose down

infra-logs:
	@echo "Showing infrastructure logs..."
	cd infra && docker-compose logs -f

# Database
seed:
	@echo "Seeding database..."
	cd server && go run scripts/seed.go

# Development helpers
dev-server:
	@echo "Starting server only..."
	cd server && go run main.go

dev-app:
	@echo "Starting app only..."
	cd app && npm start

# Production helpers
prod-build:
	@echo "Building for production..."
	npm run build:server
	npm run build:app

prod-start:
	@echo "Starting production server..."
	cd server && ./bin/server
