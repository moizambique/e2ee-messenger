import { create } from 'zustand';
import { Chat, Message, User } from '../types';
import { apiService } from '../services/api';
import { EncryptedMessage } from '../crypto/types';
import { encryptMessage, decryptMessage, getSession, establishSession } from '../crypto/crypto';

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
      const chats = await apiService.getChats();
      set({ chats, isLoading: false });
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
      const messages = await apiService.getMessages({ recipient_id: recipientId, limit: 50 });
      set({ messages: messages || [], isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load messages',
      });
    }
  },

  sendMessage: async (recipientId: string, content: string, type: 'text' | 'file' | 'system') => {
    const tempId = `temp_${Date.now()}`;
    try {
      // In a real app, you would establish a session when starting a chat
      // For now, we do it before sending a message if it doesn't exist.
      const deviceId = 'mock-device-id'; // This would come from the user object or key bundle
      const sessionId = `${recipientId}_${deviceId}`;
      let session = await getSession(sessionId);
      if (!session) {
        // This preKeyBundle would be fetched from the server for the recipient
        const mockPreKeyBundle: any = { identityKey: 'mock', preKey: 'mock' };
        session = await establishSession(recipientId, deviceId, mockPreKeyBundle);
      }

      const message: EncryptedMessage = {
        messageId: tempId,
        senderId: 'self', // Will be set by the server
        recipientId: recipientId,
        content: content,
        type: type,
        timestamp: Date.now(),
      };

      const encryptedContent = await encryptMessage(session.id, message);

      const sentMessage = await apiService.sendMessage({
        recipient_id: recipientId,
        encrypted_content: encryptedContent,
        message_type: type,
      });

      // Add to local state immediately for better UX
      get().addMessage(sentMessage);
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
      get().loadMessages(chat.participant.id);
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
