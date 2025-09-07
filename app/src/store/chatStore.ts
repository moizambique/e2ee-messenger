import { create } from 'zustand';
import { Chat, Message, User } from '../types';
import { apiService } from '../services/api';
import { decryptMessage, getSession } from '../crypto/crypto';

interface ChatState {
  // State
  chats: Chat[];
  currentChat: Chat | null;
  messages: Message[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadChats: () => Promise<void>;
  loadMessages: (recipientId: string, since?: string) => Promise<void>;
  sendMessage: (recipientId: string, content: string, type: 'text' | 'file' | 'system') => Promise<void>;
  setCurrentChat: (chat: Chat | null) => void;
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  markMessageAsRead: (messageId: string) => Promise<void>;
  markMessageAsDelivered: (messageId: string) => Promise<void>;
  clearMessages: () => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  // Initial state
  chats: [],
  currentChat: null,
  messages: [],
  isLoading: false,
  error: null,

  // Actions
  loadChats: async () => {
    set({ isLoading: true, error: null });
    
    try {
      // Mock chats for demonstration
      const mockChats: Chat[] = [
        {
          id: 'chat_1',
          participant_id: '2',
          participant: {
            id: '2',
            username: 'Alice',
            email: 'alice@example.com',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          last_message: {
            id: 'msg_1',
            sender_id: '2',
            recipient_id: '1',
            encrypted_content: 'Hello! How are you?',
            message_type: 'text',
            created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 minutes ago
          },
          unread_count: 2,
          updated_at: new Date().toISOString(),
        },
        {
          id: 'chat_2',
          participant_id: '3',
          participant: {
            id: '3',
            username: 'Bob',
            email: 'bob@example.com',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          last_message: {
            id: 'msg_2',
            sender_id: '1',
            recipient_id: '3',
            encrypted_content: 'Thanks for the help!',
            message_type: 'text',
            created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
          },
          unread_count: 0,
          updated_at: new Date().toISOString(),
        },
      ];
      
      set({ chats: mockChats, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load chats',
      });
    }
  },

  loadMessages: async (recipientId: string, since?: string) => {
    set({ isLoading: true, error: null });
    
    try {
      // Mock messages for demonstration
      const mockMessages: Message[] = [
        {
          id: 'msg_1',
          sender_id: recipientId,
          recipient_id: '1',
          encrypted_content: 'Hello! How are you doing?',
          message_type: 'text',
          created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(), // 10 minutes ago
        },
        {
          id: 'msg_2',
          sender_id: '1',
          recipient_id: recipientId,
          encrypted_content: 'Hi! I\'m doing great, thanks for asking!',
          message_type: 'text',
          created_at: new Date(Date.now() - 1000 * 60 * 8).toISOString(), // 8 minutes ago
        },
        {
          id: 'msg_3',
          sender_id: recipientId,
          recipient_id: '1',
          encrypted_content: 'That\'s wonderful to hear! Are you working on any interesting projects?',
          message_type: 'text',
          created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 minutes ago
        },
        {
          id: 'msg_4',
          sender_id: '1',
          recipient_id: recipientId,
          encrypted_content: 'Yes! I\'m building an E2EE messenger app. It\'s quite challenging but fun!',
          message_type: 'text',
          created_at: new Date(Date.now() - 1000 * 60 * 3).toISOString(), // 3 minutes ago
        },
      ];

      set({ messages: mockMessages, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load messages',
      });
    }
  },

  sendMessage: async (recipientId: string, content: string, type: 'text' | 'file' | 'system') => {
    try {
      // Create a mock message for demonstration
      const mockMessage: Message = {
        id: `msg_${Date.now()}`,
        sender_id: '1', // Current user ID
        recipient_id: recipientId,
        encrypted_content: content, // In real app, this would be encrypted
        message_type: type,
        created_at: new Date().toISOString(),
      };

      // Add to local state immediately for better UX
      get().addMessage(mockMessage);

      // In a real app, you would:
      // 1. Encrypt the message
      // 2. Send to server
      // 3. Handle server response
      // 4. Update message status (sent, delivered, read)
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to send message',
      });
      throw error;
    }
  },

  setCurrentChat: (chat: Chat | null) => {
    set({ currentChat: chat });
    if (chat) {
      get().loadMessages(chat.participant_id);
    } else {
      get().clearMessages();
    }
  },

  addMessage: (message: Message) => {
    set((state) => ({
      messages: [...state.messages, message],
    }));
  },

  updateMessage: (messageId: string, updates: Partial<Message>) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId ? { ...msg, ...updates } : msg
      ),
    }));
  },

  markMessageAsRead: async (messageId: string) => {
    try {
      await apiService.sendReceipt({
        message_id: messageId,
        type: 'read',
      });
      
      get().updateMessage(messageId, { /* mark as read in UI */ });
    } catch (error) {
      console.error('Failed to mark message as read:', error);
    }
  },

  markMessageAsDelivered: async (messageId: string) => {
    try {
      await apiService.sendReceipt({
        message_id: messageId,
        type: 'delivered',
      });
      
      get().updateMessage(messageId, { /* mark as delivered in UI */ });
    } catch (error) {
      console.error('Failed to mark message as delivered:', error);
    }
  },

  clearMessages: () => {
    set({ messages: [] });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  clearError: () => {
    set({ error: null });
  },

  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },
}));
