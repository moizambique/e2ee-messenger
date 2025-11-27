import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useAuthStore } from './authStore';
import { useChatStore } from './chatStore';
import { webSocketService } from '../services/websocket';
import { apiService } from '../services/api';
import { UpdateProfileRequest } from '../types';

interface AuthContextType {
  isAuthenticated: boolean;
  user: any;
  deviceId: string | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  updateProfile: (data: UpdateProfileRequest) => Promise<void>;
  deleteAccount: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const {
    isAuthenticated,
    user,
    deviceId,
    token,
    isLoading,
    error,
    login,
    signup,
    updateProfile,
    deleteAccount,
    logout,
    clearError,
  } = useAuthStore();

  // Keep the apiService token in sync with the auth state
  useEffect(() => {
    apiService.setToken(token);
  }, [token]);

  // Initialize WebSocket connection when authenticated
  useEffect(() => {
    if (isAuthenticated && token && deviceId) {
      const wsUrl = apiService.getWebSocketUrl();
      
      webSocketService.connect(wsUrl, token, {
        onMessage: (message) => {
          console.log('WebSocket message received:', message);
          // Get the latest state from the store inside the callback
          const { addMessage, updateMessageStatus, currentChat } = useChatStore.getState();

          if (message.type === 'message_receipt') {
            const { message_id, type } = message.payload;
            if (type === 'delivered' || type === 'read') {
              updateMessageStatus(message_id, type);
            }
          } else if (message.type === 'new_message') {
            const incomingMessage = message.payload;
            
            // Only add the message if it belongs to the current open chat
            if (currentChat && currentChat.type === 'dm' && currentChat.participant && incomingMessage.sender_id === currentChat.participant.id) {
              addMessage(incomingMessage);
            } else if (currentChat && currentChat.type === 'group' && incomingMessage.group_id === currentChat.id) {
              // Add message if it's for the currently open group chat
              addMessage(incomingMessage);
            }
            // TODO: In the future, if the chat is not open, update the chat list with unread count.
          }
        },
        onStatusChange: (status) => {
          console.log('WebSocket status:', status);
        },
        onError: (error) => {
          console.error('WebSocket error:', error);
        },
      });
    } else {
      webSocketService.disconnect();
    }

    return () => {
      webSocketService.disconnect();
    };
  }, [isAuthenticated, token, deviceId]); // No need to re-run on chat change anymore

  const value: AuthContextType = {
    isAuthenticated,
    user,
    deviceId,
    token,
    isLoading,
    error,
    login,
    signup,
    updateProfile,
    deleteAccount,
    logout,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
