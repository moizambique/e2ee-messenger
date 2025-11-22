import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useAuthStore } from './authStore';
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
          // Handle incoming messages here
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
  }, [isAuthenticated, token, deviceId]);

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
