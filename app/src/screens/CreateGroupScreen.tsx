import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert as RNAlert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import { apiService } from '../services/api';
import { User, RootStackParamList } from '../types';

type CreateGroupScreenNavigationProp = StackNavigationProp<RootStackParamList, 'CreateGroup'>;

const CreateGroupScreen: React.FC = () => {
  const navigation = useNavigation<CreateGroupScreenNavigationProp>();
  const [groupName, setGroupName] = useState('');
  const [contacts, setContacts] = useState<User[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadContacts = async () => {
      setIsLoading(true);
      try {
        const fetchedContacts = await apiService.getUsers();
        setContacts(fetchedContacts);
      } catch (error) {
        RNAlert.alert('Error', 'Failed to load contacts.');
      } finally {
        setIsLoading(false);
      }
    };
    loadContacts();
  }, []);

  const toggleContactSelection = (contactId: string) => {
    const newSelection = new Set(selectedContacts);
    if (newSelection.has(contactId)) {
      newSelection.delete(contactId);
    } else {
      newSelection.add(contactId);
    }
    setSelectedContacts(newSelection);
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      RNAlert.alert('Invalid Name', 'Please enter a name for the group.');
      return;
    }
    if (selectedContacts.size === 0) {
      RNAlert.alert('No Members', 'Please select at least one contact to form a group.');
      return;
    }

    setIsLoading(true);
    try {
      await apiService.createGroup({
        name: groupName.trim(),
        member_ids: Array.from(selectedContacts),
      });

      // TODO: In the future, you might want to navigate directly to the new group chat
      // For now, just show success and go back.
      RNAlert.alert('Success', `Group "${groupName}" has been created.`);
      navigation.goBack();
    } catch (error) {
      RNAlert.alert('Error', error instanceof Error ? error.message : 'Failed to create group.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderContactItem = ({ item }: { item: User }) => {
    const isSelected = selectedContacts.has(item.id);
    return (
      <TouchableOpacity
        style={styles.contactItem}
        onPress={() => toggleContactSelection(item.id)}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.username.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.contactContent}>
          <Text style={styles.contactName}>{item.username}</Text>
          <Text style={styles.contactEmail}>{item.email}</Text>
        </View>
        <View style={styles.checkbox}>
          <Ionicons
            name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={isSelected ? '#007AFF' : '#C7C7CC'}
          />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancelButton}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Group</Text>
        <TouchableOpacity onPress={handleCreateGroup} disabled={isLoading}>
          <Text style={styles.createButton}>Create</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.groupNameContainer}>
        <TextInput
          style={styles.groupNameInput}
          placeholder="Group Name"
          value={groupName}
          onChangeText={setGroupName}
          placeholderTextColor="#8E8E93"
        />
      </View>

      <FlatList
        data={contacts}
        keyExtractor={(item) => item.id}
        renderItem={renderContactItem}
        ListHeaderComponent={<Text style={styles.listHeader}>Select Contacts</Text>}
        contentContainerStyle={styles.listContainer}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
    backgroundColor: '#F8F8F8',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  cancelButton: {
    fontSize: 17,
    color: '#007AFF',
  },
  createButton: {
    fontSize: 17,
    color: '#007AFF',
    fontWeight: '600',
  },
  groupNameContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
  },
  groupNameInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  listContainer: {
    paddingBottom: 20,
  },
  listHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  contactContent: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  contactEmail: {
    fontSize: 14,
    color: '#8E8E93',
  },
  checkbox: {
    marginLeft: 16,
  },
});

export default CreateGroupScreen;