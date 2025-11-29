import { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
};

export type MainTabParamList = {
  Chats: undefined;
  Contacts: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  Chat: { participant: User };
  GroupChat: { chat: Chat };
  CreateGroup: undefined;
  Profile: undefined;
  DeviceKeys: undefined;
  KeyVerification: { userId: string; deviceId: string };
  Notifications: undefined;
  Privacy: undefined;
};

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
  sender?: User; // For group chats, includes sender info
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  created_at: string;
  message_type: 'text' | 'file' | 'system';
}

export interface Chat {
  id: string;
  type: 'dm' | 'group';
  name: string;
  participant?: User;
  last_message?: Message;
  unread_count: number;
  updated_at: string;
  participant_count?: number;
}