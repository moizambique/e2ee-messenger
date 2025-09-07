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
  User
} from '../types';

const API_BASE_URL = __DEV__ 
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
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
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
      body: JSON.stringify(data),
    });
  }

  async getMessages(params: GetMessagesRequest): Promise<Message[]> {
    const searchParams = new URLSearchParams({
      recipient_id: params.recipient_id,
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
