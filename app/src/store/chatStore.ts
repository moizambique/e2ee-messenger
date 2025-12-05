import { create } from 'zustand';
import { Chat, Message, User } from '../types';
import { apiService } from '../services/api';
import { useAuthStore } from './authStore';
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
  loadMessages: (params: { recipientId?: string; groupId?: string; since?: string }) => Promise<void>;
  sendMessage: (targetId: string, content: string, type: 'text' | 'file' | 'system', isGroup: boolean) => Promise<void>;
  sendFileMessage: (targetId: string, fileUri: string, fileName: string, fileType: string, isGroup: boolean) => Promise<void>;
  setCurrentChat: (chat: Chat | null) => void;
  addMessage: (message: Message) => void;
  updateMessageStatus: (messageIds: string | string[], status: 'sent' | 'delivered' | 'read') => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  markMessagesAsRead: (messageIds: string[]) => Promise<void>;
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
      set({ chats: chats || [], isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load chats',
      });
    }
  },

  loadMessages: async (params: { recipientId?: string; groupId?: string; since?: string }) => {
    set({ isLoading: true, error: null });
    
    try {
      const { user } = useAuthStore.getState();
      const messages = await apiService.getMessages({ 
        recipient_id: params.recipientId, 
        group_id: params.groupId, 
        limit: 50 });
      const processedMessages = (messages || []).map(msg => {
        // If the message is from the other person, we don't show a status.
        // If it's our message, we can assume 'delivered' if it's coming from the server.
        // A more robust system would store this on the server.
        if (msg.sender_id === user?.id) {
          return { ...msg, status: 'delivered' as const };
        }
        return msg;
      });

      set({ messages: processedMessages, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load messages',
      });
    }
  },

  sendMessage: async (targetId: string, content: string, type: 'text' | 'file' | 'system', isGroup: boolean) => {
    const { user } = useAuthStore.getState();
    const tempId = `temp_${Date.now()}`;
    try {
      // In a real app, you would establish a session when starting a chat
      // For now, we do it before sending a message if it doesn't exist.
      // This part is still a mock and needs to be replaced with a real key exchange.
      // For groups, the session ID can just be the group ID.
      const deviceId = 'mock-device-id'; 
      const sessionId = isGroup ? targetId : `${targetId}_${deviceId}`;
      let session = await getSession(sessionId);
      if (!session) {
        // This preKeyBundle would be fetched from the server for the recipient
        const mockPreKeyBundle: any = { identityKey: 'mock', preKey: 'mock' };
        session = await establishSession(targetId, deviceId, mockPreKeyBundle);
      }

      const message: EncryptedMessage = {
        messageId: tempId, // The client-generated temporary ID
        senderId: user!.id,
        recipientId: targetId, // This was the typo
        content: content,
        type: type,
        timestamp: Date.now(),
      };

      // Optimistic UI: Add message with 'sending' status immediately
      const tempMessage: Message = {
        id: tempId,
        sender_id: user!.id,
        recipient_id: isGroup ? undefined : targetId,
        group_id: isGroup ? targetId : undefined,
        encrypted_content: await encryptMessage(session.id, message),
        message_type: type,
        created_at: new Date().toISOString(),
        status: 'sending',
      };
      get().addMessage(tempMessage);
      
      const encryptedContent = await encryptMessage(session.id, message);

      const sentMessage = await apiService.sendMessage({
        recipient_id: isGroup ? undefined : targetId,
        group_id: isGroup ? targetId : undefined,
        encrypted_content: encryptedContent,
        message_type: type,
      });

      // Update the temporary message with the real one from the server
      get().updateMessage(tempId, { ...sentMessage, status: 'sent' });

    } catch (error) {
      // If sending fails, update the status to 'failed'
      get().updateMessage(tempId, { status: 'failed' });
      set({
        error: error instanceof Error ? error.message : 'Failed to send message',
      });
      throw error;
    }
  },

  sendFileMessage: async (targetId: string, fileUri: string, fileName: string, fileType: string, isGroup: boolean) => {
    const { user } = useAuthStore.getState();
    const tempId = `temp_${Date.now()}`;
    try {
      // For this demo, the "encrypted key" is just a placeholder.
      // In a real app, you'd generate a random key, encrypt the file with it,
      // then encrypt that key with the session key.
      const mockEncryptedFileKey = `encrypted_key_for_${fileName}`;

      // The content of a file message is a JSON string with file metadata.
      const fileMessageContent = JSON.stringify({
        fileName,
        fileType,
        // In a real app, you'd include the file size here.
      });

      // 1. Optimistically add to UI using the LOCAL file URI
      const tempMessage: Message = {
        id: tempId,
        sender_id: user!.id,
        group_id: isGroup ? targetId : undefined,
        recipient_id: isGroup ? undefined : targetId,
        // The content is the metadata, but we add the local URI for rendering
        encrypted_content: JSON.stringify({ ...JSON.parse(fileMessageContent), localUri: fileUri }),
        message_type: 'file',
        created_at: new Date().toISOString(),
        status: 'sending',
      };
      get().addMessage(tempMessage);

      // 2. Send the initial message of type 'file' to the server
      const sentMessage = await apiService.sendMessage({
        recipient_id: isGroup ? undefined : targetId,
        group_id: isGroup ? targetId : undefined,
        encrypted_content: fileMessageContent, // This is just metadata
        message_type: 'file',
      });

      // 3. Upload the actual file attachment, linking it to the real message ID
      await apiService.uploadAttachment(
        fileUri,
        fileName,
        fileType,
        sentMessage.id,
        mockEncryptedFileKey
      );

      // 4. Update the message with the real ID from the server, but preserve
      // the localUri in encrypted_content for the optimistic UI to continue working
      // until the next full refresh. This avoids a race condition where the UI
      // tries to fetch the network image before it's available.
      get().updateMessage(tempId, {
        id: sentMessage.id,
        created_at: sentMessage.created_at,
        status: 'sent',
      });

    } catch (error) {
      get().updateMessage(tempId, { status: 'failed' });
      set({
        error: error instanceof Error ? error.message : 'Failed to send file',
      });
      throw error;
    }
  },

  setCurrentChat: (chat: Chat | null) => {
    set({ currentChat: chat });
    if (chat && chat.type === 'dm' && chat.participant) {
      get().loadMessages({ recipientId: chat.participant.id });
    } else if (chat && chat.type === 'group') {
      get().loadMessages({ groupId: chat.id });
    } else {
      get().clearMessages();
    }
  },

  addMessage: (message: Message) => {
    set((state) => ({
      messages: [...state.messages, message],
    }));
  },

  updateMessageStatus: (messageIds: string | string[], status: 'sent' | 'delivered' | 'read') => {
    const idSet = new Set(Array.isArray(messageIds) ? messageIds : [messageIds]);
    set((state) => ({
      messages: state.messages.map((msg) =>
        idSet.has(msg.id) ? { ...msg, status } : msg,
      ),
    }));
  },

  updateMessage: (messageId: string, updates: Partial<Message>) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId ? { ...msg, ...updates } : msg
      ),
    }));
  },

  markMessagesAsRead: async (messageIds: string[]) => {
    if (messageIds.length === 0) return;

    // Optimistically update the UI to prevent the infinite loop.
    // We mark messages as 'read' locally before sending receipts.
    get().updateMessageStatus(messageIds, 'read');

    try {
      // Then, send the receipts to the server.
      await Promise.all(messageIds.map(id => apiService.sendReceipt({
        message_id: id,
        type: 'read',
      })));
    } catch (error) {
      console.error('Failed to send read receipts:', error);
      // Optional: Revert the status on failure. For this implementation,
      // we'll leave them as 'read' to prevent re-triggering the effect loop.
    }
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
