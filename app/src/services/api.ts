import { Platform } from 'react-native';
import {
  AuthResponse, 
  SignupRequest, 
  LoginRequest, 
  DeviceKey, 
  OneTimeKey, 
  Message, 
  Receipt,
  SendMessageRequest,
  GetMessagesRequest,
  SendReceiptRequest,
  User,
  UpdateProfileRequest,
  Chat,
  CreateGroupRequest,
  ChangePasswordRequest
} from '../types';

export const API_BASE_URL = __DEV__ 
  ? 'http://localhost:8080/v1' 
  : 'https://your-production-api.com/v1';

class ApiService {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const headers: any = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      // For 204 No Content, response.json() will fail. We handle this case.
      if (response.status === 204) {
        return {} as T; // Return an empty object for void responses
      }
      const errorData = await response.json().catch(() => ({ message: `HTTP ${response.status}: ${response.statusText}` }));
      throw new Error(errorData.message);
    }

    // Handle 204 No Content response
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
      return response.json();
    }
    return {} as T;
  }

  // Auth endpoints
  async signup(data: SignupRequest): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Profile endpoint
  async updateProfile(data: UpdateProfileRequest): Promise<User> {
    return this.request<User>('/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async changePassword(data: ChangePasswordRequest): Promise<void> {
    return this.request<void>('/profile/password', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async uploadAvatar(uri: string): Promise<{ avatar_url: string }> {
    const url = `${API_BASE_URL}/profile/avatar`;
    const fileType = uri.split('.').pop();
    const fileName = `photo.${fileType}`;
    const fileMimeType = `image/${fileType}`;

    const formData = new FormData();

    // Platform-specific logic for creating the form data
    if (Platform.OS === 'web') {
      // On web, we need to fetch the blob from the URI
      const response = await fetch(uri);
      const blob = await response.blob();
      formData.append('avatar', blob, fileName);
    } else {
      // On native, we use the React Native-specific object
      formData.append('avatar', {
        uri,
        name: fileName,
        type: fileMimeType,
      } as any);
    }

    const headers: any = {
      // Do NOT set 'Content-Type': 'multipart/form-data'.
      // React Native's fetch will do this automatically and add the boundary.
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: `HTTP ${response.status}: ${response.statusText}` }));
      throw new Error(errorData.message);
    }

    return response.json();
  }

  async uploadAttachment(
    uri: string,
    fileName: string,
    fileType: string,
    messageId: string,
    encryptedKey: string
  ): Promise<void> {
    const url = `${API_BASE_URL}/messages/attachment`;
    const formData = new FormData();

    // Append metadata first
    formData.append('message_id', messageId);
    formData.append('encrypted_key', encryptedKey);

    // Platform-specific logic for appending the file
    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      const blob = await response.blob();
      formData.append('attachment', blob, fileName);
    } else {
      formData.append('attachment', {
        uri,
        name: fileName,
        type: fileType,
      } as any);
    }

    const headers: any = {};
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: `HTTP ${response.status}: ${response.statusText}` }));
      throw new Error(errorData.message);
    }
    // No JSON body is expected on success (201)
  }

  async deleteAccount(): Promise<void> {
    // Use the generic request helper to ensure the auth token is sent
    return this.request<void>('/profile', {
      method: 'DELETE',
    });
  }

  // User & Chat endpoints
  async getUsers(): Promise<User[]> {
    return this.request<User[]>('/users');
  }

  async getChats(): Promise<Chat[]> {
    return this.request<Chat[]>('/chats');
  }

  // Group endpoints
  async createGroup(data: CreateGroupRequest): Promise<Chat> { // Assuming group creation returns a Chat-like object
    return this.request<Chat>('/groups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Key management endpoints
  async uploadDeviceKey(deviceId: string, publicKey: string): Promise<DeviceKey> {
    return this.request<DeviceKey>('/keys/device', {
      method: 'POST',
      body: JSON.stringify({ device_id: deviceId, public_key: publicKey }),
    });
  }

  async uploadOneTimeKey(keyId: string, publicKey: string): Promise<OneTimeKey> {
    return this.request<OneTimeKey>('/keys/one-time', {
      method: 'POST',
      body: JSON.stringify({ key_id: keyId, public_key: publicKey }),
    });
  }

  async getBootstrapKeys(userId: string): Promise<{ device_keys: DeviceKey[]; one_time_keys: OneTimeKey[] }> {
    return this.request<{ device_keys: DeviceKey[]; one_time_keys: OneTimeKey[] }>(`/keys/bootstrap?user_id=${userId}`);
  }

  // Message endpoints
  async sendMessage(data: SendMessageRequest): Promise<Message> {
    return this.request<Message>('/messages', {
      method: 'POST',
      body: JSON.stringify({ ...data, recipient_id: data.recipient_id }),
    });
  }

  async getMessages(params: GetMessagesRequest): Promise<Message[]> {
    const searchParams = new URLSearchParams({
      ...(params.recipient_id && { recipient_id: params.recipient_id }),
      ...(params.group_id && { group_id: params.group_id }),
      ...(params.since && { since: params.since }),
      ...(params.limit && { limit: params.limit.toString() }),
    });

    return this.request<Message[]>(`/messages?${searchParams}`);
  }

  async sendReceipt(data: SendReceiptRequest): Promise<Receipt> {
    return this.request<Receipt>('/receipts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // WebSocket endpoint
  getWebSocketUrl(): string {
    const wsProtocol = API_BASE_URL.startsWith('https') ? 'wss' : 'ws';
    const wsBaseUrl = API_BASE_URL.replace(/^https?/, wsProtocol);
    return `${wsBaseUrl}/ws`;
  }
}

export const apiService = new ApiService();
