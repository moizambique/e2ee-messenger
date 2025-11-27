// Global types for the app

export interface User {
  id: string;
  username: string;
  email: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

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

export interface Message {
  id: string;
  sender_id: string;
  recipient_id?: string;
  group_id?: string;
  encrypted_content: string;
  message_type: 'text' | 'file' | 'system';
  created_at: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
}

export interface Receipt {
  id: string;
  message_id: string;
  user_id: string;
  type: 'delivered' | 'read';
  created_at: string;
}

export interface Chat {
  id: string;
  type: 'dm' | 'group';
  name: string; // For groups, this is the group name. For DMs, the participant's name.
  participant?: User; // Only for DMs
  last_message?: Message;
  unread_count: number;
  updated_at: string;
  participant_count?: number; // For groups
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

export interface AppState {
  isAuthenticated: boolean;
  user: User | null;
  deviceId: string | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

export interface ChatState {
  chats: Chat[];
  currentChat: Chat | null;
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}

export interface KeyVerificationState {
  safetyNumber: string;
  fingerprint: string;
  isVerified: boolean;
  verifiedAt?: Date;
}

// Navigation types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Chat: { participant: User };
  Settings: undefined;
  GroupChat: { chat: Chat };
  Profile: undefined;
  Notifications: undefined;
  Privacy: undefined;
  DeviceKeys: undefined;
  KeyVerification: { userId: string; deviceId: string };
  CreateGroup: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

export type MainTabParamList = {
  Chats: undefined;
  Contacts: undefined;
  Settings: undefined;
};
