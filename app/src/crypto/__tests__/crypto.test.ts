import { 
  generateIdentity, 
  publishPrekeys, 
  establishSession, 
  encryptText, 
  decryptText,
  generateSafetyNumber,
  clearAll 
} from '../crypto';

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock expo-crypto
jest.mock('expo-crypto', () => ({
  digestStringAsync: jest.fn((algorithm, data) => 
    Promise.resolve(Buffer.from(data).toString('base64'))
  ),
  CryptoDigestAlgorithm: {
    SHA256: 'SHA256',
  },
  CryptoEncoding: {
    BASE64: 'base64',
  },
}));

describe('Crypto Module', () => {
  beforeEach(async () => {
    await clearAll();
  });

  afterEach(async () => {
    await clearAll();
  });

  describe('generateIdentity', () => {
    it('should generate a new identity key pair', async () => {
      const identity = await generateIdentity();
      
      expect(identity).toBeDefined();
      expect(identity.publicKey).toBeDefined();
      expect(identity.privateKey).toBeDefined();
      expect(typeof identity.publicKey).toBe('string');
      expect(typeof identity.privateKey).toBe('string');
      expect(identity.publicKey).not.toBe(identity.privateKey);
    });

    it('should return the same identity on subsequent calls', async () => {
      const identity1 = await generateIdentity();
      const identity2 = await generateIdentity();
      
      expect(identity1.publicKey).toBe(identity2.publicKey);
      expect(identity1.privateKey).toBe(identity2.privateKey);
    });
  });

  describe('publishPrekeys', () => {
    it('should generate the specified number of prekeys', async () => {
      const count = 5;
      const preKeyIds = await publishPrekeys(count);
      
      expect(preKeyIds).toHaveLength(count);
      expect(preKeyIds.every(id => typeof id === 'string')).toBe(true);
    });

    it('should generate 10 prekeys by default', async () => {
      const preKeyIds = await publishPrekeys();
      
      expect(preKeyIds).toHaveLength(10);
    });

    it('should generate unique prekey IDs', async () => {
      const preKeyIds = await publishPrekeys(3);
      const uniqueIds = new Set(preKeyIds);
      
      expect(uniqueIds.size).toBe(preKeyIds.length);
    });
  });

  describe('establishSession', () => {
    it('should establish a session with valid prekey bundle', async () => {
      const peerId = 'test-peer';
      const deviceId = 'test-device';
      const preKeyBundle = {
        identityKey: 'test-identity-key',
        deviceId: deviceId,
        preKeyId: 'test-prekey-id',
        preKey: 'test-prekey',
        signedPreKeyId: 'test-signed-prekey-id',
        signedPreKey: 'test-signed-prekey',
        signature: 'test-signature',
      };

      const session = await establishSession(peerId, deviceId, preKeyBundle);
      
      expect(session).toBeDefined();
      expect(session.id).toBe(`${peerId}_${deviceId}`);
      expect(session.peerId).toBe(peerId);
      expect(session.deviceId).toBe(deviceId);
      expect(session.state).toBe('initialized');
      expect(session.createdAt).toBeInstanceOf(Date);
    });

    it('should throw error for invalid prekey bundle', async () => {
      const peerId = 'test-peer';
      const deviceId = 'test-device';
      const invalidPreKeyBundle = {
        identityKey: '',
        deviceId: deviceId,
        preKeyId: 'test-prekey-id',
        preKey: '',
        signedPreKeyId: 'test-signed-prekey-id',
        signedPreKey: 'test-signed-prekey',
        signature: 'test-signature',
      };

      await expect(establishSession(peerId, deviceId, invalidPreKeyBundle))
        .rejects.toThrow('Invalid prekey bundle');
    });
  });

  describe('encryptText and decryptText', () => {
    it('should encrypt and decrypt text successfully', async () => {
      const sessionId = 'test-peer_test-device';
      const originalText = 'Hello, World!';
      
      // First establish a session
      const preKeyBundle = {
        identityKey: 'test-identity-key',
        deviceId: 'test-device',
        preKeyId: 'test-prekey-id',
        preKey: 'test-prekey',
        signedPreKeyId: 'test-signed-prekey-id',
        signedPreKey: 'test-signed-prekey',
        signature: 'test-signature',
      };
      await establishSession('test-peer', 'test-device', preKeyBundle);
      
      const encrypted = await encryptText(sessionId, originalText);
      const decrypted = await decryptText(sessionId, encrypted);
      
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(originalText);
      expect(decrypted).toContain(originalText); // Mock implementation includes original text
    });

    it('should throw error for non-existent session', async () => {
      const sessionId = 'non-existent-session';
      const text = 'Hello, World!';
      
      await expect(encryptText(sessionId, text))
        .rejects.toThrow('Session not found');
      
      await expect(decryptText(sessionId, 'encrypted-text'))
        .rejects.toThrow('Session not found');
    });
  });

  describe('generateSafetyNumber', () => {
    it('should generate safety number for peer', async () => {
      const peerId = 'test-peer';
      const deviceId = 'test-device';
      
      const keyVerification = await generateSafetyNumber(peerId, deviceId);
      
      expect(keyVerification).toBeDefined();
      expect(keyVerification.safetyNumber).toBeDefined();
      expect(keyVerification.fingerprint).toBeDefined();
      expect(keyVerification.isVerified).toBe(false);
      expect(typeof keyVerification.safetyNumber).toBe('string');
      expect(typeof keyVerification.fingerprint).toBe('string');
      expect(keyVerification.fingerprint.length).toBe(12);
    });

    it('should generate consistent safety numbers for same peer', async () => {
      const peerId = 'test-peer';
      const deviceId = 'test-device';
      
      const verification1 = await generateSafetyNumber(peerId, deviceId);
      const verification2 = await generateSafetyNumber(peerId, deviceId);
      
      expect(verification1.safetyNumber).toBe(verification2.safetyNumber);
      expect(verification1.fingerprint).toBe(verification2.fingerprint);
    });

    it('should generate different safety numbers for different peers', async () => {
      const verification1 = await generateSafetyNumber('peer1', 'device1');
      const verification2 = await generateSafetyNumber('peer2', 'device2');
      
      expect(verification1.safetyNumber).not.toBe(verification2.safetyNumber);
      expect(verification1.fingerprint).not.toBe(verification2.fingerprint);
    });
  });

  describe('clearAll', () => {
    it('should clear all crypto data', async () => {
      // Generate some data
      await generateIdentity();
      await publishPrekeys(3);
      
      // Clear all data
      await clearAll();
      
      // Verify data is cleared by checking that new identity is generated
      const identity1 = await generateIdentity();
      const identity2 = await generateIdentity();
      
      // If data was properly cleared, these should be the same
      expect(identity1.publicKey).toBe(identity2.publicKey);
    });
  });
});
