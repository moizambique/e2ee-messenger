import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Buffer } from 'buffer';
import { IdentityKeyPair, PreKeyBundle, Session, EncryptedMessage, DecryptedMessage, KeyVerification, CryptoError } from './types';

// Storage keys
const IDENTITY_KEY_PAIR_KEY = 'identity_key_pair';
const SESSIONS_KEY = 'sessions';
const PREKEYS_KEY = 'prekeys';

// Mock implementation - In production, use a proper Signal-style library
// This is a simplified version for demonstration purposes

class CryptoManager {
  private identityKeyPair: IdentityKeyPair | null = null;
  private sessions: Map<string, Session> = new Map();
  private preKeys: Map<string, string> = new Map();

  /**
   * Generate a new identity key pair
   */
  async generateIdentity(): Promise<IdentityKeyPair> {
    try {
      // Generate random key pair (simplified)
      const publicKey = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `public_${Date.now()}_${Math.random()}`,
        { encoding: Crypto.CryptoEncoding.BASE64 }
      );
      
      const privateKey = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `private_${Date.now()}_${Math.random()}`,
        { encoding: Crypto.CryptoEncoding.BASE64 }
      );

      const keyPair: IdentityKeyPair = {
        publicKey,
        privateKey,
      };

      // Store securely
      await SecureStore.setItemAsync(IDENTITY_KEY_PAIR_KEY, JSON.stringify(keyPair));
      this.identityKeyPair = keyPair;

      return keyPair;
    } catch (error) {
      throw this.createCryptoError('INVALID_KEY', 'Failed to generate identity key pair');
    }
  }

  /**
   * Get or generate identity key pair
   */
  async getIdentityKeyPair(): Promise<IdentityKeyPair> {
    if (this.identityKeyPair) {
      return this.identityKeyPair;
    }

    try {
      const stored = await SecureStore.getItemAsync(IDENTITY_KEY_PAIR_KEY);
      if (stored) {
        this.identityKeyPair = JSON.parse(stored);
        return this.identityKeyPair!;
      }
    } catch (error) {
      // If stored key is invalid, generate new one
    }

    return this.generateIdentity();
  }

  /**
   * Generate and store prekeys
   */
  async publishPrekeys(count: number = 10): Promise<string[]> {
    try {
      const preKeyIds: string[] = [];
      
      for (let i = 0; i < count; i++) {
        const preKeyId = `prekey_${Date.now()}_${i}`;
        const preKey = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          `prekey_${preKeyId}_${Math.random()}`,
          { encoding: Crypto.CryptoEncoding.BASE64 }
        );
        
        this.preKeys.set(preKeyId, preKey);
        preKeyIds.push(preKeyId);
      }

      // Store prekeys securely
      await SecureStore.setItemAsync(PREKEYS_KEY, JSON.stringify(Array.from(this.preKeys.entries())));
      
      return preKeyIds;
    } catch (error) {
      throw this.createCryptoError('INVALID_KEY', 'Failed to generate prekeys');
    }
  }

  /**
   * Establish a session with a peer
   */
  async establishSession(peerId: string, deviceId: string, preKeyBundle: PreKeyBundle): Promise<Session> {
    try {
      const sessionId = `${peerId}_${deviceId}`;
      
      // Verify the prekey bundle (simplified)
      if (!preKeyBundle.identityKey || !preKeyBundle.preKey) {
        throw this.createCryptoError('INVALID_KEY', 'Invalid prekey bundle');
      }

      const session: Session = {
        id: sessionId,
        peerId,
        deviceId,
        state: 'initialized',
        createdAt: new Date(),
        lastUsed: new Date(),
      };

      this.sessions.set(sessionId, session);
      await this.saveSessions();

      return session;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw this.createCryptoError('SESSION_EXPIRED', 'Failed to establish session');
    }
  }

  /**
   * Encrypt text message
   */
  async encryptText(sessionId: string, text: string): Promise<string> {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw this.createCryptoError('SESSION_EXPIRED', 'Session not found');
      }

      // Simplified "encryption" (Base64 encoding) - in production, use proper Signal protocol
      // This is for demonstration to make messages readable in the DB
      const encrypted = Buffer.from(text).toString('base64');

      session.lastUsed = new Date();
      await this.saveSessions();

      return encrypted;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw this.createCryptoError('ENCRYPTION_FAILED', 'Failed to encrypt message');
    }
  }

  /**
   * Decrypt text message
   */
  async decryptText(sessionId: string, encryptedPayload: string): Promise<string> {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw this.createCryptoError('SESSION_EXPIRED', 'Session not found');
      }

      // Simplified decryption - in production, use proper Signal protocol
      // This is just a mock implementation to decode Base64
      const decrypted = Buffer.from(encryptedPayload, 'base64').toString('utf-8');

      session.lastUsed = new Date();
      await this.saveSessions();

      return decrypted;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw this.createCryptoError('DECRYPTION_FAILED', 'Failed to decrypt message');
    }
  }

  /**
   * Encrypt a complete message
   */
  async encryptMessage(sessionId: string, message: EncryptedMessage): Promise<string> {
    try {
      const messageJson = JSON.stringify(message);
      return this.encryptText(sessionId, messageJson);
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw this.createCryptoError('ENCRYPTION_FAILED', 'Failed to encrypt message');
    }
  }

  /**
   * Decrypt a complete message
   */
  async decryptMessage(sessionId: string, encryptedPayload: string): Promise<DecryptedMessage> {
    try {
      // In a real implementation, the entire payload would be a single encrypted blob.
      // Here, we assume the content property of the message is what's "encrypted".
      // For this mock, we'll just decode it.
      const plaintext = Buffer.from(encryptedPayload, 'base64').toString('utf-8');

      // This part is tricky with the current mock. A real implementation would
      // decrypt a structured object. We will just return a partial object.
      const decryptedMessage: DecryptedMessage = JSON.parse(plaintext);
      decryptedMessage.plaintext = decryptedMessage.content;

      return decryptedMessage;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw this.createCryptoError('DECRYPTION_FAILED', 'Failed to decrypt message');
    }
  }

  /**
   * Generate safety number for key verification
   */
  async generateSafetyNumber(peerId: string, deviceId: string): Promise<KeyVerification> {
    try {
      const identityKeyPair = await this.getIdentityKeyPair();
      const sessionId = `${peerId}_${deviceId}`;
      
      // Generate safety number (simplified)
      const combined = `${identityKeyPair.publicKey}_${peerId}_${deviceId}`;
      const safetyNumber = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        combined,
        { encoding: Crypto.CryptoEncoding.BASE64 }
      );

      const fingerprint = safetyNumber.substring(0, 12); // First 12 characters

      return {
        safetyNumber,
        fingerprint,
        isVerified: false,
      };
    } catch (error) {
      throw this.createCryptoError('INVALID_KEY', 'Failed to generate safety number');
    }
  }

  /**
   * Get all active sessions
   */
  async getSessions(): Promise<Session[]> {
    await this.loadSessions();
    return Array.from(this.sessions.values());
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<Session | null> {
    await this.loadSessions();
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Remove session
   */
  async removeSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    await this.saveSessions();
  }

  /**
   * Clear all crypto data (for logout)
   */
  async clearAll(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(IDENTITY_KEY_PAIR_KEY);
      await SecureStore.deleteItemAsync(SESSIONS_KEY);
      await SecureStore.deleteItemAsync(PREKEYS_KEY);
      
      this.identityKeyPair = null;
      this.sessions.clear();
      this.preKeys.clear();
    } catch (error) {
      // Ignore errors during cleanup
    }
  }

  // Private helper methods

  private async loadSessions(): Promise<void> {
    try {
      const stored = await SecureStore.getItemAsync(SESSIONS_KEY);
      if (stored) {
        const sessionsArray = JSON.parse(stored);
        this.sessions.clear();
        sessionsArray.forEach(([id, session]: [string, Session]) => {
          this.sessions.set(id, {
            ...session,
            createdAt: new Date(session.createdAt),
            lastUsed: new Date(session.lastUsed),
          });
        });
      }
    } catch (error) {
      // If stored sessions are invalid, start fresh
      this.sessions.clear();
    }
  }

  private async saveSessions(): Promise<void> {
    try {
      const sessionsArray = Array.from(this.sessions.entries());
      await SecureStore.setItemAsync(SESSIONS_KEY, JSON.stringify(sessionsArray));
    } catch (error) {
      // Ignore storage errors
    }
  }

  private createCryptoError(code: CryptoError['code'], message: string): CryptoError {
    const error = new Error(message) as CryptoError;
    error.code = code;
    return error;
  }
}

// Export singleton instance
export const cryptoManager = new CryptoManager();

// Export convenience functions
export const generateIdentity = () => cryptoManager.generateIdentity();
export const publishPrekeys = (count?: number) => cryptoManager.publishPrekeys(count);
export const establishSession = (peerId: string, deviceId: string, preKeyBundle: PreKeyBundle) => 
  cryptoManager.establishSession(peerId, deviceId, preKeyBundle);
export const encryptText = (sessionId: string, text: string) => cryptoManager.encryptText(sessionId, text);
export const decryptText = (sessionId: string, payload: string) => cryptoManager.decryptText(sessionId, payload);
export const encryptMessage = (sessionId: string, message: EncryptedMessage) => cryptoManager.encryptMessage(sessionId, message);
export const decryptMessage = (sessionId: string, payload: string) => cryptoManager.decryptMessage(sessionId, payload);
export const generateSafetyNumber = (peerId: string, deviceId: string) => cryptoManager.generateSafetyNumber(peerId, deviceId);
export const getSessions = () => cryptoManager.getSessions();
export const getSession = (sessionId: string) => cryptoManager.getSession(sessionId);
export const removeSession = (sessionId: string) => cryptoManager.removeSession(sessionId);
export const clearAll = () => cryptoManager.clearAll();
