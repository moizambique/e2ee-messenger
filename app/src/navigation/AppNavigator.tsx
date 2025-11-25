import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../store/AuthContext';
import AuthNavigator from './AuthNavigator';
import ChatsScreen from '../screens/ChatsScreen';
import ChatScreen from '../screens/ChatScreen';
import SettingsScreen from '../screens/SettingsScreen';
import KeyVerificationScreen from '../screens/KeyVerificationScreen';
import ContactsScreen from '../screens/ContactsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import PrivacyScreen from '../screens/PrivacyScreen';
import DeviceKeysScreen from '../screens/DeviceKeysScreen';
import { RootStackParamList, MainTabParamList } from '../types';

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Chats') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'Contacts') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          } else {
            iconName = 'help-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Chats" 
        component={ChatsScreen}
        options={{ title: 'Chats' }}
      />
      <Tab.Screen 
        name="Contacts" 
        component={ContactsScreen}
        options={{ title: 'Contacts' }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
    </Tab.Navigator>
  );
};

const AppNavigator: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabNavigator} />
          <Stack.Screen 
            name="Chat" 
            component={ChatScreen}
            options={{
              headerShown: true,
              title: 'Chat',
              headerBackTitle: 'Back'
            }}
          />
          <Stack.Screen 
            name="KeyVerification" 
            component={KeyVerificationScreen}
            options={{ 
              headerShown: true,
              title: 'Key Verification',
              headerBackTitle: 'Back'
            }}
          />
          <Stack.Screen 
            name="Profile" 
            component={ProfileScreen}
            options={{ 
              headerShown: true,
              title: 'Profile',
              headerBackTitle: 'Settings'
            }}
          />
          <Stack.Screen 
            name="Notifications" 
            component={NotificationsScreen}
            options={{ 
              headerShown: true,
              title: 'Notifications',
              headerBackTitle: 'Settings'
            }}
          />
          <Stack.Screen 
            name="Privacy" 
            component={PrivacyScreen}
            options={{ 
              headerShown: true,
              title: 'Privacy Settings',
              headerBackTitle: 'Settings'
            }}
          />
          <Stack.Screen 
            name="DeviceKeys" 
            component={DeviceKeysScreen}
            options={{ headerShown: true, title: 'Device Keys', headerBackTitle: 'Settings' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;
