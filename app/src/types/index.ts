// Global types for the app

export interface User {
  id: string;
  username: string;
  email: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
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
