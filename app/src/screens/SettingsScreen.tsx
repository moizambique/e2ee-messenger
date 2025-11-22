import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { useAuth } from '../store/AuthContext';
import CustomAlert from './CustomAlert';
import { RootStackParamList } from '../types';

type SettingsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Main'>;

const SettingsScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const navigation = useNavigation<SettingsScreenNavigationProp>();

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', buttons: [] as any[] });

  const showAlert = (title: string, message: string, buttons: any[]) => {
    setAlertConfig({ title, message, buttons });
    setAlertVisible(true);
  };

  const handleLogout = () => {
    showAlert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel', onPress: () => {} },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  const handleProfile = () => {
    navigation.navigate('Profile');
  };

  const handleDeviceKeys = () => {
    navigation.navigate('DeviceKeys');
  };

  const handleDeleteAccount = () => {
    showAlert(
      'Delete Account',
      'This is a destructive action and cannot be undone. Are you sure you want to permanently delete your account?',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => {} },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            showAlert('Coming Soon', 'Account deletion will be implemented soon.', [
              { text: 'OK', onPress: () => {} },
            ]);
          },
        },
      ]
    );
  };

  const handleHelpAndSupport = () => {
    showAlert('Coming Soon', 'The help and support section will be available in a future update.', [
      { text: 'OK', onPress: () => {} },
    ]);
  };

  const handleKeyVerification = () => {
    // Example navigation, you might need to pass actual IDs
    navigation.navigate('KeyVerification', { userId: 'some-user-id', deviceId: 'some-device-id' });
  };

  const handleNotifications = () => {
    navigation.navigate('Notifications');
  };

  const handlePrivacy = () => {
    navigation.navigate('Privacy');
  };

  const handleAbout = () => {
    showAlert(
      'About E2EE Messenger',
      'Version 1.0.0\n\nA privacy-first end-to-end encrypted messaging app built with React Native and Go.',
      [{ text: 'OK', onPress: () => {} }]
    );
  };

  const renderSettingItem = (
    icon: keyof typeof Ionicons.glyphMap,
    title: string,
    subtitle?: string,
    onPress?: () => void,
    showArrow = true
  ) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress}>
      <View style={styles.settingIcon}>
        <Ionicons name={icon} size={24} color="#007AFF" />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {showArrow && (
        <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
      )}
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onClose={() => setAlertVisible(false)}
      />
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.username?.charAt(0).toUpperCase() || 'U'}
          </Text>
        </View>
        <Text style={styles.userName}>{user?.username || 'User'}</Text>
        <Text style={styles.userEmail}>{user?.email || 'user@example.com'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        {renderSettingItem('person-outline', 'Profile', 'Edit your profile information', handleProfile)}
        {renderSettingItem('shield-checkmark-outline', 'Key Verification', 'Verify contact safety numbers', handleKeyVerification)}
        {renderSettingItem('notifications-outline', 'Notifications', 'Manage notification preferences', handleNotifications)}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy & Security</Text>
        {renderSettingItem('lock-closed-outline', 'Privacy Settings', 'Control your privacy', handlePrivacy)}
        {renderSettingItem('key-outline', 'Device Keys', 'Manage your device keys', handleDeviceKeys)}
        {renderSettingItem('trash-outline', 'Delete Account', 'Permanently delete your account', handleDeleteAccount, false)}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support</Text>
        {renderSettingItem('help-circle-outline', 'Help & Support', 'Get help and contact support', handleHelpAndSupport)}
        {renderSettingItem('information-circle-outline', 'About', 'App version and information', handleAbout)}
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          E2EE Messenger v1.0.0
        </Text>
        <Text style={styles.footerSubtext}>
          Your messages are end-to-end encrypted
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#8E8E93',
  },
  section: {
    marginTop: 20,
    backgroundColor: '#fff',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingIcon: {
    width: 32,
    alignItems: 'center',
  },
  settingContent: {
    flex: 1,
    marginLeft: 12,
  },
  settingTitle: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginHorizontal: 20,
    marginVertical: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
    marginLeft: 8,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  footerText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  footerSubtext: {
    fontSize: 12,
    color: '#C7C7CC',
    marginTop: 4,
  },
});

export default SettingsScreen;
