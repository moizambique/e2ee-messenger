import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert as RNAlert,
} from 'react-native';
import { Buffer } from 'buffer';
import { useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useChatStore } from '../store/chatStore';
import { useAuth } from '../store/AuthContext';
import { RootStackParamList, Message } from '../types';

type ChatScreenRouteProp = RouteProp<RootStackParamList, 'Chat'>;

const ChatScreen: React.FC = () => {
  const route = useRoute<ChatScreenRouteProp>();
  const { participant } = route.params;
  const { user } = useAuth();
  const { 
    messages, 
    isLoading, 
    error, 
    loadMessages,
    setCurrentChat,
    sendMessage, 
    markMessagesAsRead,
    addMessage,
    clearError 
  } = useChatStore();
  
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    // Set the current chat when the screen mounts
    // The chat object can be minimal as long as it has the participant
    const currentChat = {
      id: `chat_${participant.id}`,
      participant: participant,
      unread_count: 0,
      updated_at: new Date().toISOString(),
    };
    setCurrentChat(currentChat);

    // Cleanup: Clear the current chat when the screen unmounts
    return () => {
      setCurrentChat(null);
    };
  }, [participant, setCurrentChat]);

  useEffect(() => {
    // When messages change, check for unread messages from the participant
    // and mark them as read.
    const unreadMessageIds = messages
      .filter(msg => 
        msg.sender_id === participant.id && msg.recipient_id === user?.id &&
        (!msg.status || msg.status !== 'read') // A more robust check might be needed
      )
      .map(msg => msg.id);

    if (unreadMessageIds.length > 0) {
      markMessagesAsRead(unreadMessageIds);
    }
  }, [messages, participant.id, markMessagesAsRead]);

  useEffect(() => {
    if (error) {
      RNAlert.alert('Error', error, [
        { text: 'OK', onPress: clearError }
      ]);
    }
  }, [error, clearError]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || sending) return;

    const text = messageText.trim();
    setMessageText('');
    setSending(true);

    try {
      await sendMessage(participant.id, text, 'text');
      // Scroll to bottom after sending
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      // Restore message text on error
      setMessageText(text);
      RNAlert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const renderStatusIndicator = (status?: Message['status']) => {
    if (!status) return null;

    switch (status) {
      case 'sending':
        return <Ionicons name="time-outline" size={14} color="rgba(255, 255, 255, 0.7)" style={styles.statusIcon} />;
      case 'sent':
        return <Ionicons name="checkmark-outline" size={14} color="rgba(255, 255, 255, 0.7)" style={styles.statusIcon} />;
      case 'delivered':
        return <Ionicons name="checkmark-done-outline" size={14} color="rgba(255, 255, 255, 0.7)" style={styles.statusIcon} />;
      case 'read':
        return <Ionicons name="checkmark-done-outline" size={14} color="#4F8EF7" style={styles.statusIcon} />; // A different color for read
      case 'failed':
        return <Ionicons name="alert-circle-outline" size={14} color="#FF3B30" style={styles.statusIcon} />;
      default:
        return null;
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwn = item.sender_id === user?.id;
    
    return (
      <View style={[styles.messageContainer, isOwn && styles.ownMessageContainer]}>
        <View style={[styles.messageBubble, isOwn && styles.ownMessageBubble]}>
          <Text style={[styles.messageText, isOwn && styles.ownMessageText]}>
            {(() => {
              try {
                const decoded = Buffer.from(item.encrypted_content, 'base64').toString('utf-8');
                const parsed = JSON.parse(decoded);
                return parsed.content || item.encrypted_content;
              } catch (e) {
                return item.encrypted_content;
              }
            })()}
          </Text>          
          <View style={styles.messageInfo}>
            <Text style={[styles.messageTime, isOwn && styles.ownMessageTime]}>
              {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isOwn && renderStatusIndicator(item.status)}
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="chatbubble-outline" size={60} color="#C7C7CC" />
      <Text style={styles.emptyTitle}>No messages yet</Text>
      <Text style={styles.emptySubtitle}>
        Start the conversation with {participant.username}
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {participant.username.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.headerName}>{participant.username}</Text>
            <Text style={styles.headerStatus}>Online</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.headerButton}>
          <Ionicons name="call-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={messages.length === 0 ? styles.emptyContainer : styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.textInput}
            value={messageText}
            onChangeText={setMessageText}
            placeholder={`Message ${participant.username}...`}
            multiline
            maxLength={1000}
            editable={!sending}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!messageText.trim() || sending) && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={!messageText.trim() || sending}
          >
            <Ionicons 
              name="send" 
              size={20} 
              color={(!messageText.trim() || sending) ? "#C7C7CC" : "#007AFF"} 
            />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  headerStatus: {
    fontSize: 14,
    color: '#34C759',
    marginTop: 2,
  },
  headerButton: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
  },
  messagesList: {
    paddingVertical: 20,
  },
  messageContainer: {
    marginHorizontal: 20,
    marginVertical: 4,
  },
  ownMessageContainer: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomLeftRadius: 4,
  },
  ownMessageBubble: {
    backgroundColor: '#007AFF',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 16,
    color: '#000',
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#fff',
  },
  messageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 12,
    color: '#8E8E93',
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  statusIcon: {
    marginLeft: 4,
  },
  inputContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E1E1E1',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    marginLeft: 12,
    padding: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default ChatScreen;
