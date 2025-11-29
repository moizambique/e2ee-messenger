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
  Image,
} from 'react-native';
import { Linking } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Buffer } from 'buffer';
import { useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useChatStore } from '../store/chatStore';
import { apiService } from '../services/api';
import { useAuth } from '../store/AuthContext';
import { useImageAspectRatio } from './useImageAspectRatio';
import Avatar from '../types/Avatar';
import { RootStackParamList, Message } from '../types';

type GroupChatScreenRouteProp = RouteProp<RootStackParamList, 'GroupChat'>;

const GroupChatScreen: React.FC = () => {
  const route = useRoute<GroupChatScreenRouteProp>();
  const { chat } = route.params;
  const { user } = useAuth();
  const { 
    messages, 
    isLoading, 
    error, 
    setCurrentChat,
    sendMessage, 
    sendFileMessage,
    clearError 
  } = useChatStore();
  
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    // Set the current chat when the screen mounts
    setCurrentChat(chat);

    // Cleanup: Clear the current chat when the screen unmounts
    return () => {
      setCurrentChat(null);
    };
  }, [chat, setCurrentChat]);

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
      await sendMessage(chat.id, text, 'text', true);
      // Scroll to bottom after sending
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      setMessageText(text);
      RNAlert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({});
      if (result.canceled === false) {
        const { uri, name, mimeType } = result.assets[0];
        if (mimeType) {
          // For group chats, isGroup is true
          await sendFileMessage(chat.id, uri, name, mimeType, true);
        } else {
          RNAlert.alert('Error', 'Could not determine file type.');
        }
      }
    } catch (error) {
      RNAlert.alert('Error', 'Failed to pick document.');
      console.error(error);
    }
  };

  const handleDownloadAttachment = async (message: Message) => {
    try {
      const fileInfo = JSON.parse(message.encrypted_content);
      const { fileName } = fileInfo;
      if (!fileName) {
        RNAlert.alert('Error', 'File information is missing.');
        return;
      }

      const baseUrl = apiService.getAttachmentDownloadUrl(message.id, fileName);
      const token = apiService.getToken();

      if (Platform.OS === 'web') {
        const downloadUrlWithToken = `${baseUrl}?token=${token}`;
        Linking.openURL(downloadUrlWithToken);
      } else {
        const localUri = FileSystem.documentDirectory + fileName;
        RNAlert.alert('Downloading', `Downloading ${fileName}...`);
        const { uri } = await FileSystem.downloadAsync(baseUrl, localUri, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('Finished downloading to ', uri);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri);
        }
      }
    } catch (error) {
      console.error('Download failed:', error);
      RNAlert.alert('Download Failed', 'Could not download the attachment.');
    }
  };

  const ImageAttachment: React.FC<{ item: Message; isOwn: boolean }> = ({ item, isOwn }) => {
    const fileInfo = JSON.parse(item.encrypted_content);
    const baseUrl = apiService.getAttachmentDownloadUrl(item.id, fileInfo.fileName);
    const token = apiService.getToken();
    const imageUrl = Platform.OS === 'web' ? `${baseUrl}?token=${token}` : baseUrl;
    const headers = Platform.OS === 'web' ? undefined : { Authorization: `Bearer ${token}` };
    const aspectRatio = useImageAspectRatio(imageUrl, headers);
    const imageStyle = { ...styles.imageAttachment, aspectRatio: aspectRatio || 1 };
    const imageSource = { uri: imageUrl, headers };
    return <Image source={imageSource} style={[styles.messageBubble, isOwn && styles.ownMessageBubble, imageStyle]} resizeMode="contain" />;
  };

  const renderMessage = ({ item, index }: { item: Message, index: number }) => {
    const isOwn = item.sender_id === user?.id;

    // Determine if the sender's name should be shown
    const showSenderName = !isOwn && (
      index === 0 || // Always show for the first message in the list
      (messages[index - 1] && messages[index - 1].sender_id !== item.sender_id) // Show if sender is different from previous
    );

    if (item.message_type === 'file') {
      let fileInfo: { fileName: string; fileType: string } | null = null;
      try {
        fileInfo = JSON.parse(item.encrypted_content);
      } catch (e) { /* Not a valid file message */ }

      const isImage = fileInfo?.fileType?.startsWith('image/');

      if (isImage && fileInfo) {
        return (
          <View style={[styles.messageContainer, isOwn && styles.ownMessageContainer]}>
            {showSenderName && (
              <Text style={styles.senderName}>{item.sender?.username || 'Unknown User'}</Text>
            )}
            <TouchableOpacity
              onPress={() => handleDownloadAttachment(item)}
              style={isOwn ? styles.touchableBubbleWrapper : {}}
            >
              <ImageAttachment item={item} isOwn={isOwn} />
              <View style={styles.messageInfoOnImage}>
                <Text style={[styles.messageTime, styles.ownMessageTime]}>
                  {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        );
      }

      // Fallback for non-image files
      return (
        <View style={[styles.messageContainer, isOwn && styles.ownMessageContainer]}>
          {showSenderName && (
            <Text style={styles.senderName}>{item.sender?.username || 'Unknown User'}</Text>
          )}
          <TouchableOpacity
            onPress={() => handleDownloadAttachment(item)}
            style={isOwn ? styles.touchableBubbleWrapper : {}}
          >
            <View style={[styles.messageBubble, isOwn && styles.ownMessageBubble, styles.fileBubble]}>
              <Ionicons name="document-outline" size={24} color={isOwn ? '#fff' : '#007AFF'} style={styles.fileIcon} />
              <View style={styles.fileInfo}>
                <Text style={[styles.fileName, isOwn && styles.ownMessageText]} numberOfLines={1}>
                  {fileInfo?.fileName || 'File Attachment'}
                </Text>
                <Text style={[styles.fileSize, isOwn && styles.ownMessageTime]}>
                  Tap to download
                </Text>
              </View>
              <View style={styles.messageInfo}>
                <Text style={[styles.messageTime, isOwn && styles.ownMessageTime]}>
                  {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      );
    }
    
    return (
      <View style={[styles.messageContainer, isOwn && styles.ownMessageContainer]}>
        {showSenderName && (
          <Text style={styles.senderName}>{item.sender?.username || 'Unknown User'}</Text>
        )}
        <View style={[styles.messageBubble, isOwn && styles.ownMessageBubble]}>
          <Text style={[styles.messageText, isOwn && styles.ownMessageText]}>
            {(() => {
              try {
                const decoded = Buffer.from(item.encrypted_content, 'base64').toString('utf-8');
                const parsed = JSON.parse(decoded);
                return parsed.content || item.encrypted_content;
              } catch (e) {
                // If it's not JSON, it might be a file metadata string from an older version
                return item.encrypted_content;
              }
            })()}
          </Text>          
          <View style={styles.textMessageInfo}>
            <Text style={[styles.messageTime, isOwn && styles.ownMessageTime]}>
              {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="chatbubbles-outline" size={60} color="#C7C7CC" />
      <Text style={styles.emptyTitle}>Welcome to {chat.name}!</Text>
      <Text style={styles.emptySubtitle}>
        Be the first to send a message.
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
          <Avatar name={chat.name} size={40} isGroup={true} />
          <View>
            <Text style={styles.headerName}>{chat.name}</Text>
            <Text style={styles.headerStatus}>{chat.participant_count} members</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.headerButton}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={messages.length === 0 ? styles.emptyContainer : styles.messagesList}
      />

      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TouchableOpacity style={styles.attachButton} onPress={handlePickDocument}>
            <Ionicons name="attach" size={24} color="#007AFF" />
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            value={messageText}
            onChangeText={setMessageText}
            placeholder={`Message ${chat.name}...`}
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
  senderName: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
    marginLeft: 16,
  },
  headerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  headerStatus: {
    fontSize: 14,
    color: '#8E8E93',
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
    alignItems: 'flex-start', // Add this to align received messages to the left
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
  textMessageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 4,
    paddingTop: 4,
  },
  messageTime: {
    fontSize: 12,
    color: '#8E8E93',
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
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
  attachButton: {
    padding: 8,
    marginRight: 4,
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
  fileBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 24,
    position: 'relative',
  },
  imageAttachment: {
    width: 250,
    borderRadius: 18,
    backgroundColor: '#E1E1E1',
  },
  fileIcon: {
    marginRight: 12,
  },
  fileInfo: {
    flexShrink: 1,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '500',
  },
  fileSize: {
    fontSize: 12,
    color: '#8E8E93',
  },
  messageInfo: {
    position: 'absolute',
    bottom: 8,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  messageInfoOnImage: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 10,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  touchableBubbleWrapper: {
    alignItems: 'flex-end',
  },
});

export default GroupChatScreen;