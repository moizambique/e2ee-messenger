// Types for the crypto module

export interface IdentityKeyPair {
  publicKey: string;
  privateKey: string;
}

export interface PreKeyBundle {
  identityKey: string;
  deviceId: string;
  preKeyId: string;
  preKey: string;
  signedPreKeyId: string;
  signedPreKey: string;
  signature: string;
}

export interface Session {
  id: string;
  peerId: string;
  deviceId: string;
  state: 'initialized' | 'active' | 'expired';
  createdAt: Date;
  lastUsed: Date;
}

export interface EncryptedMessage {
  type: 'text' | 'file' | 'system';
  content: string;
  timestamp: number;
  senderId: string;
  recipientId: string;
  messageId: string;
}

export interface DecryptedMessage {
  type: 'text' | 'file' | 'system';
  content: string;
  timestamp: number;
  senderId: string;
  recipientId: string;
  messageId: string;
  plaintext: string;
}

export interface KeyVerification {
  safetyNumber: string;
  fingerprint: string;
  isVerified: boolean;
  verifiedAt?: Date;
}

export interface CryptoError extends Error {
  code: 'INVALID_KEY' | 'ENCRYPTION_FAILED' | 'DECRYPTION_FAILED' | 'SESSION_EXPIRED' | 'INVALID_MESSAGE';
}
