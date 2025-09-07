# E2EE Messenger - Setup Guide

This guide will help you set up and run the E2EE Messenger project locally.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **Go** (v1.22 or higher) - [Download here](https://golang.org/dl/)
- **Docker Desktop** - [Download here](https://www.docker.com/products/docker-desktop/)
- **Expo CLI** - Install with `npm install -g @expo/cli`

## Quick Start

### 1. Clone and Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd e2ee-messenger

# Install dependencies
npm run setup
```

### 2. Start Infrastructure

```bash
# Start PostgreSQL and Adminer
npm run infra:up
```

This will start:
- PostgreSQL database on `localhost:5432`
- Adminer (database admin) on `http://localhost:8081`

### 3. Seed Database (Optional)

```bash
# Add test users and sample data
cd server && go run scripts/seed.go
```

### 4. Start Development Servers

```bash
# Start both server and app
npm run dev
```

This will start:
- Go server on `http://localhost:8080`
- React Native app (Expo)

### 5. Run the App

- Install **Expo Go** app on your phone
- Scan the QR code from the terminal
- Or run on simulator: `npm run dev:app`

## Detailed Setup

### Backend Setup

1. **Environment Configuration**
   ```bash
   cd server
   cp env.example .env
   ```

2. **Database Setup**
   ```bash
   # Start PostgreSQL
   npm run infra:up
   
   # The database will be automatically created and migrated
   ```

3. **Run Server**
   ```bash
   npm run dev:server
   ```

### Frontend Setup

1. **Install Dependencies**
   ```bash
   cd app
   npm install
   ```

2. **Start App**
   ```bash
   npm start
   ```

## Project Structure

```
e2ee-messenger/
├── app/                    # React Native (Expo) client
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── screens/        # App screens
│   │   ├── navigation/     # Navigation configuration
│   │   ├── store/          # Zustand state management
│   │   ├── services/       # API and WebSocket services
│   │   ├── crypto/         # E2EE crypto module
│   │   ├── types/          # TypeScript type definitions
│   │   └── utils/          # Utility functions
├── server/                 # Go backend server
│   ├── internal/
│   │   ├── config/         # Configuration management
│   │   ├── database/       # Database models and migrations
│   │   ├── handlers/       # HTTP request handlers
│   │   ├── middleware/     # Authentication middleware
│   │   ├── models/         # Data models
│   │   └── websocket/      # WebSocket hub and client
│   └── scripts/            # Database seed scripts
├── infra/                  # Infrastructure configuration
│   ├── docker-compose.yml  # PostgreSQL and Adminer
│   └── init.sql           # Database initialization
└── package.json           # Root package.json with scripts
```

## Available Scripts

### Root Level
- `npm run dev` - Start both server and app
- `npm run dev:server` - Start server only
- `npm run dev:app` - Start app only
- `npm run build` - Build both projects
- `npm run test` - Run all tests
- `npm run lint` - Run linters
- `npm run format` - Format code
- `npm run setup` - Install all dependencies

### Infrastructure
- `npm run infra:up` - Start PostgreSQL and Adminer
- `npm run infra:down` - Stop infrastructure
- `npm run infra:logs` - View infrastructure logs

## Configuration

### Server Configuration

Edit `server/.env`:

```env
PORT=8080
ENVIRONMENT=development
DATABASE_URL=postgres://postgres:password@localhost:5432/e2ee_messenger?sslmode=disable
JWT_SECRET=your-secret-key-change-in-production
WS_ORIGIN=http://localhost:3000
```

### App Configuration

The app automatically detects development mode and points to `http://localhost:8080` for the API.

For production, update the API URL in `app/src/services/api.ts`:

```typescript
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:8080/v1' 
  : 'https://your-production-api.com/v1';
```

## Testing

### Run All Tests
```bash
npm run test
```

### Server Tests
```bash
cd server
go test ./...
```

### App Tests
```bash
cd app
npm test
```

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```bash
   npm run infra:down
   npm run infra:up
   ```

2. **App Can't Connect to Server**
   - Check server is running: `npm run dev:server`
   - Verify API URL in `app/src/services/api.ts`
   - Check firewall settings

3. **Expo App Won't Load**
   ```bash
   cd app
   npx expo start --clear
   ```

4. **Go Module Issues**
   ```bash
   cd server
   go mod tidy
   go mod download
   ```

### Debug Mode

Enable debug logging by setting environment variables:
```bash
export DEBUG=1
export LOG_LEVEL=debug
```

## Features

### Current Features
- ✅ User authentication (signup/login)
- ✅ End-to-end encryption (mock implementation)
- ✅ Real-time messaging via WebSocket
- ✅ Contact management
- ✅ Key verification system
- ✅ Modern React Native UI
- ✅ Secure key storage
- ✅ Message history
- ✅ Responsive design

### Planned Features
- 🔄 Group chats
- 🔄 File attachments
- 🔄 Voice messages
- 🔄 Video calls
- 🔄 Message reactions
- 🔄 Push notifications

## Security Notes

⚠️ **Important**: This is a demonstration project with a simplified crypto implementation. For production use:

1. Replace the mock crypto with a proper Signal-style library
2. Implement proper key rotation
3. Add key backup/recovery mechanisms
4. Use production-grade security practices

## Support

For questions and support:
- Check the troubleshooting section
- Review the API documentation
- Create an issue in the repository

## License

This project is licensed under the MIT License.
