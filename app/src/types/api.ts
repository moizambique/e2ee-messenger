import { User } from './index';

export interface DeviceKey {
  id: string;
  user_id: string;
  device_id: string;
  public_key: string;
  created_at: string;
  updated_at: string;
}

export interface OneTimeKey {
  id: string;
  user_id: string;
  key_id: string;
  public_key: string;
  used: boolean;
  created_at: string;
}

export interface Receipt {
  id: string;
  message_id: string;
  user_id: string;
  type: 'delivered' | 'read';
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  device_id: string;
}

export interface SignupRequest {
  username: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UpdateProfileRequest {
  username: string;
}

export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
}

export interface CreateGroupRequest {
  name: string;
  member_ids: string[];
}

export interface SendMessageRequest {
  recipient_id?: string;
  group_id?: string;
  encrypted_content: string;
  message_type: 'text' | 'file' | 'system';
}

export interface GetMessagesRequest {
  recipient_id?: string;
  group_id?: string;
  since?: string;
  limit?: number;
}

export interface SendReceiptRequest {
  message_id: string;
  type: 'delivered' | 'read';
}

export interface WebSocketMessage {
  type: 'new_message' | 'message_receipt' | 'message_received' | 'message_delivered' | 'message_read' | 'ping' | 'pong';
  payload: any;
}