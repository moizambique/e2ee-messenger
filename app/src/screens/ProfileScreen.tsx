import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../store/AuthContext';
import CustomAlert from './CustomAlert';

const ProfileScreen: React.FC = () => {
  const { user, updateProfile, changePassword, isLoading } = useAuth();
  const usernameInputRef = useRef<TextInput>(null);

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', buttons: [] as any[] });

  // State for editable fields
  const [username, setUsername] = useState(user?.username || '');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);


  const showAlert = (title: string, message: string, buttons: any[]) => {
    setAlertConfig({ title, message, buttons });
    setAlertVisible(true);
  };

  const handleSaveChanges = async () => {
    if (username.trim() === user?.username) {
      setIsEditingUsername(false);
      return;
    }

    try {
      await updateProfile({ username: username.trim() });
      showAlert('Success', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => {} },
      ]);
      setIsEditingUsername(false);
    } catch (error) {
      // The error is already set in the store, but we can show an alert here too.
      showAlert('Update Failed', error instanceof Error ? error.message : 'An unknown error occurred.', [
        { text: 'OK', onPress: () => {} },
      ]);
    }
  };

  const handleEditPhoto = () => {
    showAlert('Coming Soon', 'Changing your profile picture will be available in a future update.', [
      { text: 'OK', onPress: () => {} },
    ]);
  };

  const handleEditUsername = () => {
    setIsEditingUsername(true);
    // Focus the input field after a short delay
    setTimeout(() => usernameInputRef.current?.focus(), 100);
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      showAlert('Error', 'Please fill in all password fields.', [{ text: 'OK', onPress: () => {} }]);
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert('Error', 'New passwords do not match.', [{ text: 'OK', onPress: () => {} }]);
      return;
    }
    if (newPassword.length < 8) {
      showAlert('Error', 'New password must be at least 8 characters long.', [{ text: 'OK', onPress: () => {} }]);
      return;
    }

    try {
      await changePassword({ old_password: oldPassword, new_password: newPassword });
      showAlert('Success', 'Your password has been changed successfully.', [{ text: 'OK', onPress: () => {} }]);
      setIsChangingPassword(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      showAlert('Password Change Failed', error instanceof Error ? error.message : 'An unknown error occurred.', [
        { text: 'OK', onPress: () => {} },
      ]);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onClose={() => setAlertVisible(false)}
      />
      <View style={styles.header}>
        <TouchableOpacity style={styles.avatarContainer} onPress={handleEditPhoto}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          <View style={styles.cameraIconContainer}>
            <Ionicons name="camera" size={20} color="#fff" />
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Username</Text>
          <View style={styles.inputRow}>
            <TextInput
              ref={usernameInputRef}
              style={[styles.input, !isEditingUsername && styles.inputDisabled]}
              value={username}
              onChangeText={setUsername}
              editable={isEditingUsername && !isLoading}
              autoCapitalize="none"
            />
            {!isEditingUsername && (
              <TouchableOpacity onPress={handleEditUsername} style={styles.editButton}>
                <Ionicons name="pencil" size={20} color="#007AFF" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Email</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={user?.email || ''}
              editable={false}
            />
          </View>
        </View>
      </View>

      {isEditingUsername && (
        <TouchableOpacity style={styles.saveButton} onPress={handleSaveChanges} disabled={isLoading}>
          <Text style={styles.saveButtonText}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.section}>
        {!isChangingPassword ? (
          <TouchableOpacity style={styles.changePasswordButton} onPress={() => setIsChangingPassword(true)}>
            <Text style={styles.changePasswordButtonText}>Change Password</Text>
          </TouchableOpacity>
        ) : (
          <>
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Current Password</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  secureTextEntry={!showOldPassword}
                  value={oldPassword}
                  onChangeText={setOldPassword}
                  editable={!isLoading}
                />
                <TouchableOpacity onPress={() => setShowOldPassword(!showOldPassword)} style={styles.editButton}>
                  <Ionicons name={showOldPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#8E8E93" />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>New Password</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  secureTextEntry={!showNewPassword}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  editable={!isLoading}
                />
                <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={styles.editButton}>
                  <Ionicons name={showNewPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#8E8E93" />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Confirm New Password</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  editable={!isLoading}
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.editButton}>
                  <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#8E8E93" />
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </View>

      {isChangingPassword && (
        <TouchableOpacity style={styles.saveButton} onPress={handleChangePassword} disabled={isLoading}>
          <Text style={styles.saveButtonText}>{isLoading ? 'Saving...' : 'Update Password'}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  contentContainer: {
    paddingBottom: 40,
  },
  header: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 40,
    fontWeight: 'bold',
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#007AFF',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  section: {
    marginTop: 30,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
  },
  fieldContainer: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  label: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    height: 40,
  },
  inputDisabled: {
    color: '#8E8E93',
  },
  editButton: {
    padding: 8,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 40,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  changePasswordButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  changePasswordButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
});

export default ProfileScreen;