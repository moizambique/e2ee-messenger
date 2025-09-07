# E2EE Messenger

A production-ready, privacy-first end-to-end encrypted messaging application built with React Native (Expo) and Go.

## 🚀 Features

- **End-to-End Encryption**: Signal-style X3DH + Double Ratchet protocol
- **Real-time Messaging**: WebSocket-based live messaging with auto-reconnect
- **Key Verification**: Safety number verification for contact identity
- **Secure Storage**: Private keys stored in device keychain/secure storage
- **Modern UI**: Clean, intuitive interface with React Native
- **Production Ready**: Comprehensive testing, linting, and error handling

## 🏗️ Architecture

### Monorepo Structure
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
└── Makefile               # Development commands
```

## 🛠️ Tech Stack

### Frontend (React Native)
- **Framework**: Expo SDK 50
- **Language**: TypeScript
- **State Management**: Zustand + React Query
- **Navigation**: React Navigation 6
- **Crypto**: Custom Signal-style E2EE implementation
- **Storage**: Expo SecureStore for private keys
- **UI**: Custom components with React Native

### Backend (Go)
- **Language**: Go 1.22+
- **Router**: Chi router
- **Database**: PostgreSQL with migrations
- **Authentication**: JWT with Argon2id password hashing
- **WebSocket**: nhooyr/websocket for real-time communication
- **Testing**: Table-driven tests

### Infrastructure
- **Database**: PostgreSQL 15
- **Containerization**: Docker Compose
- **Database Admin**: Adminer
- **Development**: Makefile for common tasks

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm 9+
- Go 1.22+
- Docker and Docker Compose
- Expo CLI (`npm install -g @expo/cli`)

### 1. Clone and Setup
```bash
git clone <repository-url>
cd e2ee-messenger
make setup
```

### 2. Start Infrastructure
```bash
make infra-up
```
This starts PostgreSQL on `localhost:5432` and Adminer on `http://localhost:8081`

### 3. Seed Database
```bash
make seed
```
Creates test users (alice@example.com, bob@example.com) with sample messages.

### 4. Start Development Servers
```bash
make dev
```
This starts both the Go server (port 8080) and React Native app.

### 5. Run the App
- Install Expo Go app on your phone
- Scan the QR code from the terminal
- Or run on simulator: `make dev-app`

## 📱 App Configuration

### Pointing App to Local Server
The app automatically detects development mode and points to `http://localhost:8080` for the API.

For production, update the API URL in `app/src/services/api.ts`:
```typescript
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:8080/v1' 
  : 'https://your-production-api.com/v1';
```

### Environment Variables
Create `server/.env` from `server/env.example`:
```bash
cp server/env.example server/.env
```

Key variables:
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT tokens (change in production!)
- `PORT`: Server port (default: 8080)

## 🔐 Security Features

### End-to-End Encryption
- **X3DH Key Agreement**: Initial key exchange protocol
- **Double Ratchet**: Forward secrecy and post-compromise security
- **Prekey System**: One-time keys for offline message delivery
- **Key Verification**: Safety numbers for contact verification

### Data Protection
- **No Plaintext Storage**: Messages are encrypted before server storage
- **Secure Key Storage**: Private keys stored in device keychain
- **JWT Authentication**: Secure API authentication
- **Argon2id Hashing**: Strong password hashing

### Privacy
- **No Message Logging**: Server never logs message content
- **Minimal Metadata**: Only essential routing information stored
- **User Control**: Users can verify contacts and manage keys

## 🧪 Testing

### Run All Tests
```bash
make test
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

### Test Coverage
- Server handlers with table-driven tests
- Crypto module with mocked dependencies
- State management with unit tests
- WebSocket connection handling

## 📦 Building for Production

### Server
```bash
make build:server
```

### App
```bash
make build:app
```

### Docker Deployment
```bash
# Build production images
docker build -t e2ee-messenger-server ./server
docker build -t e2ee-messenger-app ./app

# Deploy with docker-compose
docker-compose -f docker-compose.prod.yml up -d
```

## 🔧 Development Commands

```bash
# Setup project
make setup

# Development
make dev              # Start both server and app
make dev-server       # Start server only
make dev-app          # Start app only

# Building
make build            # Build both
make build:server     # Build server only
make build:app        # Build app only

# Testing
make test             # Run all tests
make test:server      # Run server tests
make test:app         # Run app tests

# Code Quality
make lint             # Run linters
make format           # Format code

# Infrastructure
make infra-up         # Start PostgreSQL and Adminer
make infra-down       # Stop infrastructure
make infra-logs       # View infrastructure logs

# Database
make seed             # Seed database with test data

# Cleanup
make clean            # Remove build artifacts
```

## 🚨 Known Caveats & Limitations

### React Native Crypto Libraries
⚠️ **Important**: The current crypto implementation is a **simplified mock** for demonstration purposes.

**Production Considerations**:
1. **Use Production Crypto Library**: Replace the mock implementation with a maintained Signal-style library like:
   - `@signalapp/libsignal-protocol-typescript`
   - `libsignal-protocol-javascript`
   - Or implement proper X3DH + Double Ratchet

2. **Key Management**: 
   - Implement proper key rotation
   - Add key backup/recovery mechanisms
   - Handle key loss scenarios

3. **Performance**: 
   - Optimize crypto operations for mobile
   - Implement proper session caching
   - Add background processing for key operations

### Current Limitations
- **Mock Encryption**: Uses simplified hashing instead of proper encryption
- **No Key Rotation**: Keys don't rotate automatically
- **Limited Error Handling**: Basic error handling for crypto operations
- **No Key Backup**: No mechanism to backup/recover keys
- **Single Device**: No multi-device support

### Phase 2 Features (Placeholders)
- **Group Chats**: Client-side fan-out implementation
- **File Attachments**: AES-GCM encryption with per-file keys
- **Message Reactions**: Encrypted reaction system
- **Voice Messages**: Encrypted audio messages
- **Video Calls**: End-to-end encrypted calling

## 🔍 API Endpoints

### Authentication
- `POST /v1/auth/signup` - User registration
- `POST /v1/auth/login` - User login

### Key Management
- `POST /v1/keys/device` - Upload device key
- `POST /v1/keys/one-time` - Upload one-time key
- `GET /v1/keys/bootstrap?user_id=` - Get bootstrap keys

### Messaging
- `POST /v1/messages` - Send message
- `GET /v1/messages?since=` - Get messages
- `POST /v1/receipts` - Send message receipt
- `WS /v1/ws` - WebSocket connection

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```bash
   make infra-down
   make infra-up
   ```

2. **App Can't Connect to Server**
   - Check server is running: `make dev-server`
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

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## 📞 Support

For questions and support:
- Create an issue in the repository
- Check the troubleshooting section
- Review the API documentation

---

**⚠️ Security Notice**: This is a demonstration project. For production use, implement proper crypto libraries and security practices as outlined in the caveats section.
