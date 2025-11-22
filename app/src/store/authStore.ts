import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, AuthResponse, UpdateProfileRequest } from '../types';
import { apiService } from '../services/api';
import { clearAll } from '../crypto/crypto';

interface AuthState {
  // State
  isAuthenticated: boolean;
  user: User | null;
  deviceId: string | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  updateProfile: (data: UpdateProfileRequest) => Promise<void>;
  logout: () => Promise<void>;
  setError: (error: string | null) => void;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      isAuthenticated: false,
      user: null,
      deviceId: null,
      token: null,
      isLoading: false,
      error: null,

      // Actions
      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        
        try {
          const response: AuthResponse = await apiService.login({ email, password });
          
          // Set API token
          apiService.setToken(response.token);
          
          set({
            isAuthenticated: true,
            user: response.user,
            deviceId: response.device_id,
            token: response.token,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Login failed',
          });
          throw error;
        }
      },

      signup: async (username: string, email: string, password: string) => {
        set({ isLoading: true, error: null });
        
        try {
          const response: AuthResponse = await apiService.signup({ 
            username, 
            email, 
            password 
          });
          
          // Set API token
          apiService.setToken(response.token);
          
          set({
            isAuthenticated: true,
            user: response.user,
            deviceId: response.device_id,
            token: response.token,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Signup failed',
          });
          throw error;
        }
      },

      updateProfile: async (data: UpdateProfileRequest) => {
        set({ isLoading: true, error: null });
        try {
          const updatedUser = await apiService.updateProfile(data);
          set({
            user: updatedUser,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Profile update failed';
          set({
            isLoading: false,
            error: errorMessage,
          });
          // Re-throw to be caught in the component
          throw new Error(errorMessage);
        }
      },

      logout: async () => {
        set({ isLoading: true });
        
        try {
          // Clear crypto data
          await clearAll();
          
          // Clear API token
          apiService.setToken(null);
          
          set({
            isAuthenticated: false,
            user: null,
            deviceId: null,
            token: null,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          console.error('Error during logout:', error);
          // Still clear the state even if there's an error
          set({
            isAuthenticated: false,
            user: null,
            deviceId: null,
            token: null,
            isLoading: false,
            error: null,
          });
        }
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
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        deviceId: state.deviceId,
        token: state.token,
      }),
    }
  )
);
