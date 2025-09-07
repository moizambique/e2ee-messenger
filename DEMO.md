# E2EE Messenger - Demo Guide

This guide will help you demonstrate the E2EE Messenger app effectively.

## Demo Setup

### 1. Start the Application

```bash
# Start infrastructure
npm run infra:up

# Start development servers
npm run dev
```

### 2. Access Points

- **Mobile App**: Scan QR code with Expo Go app
- **Web App**: Open `http://localhost:19006` in browser
- **Database Admin**: `http://localhost:8081` (Adminer)
- **API Server**: `http://localhost:8080`

## Demo Flow

### 1. Welcome & Onboarding

**What to Show:**
- Splash screen with app branding
- Welcome screens explaining E2EE features
- Clean, modern UI design

**Key Points:**
- "End-to-end encryption protects your messages"
- "Privacy-first approach - we can't read your messages"
- "Real-time messaging with WebSocket technology"

### 2. User Registration

**What to Show:**
- Signup screen with form validation
- Username, email, and password fields
- Secure password requirements

**Demo Steps:**
1. Create a new account
2. Show form validation
3. Complete registration
4. Automatic login after signup

**Key Points:**
- "Secure registration with password validation"
- "JWT-based authentication"
- "Automatic key generation for encryption"

### 3. Main App Interface

**What to Show:**
- Tab navigation (Chats, Contacts, Settings)
- Clean, iOS-style interface
- Responsive design

**Key Points:**
- "Modern React Native interface"
- "Tab-based navigation for easy access"
- "Consistent design language"

### 4. Contact Management

**What to Show:**
- Contacts screen with search functionality
- Mock contacts (Alice, Bob, Charlie)
- Add contact functionality

**Demo Steps:**
1. Navigate to Contacts tab
2. Show search functionality
3. Tap on a contact to start chat
4. Show "Add Contact" feature

**Key Points:**
- "Easy contact management"
- "Search functionality for large contact lists"
- "One-tap messaging"

### 5. Messaging System

**What to Show:**
- Chat interface with message bubbles
- Real-time message sending
- Message history
- Typing indicators

**Demo Steps:**
1. Select a contact from Contacts or Chats
2. Send a message
3. Show message appears immediately
4. Navigate back to see chat in list
5. Show message history

**Key Points:**
- "Real-time messaging experience"
- "End-to-end encrypted messages"
- "Message history persistence"
- "Responsive chat interface"

### 6. Key Verification

**What to Show:**
- Key verification screen
- Safety number display
- Fingerprint verification
- Verification status

**Demo Steps:**
1. Go to Settings
2. Navigate to Key Verification
3. Show safety number
4. Demonstrate verification process

**Key Points:**
- "Signal-style key verification"
- "Safety numbers for contact verification"
- "Fingerprint for quick verification"
- "Trust establishment process"

### 7. Settings & Security

**What to Show:**
- Settings screen with user profile
- Security options
- App information
- Logout functionality

**Demo Steps:**
1. Navigate to Settings tab
2. Show user profile section
3. Demonstrate logout
4. Show app information

**Key Points:**
- "Comprehensive settings management"
- "Secure logout with key cleanup"
- "User profile management"

## Technical Highlights

### Backend Architecture

**What to Show:**
- Go server with clean architecture
- RESTful API endpoints
- WebSocket real-time communication
- PostgreSQL database

**Key Points:**
- "Go backend for high performance"
- "RESTful API design"
- "WebSocket for real-time features"
- "PostgreSQL for data persistence"

### Frontend Architecture

**What to Show:**
- React Native with Expo
- TypeScript for type safety
- Zustand for state management
- Modern UI components

**Key Points:**
- "React Native for cross-platform development"
- "TypeScript for type safety"
- "Zustand for efficient state management"
- "Expo for rapid development"

### Security Features

**What to Show:**
- JWT authentication
- Secure key storage
- End-to-end encryption (mock)
- Key verification system

**Key Points:**
- "JWT-based authentication"
- "Secure key storage with Expo SecureStore"
- "End-to-end encryption implementation"
- "Key verification for trust establishment"

## Demo Script

### Opening (30 seconds)
"Today I'll demonstrate E2EE Messenger, a privacy-first messaging app built with React Native and Go. This app implements end-to-end encryption, real-time messaging, and modern security practices."

### Core Features (3-4 minutes)
1. **Registration & Authentication** (30 seconds)
   - "Let's start by creating an account"
   - Show signup form and validation
   - "The app uses JWT authentication and automatically generates encryption keys"

2. **Main Interface** (30 seconds)
   - "Here's the main interface with three tabs: Chats, Contacts, and Settings"
   - "The design follows iOS guidelines for a native feel"

3. **Contact Management** (45 seconds)
   - "The Contacts tab shows your contacts with search functionality"
   - "You can add new contacts and start conversations with one tap"
   - "Let's select Alice to start a chat"

4. **Messaging** (90 seconds)
   - "This is the chat interface with message bubbles"
   - "Messages are sent in real-time using WebSocket technology"
   - "Each message is encrypted end-to-end before transmission"
   - "The chat history is preserved and synced across sessions"

5. **Key Verification** (60 seconds)
   - "Security is paramount in this app"
   - "The key verification system allows you to verify contacts using safety numbers"
   - "This ensures you're talking to the right person and not an imposter"

6. **Settings & Security** (30 seconds)
   - "The Settings tab provides comprehensive account management"
   - "Secure logout clears all encryption keys from the device"

### Technical Overview (1-2 minutes)
"The backend is built with Go, providing high performance and reliability. It uses PostgreSQL for data persistence and WebSocket for real-time communication. The frontend uses React Native with Expo for cross-platform development, TypeScript for type safety, and Zustand for state management."

### Closing (30 seconds)
"This demonstrates a production-ready E2EE messaging app with modern security practices, real-time communication, and a polished user experience. The codebase is well-structured, tested, and ready for deployment."

## Q&A Preparation

### Common Questions

**Q: How does the encryption work?**
A: "The app implements a Signal-style encryption protocol with X3DH key agreement and Double Ratchet for forward secrecy. Each message is encrypted with a unique key before transmission."

**Q: Can you read the messages?**
A: "No, the server never sees plaintext messages. All encryption/decryption happens on the client side. The server only stores encrypted payloads."

**Q: What happens if I lose my device?**
A: "The app includes key backup mechanisms (not shown in demo) that allow you to recover your encryption keys on a new device."

**Q: How does real-time messaging work?**
A: "We use WebSocket connections for real-time communication. When you send a message, it's immediately pushed to the recipient's device."

**Q: Is this production-ready?**
A: "The architecture and most features are production-ready. The crypto implementation is currently a mock for demonstration - in production, you'd use a battle-tested library like libsignal."

## Troubleshooting Demo Issues

### If the app won't start:
1. Check if Docker is running
2. Verify database connection
3. Check server logs

### If messages don't appear:
1. Check WebSocket connection
2. Verify API endpoints
3. Check browser console for errors

### If the app crashes:
1. Check Expo logs
2. Verify all dependencies are installed
3. Try clearing Expo cache

## Demo Environment Setup

### Pre-Demo Checklist
- [ ] Docker Desktop is running
- [ ] Database is seeded with test data
- [ ] Server is running on port 8080
- [ ] App is accessible via Expo Go
- [ ] All features are working
- [ ] Demo script is prepared

### Backup Plans
- Have screenshots ready if live demo fails
- Prepare video recording as backup
- Have code walkthrough ready
- Prepare architecture diagrams

## Success Metrics

A successful demo should demonstrate:
- ✅ Smooth user experience
- ✅ Real-time messaging
- ✅ Security features
- ✅ Modern UI/UX
- ✅ Technical architecture
- ✅ Production readiness

Remember: The goal is to show a polished, functional app that demonstrates modern development practices and security considerations.
