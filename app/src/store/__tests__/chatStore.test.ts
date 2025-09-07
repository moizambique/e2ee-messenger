import { useChatStore } from '../chatStore';
import { Message, Chat } from '../../types';

// Mock the API service
jest.mock('../../services/api', () => ({
  apiService: {
    getMessages: jest.fn(),
    sendMessage: jest.fn(),
    sendReceipt: jest.fn(),
  },
}));

// Mock the crypto module
jest.mock('../../crypto/crypto', () => ({
  getSession: jest.fn(),
  decryptMessage: jest.fn(),
  encryptMessage: jest.fn(),
}));

describe('Chat Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    useChatStore.setState({
      chats: [],
      currentChat: null,
      messages: [],
      isLoading: false,
      error: null,
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useChatStore.getState();
      
      expect(state.chats).toEqual([]);
      expect(state.currentChat).toBeNull();
      expect(state.messages).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('setCurrentChat', () => {
    it('should set current chat and load messages', () => {
      const mockChat: Chat = {
        id: 'chat-1',
        participant_id: 'user-1',
        participant: {
          id: 'user-1',
          username: 'testuser',
          email: 'test@example.com',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
        unread_count: 0,
        updated_at: '2023-01-01T00:00:00Z',
      };

      useChatStore.getState().setCurrentChat(mockChat);
      
      const state = useChatStore.getState();
      expect(state.currentChat).toEqual(mockChat);
    });

    it('should clear messages when setting current chat to null', () => {
      // First set some messages
      useChatStore.setState({
        messages: [
          {
            id: 'msg-1',
            sender_id: 'user-1',
            recipient_id: 'user-2',
            encrypted_content: 'Hello',
            message_type: 'text',
            created_at: '2023-01-01T00:00:00Z',
          },
        ],
      });

      useChatStore.getState().setCurrentChat(null);
      
      const state = useChatStore.getState();
      expect(state.currentChat).toBeNull();
      expect(state.messages).toEqual([]);
    });
  });

  describe('addMessage', () => {
    it('should add message to messages array', () => {
      const newMessage: Message = {
        id: 'msg-1',
        sender_id: 'user-1',
        recipient_id: 'user-2',
        encrypted_content: 'Hello',
        message_type: 'text',
        created_at: '2023-01-01T00:00:00Z',
      };

      useChatStore.getState().addMessage(newMessage);
      
      const state = useChatStore.getState();
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0]).toEqual(newMessage);
    });

    it('should add multiple messages', () => {
      const message1: Message = {
        id: 'msg-1',
        sender_id: 'user-1',
        recipient_id: 'user-2',
        encrypted_content: 'Hello',
        message_type: 'text',
        created_at: '2023-01-01T00:00:00Z',
      };

      const message2: Message = {
        id: 'msg-2',
        sender_id: 'user-2',
        recipient_id: 'user-1',
        encrypted_content: 'Hi there',
        message_type: 'text',
        created_at: '2023-01-01T00:01:00Z',
      };

      useChatStore.getState().addMessage(message1);
      useChatStore.getState().addMessage(message2);
      
      const state = useChatStore.getState();
      expect(state.messages).toHaveLength(2);
      expect(state.messages[0]).toEqual(message1);
      expect(state.messages[1]).toEqual(message2);
    });
  });

  describe('updateMessage', () => {
    it('should update existing message', () => {
      const message: Message = {
        id: 'msg-1',
        sender_id: 'user-1',
        recipient_id: 'user-2',
        encrypted_content: 'Hello',
        message_type: 'text',
        created_at: '2023-01-01T00:00:00Z',
      };

      useChatStore.setState({ messages: [message] });
      useChatStore.getState().updateMessage('msg-1', { 
        encrypted_content: 'Updated message' 
      });
      
      const state = useChatStore.getState();
      expect(state.messages[0].encrypted_content).toBe('Updated message');
    });

    it('should not update non-existent message', () => {
      const message: Message = {
        id: 'msg-1',
        sender_id: 'user-1',
        recipient_id: 'user-2',
        encrypted_content: 'Hello',
        message_type: 'text',
        created_at: '2023-01-01T00:00:00Z',
      };

      useChatStore.setState({ messages: [message] });
      useChatStore.getState().updateMessage('non-existent', { 
        encrypted_content: 'Updated message' 
      });
      
      const state = useChatStore.getState();
      expect(state.messages[0].encrypted_content).toBe('Hello');
    });
  });

  describe('clearMessages', () => {
    it('should clear all messages', () => {
      const messages: Message[] = [
        {
          id: 'msg-1',
          sender_id: 'user-1',
          recipient_id: 'user-2',
          encrypted_content: 'Hello',
          message_type: 'text',
          created_at: '2023-01-01T00:00:00Z',
        },
        {
          id: 'msg-2',
          sender_id: 'user-2',
          recipient_id: 'user-1',
          encrypted_content: 'Hi there',
          message_type: 'text',
          created_at: '2023-01-01T00:01:00Z',
        },
      ];

      useChatStore.setState({ messages });
      useChatStore.getState().clearMessages();
      
      const state = useChatStore.getState();
      expect(state.messages).toEqual([]);
    });
  });

  describe('setError and clearError', () => {
    it('should set error message', () => {
      const errorMessage = 'Something went wrong';
      useChatStore.getState().setError(errorMessage);
      
      const state = useChatStore.getState();
      expect(state.error).toBe(errorMessage);
    });

    it('should clear error message', () => {
      useChatStore.setState({ error: 'Some error' });
      useChatStore.getState().clearError();
      
      const state = useChatStore.getState();
      expect(state.error).toBeNull();
    });
  });

  describe('setLoading', () => {
    it('should set loading state', () => {
      useChatStore.getState().setLoading(true);
      
      const state = useChatStore.getState();
      expect(state.isLoading).toBe(true);
    });

    it('should clear loading state', () => {
      useChatStore.setState({ isLoading: true });
      useChatStore.getState().setLoading(false);
      
      const state = useChatStore.getState();
      expect(state.isLoading).toBe(false);
    });
  });
});
