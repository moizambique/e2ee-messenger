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
import Avatar from '../types/Avatar';
import { useImageAspectRatio } from './useImageAspectRatio';
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
    sendFileMessage,
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
      id: participant.id, // For DMs, the chat ID is the participant's ID
      type: 'dm' as const,
      name: participant.username,
      participant: participant,
      unread_count: 0, // These are just for type conformity
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
        (!msg.status || msg.status !== 'read')
      )
      .map(msg => msg.id);

    if (unreadMessageIds.length > 0) {
      markMessagesAsRead(unreadMessageIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, participant.id, user?.id]);

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
      await sendMessage(participant.id, text, 'text', false);
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

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({});
      if (result.canceled === false) {
        const { uri, name, mimeType } = result.assets[0];
        if (mimeType) {
          // For DMs, isGroup is false
          await sendFileMessage(participant.id, uri, name, mimeType, false);
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
        // On web, we open the URL with the token as a query param.
        // The backend middleware is set up to handle this.
        const downloadUrlWithToken = `${baseUrl}?token=${token}`;
        Linking.openURL(downloadUrlWithToken);
      } else {
        // Native platform logic
        const localUri = FileSystem.documentDirectory + fileName;

        RNAlert.alert('Downloading', `Downloading ${fileName}...`);

        const { uri } = await FileSystem.downloadAsync(baseUrl, localUri, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        console.log('Finished downloading to ', uri);

        // Share the downloaded file if sharing is available
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri);
        }
      }
    } catch (error) {
      console.error('Download failed:', error);
      RNAlert.alert('Download Failed', 'Could not download the attachment.');
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

  // A new component for rendering the image to contain the hook logic
  const ImageAttachment: React.FC<{ item: Message; isOwn: boolean }> = ({ item, isOwn }) => {
    const fileInfo = JSON.parse(item.encrypted_content);    
    const token = apiService.getToken();
    let imageUrl: string;

    // If localUri exists (during optimistic update), use it. Otherwise, build the network URL.
    if (fileInfo.localUri) {
      imageUrl = fileInfo.localUri;
    } else {
      const baseUrl = apiService.getAttachmentDownloadUrl(item.id, fileInfo.fileName);
      imageUrl = Platform.OS === 'web' ? `${baseUrl}?token=${token}` : baseUrl;
    }
    const headers = Platform.OS === 'web' ? undefined : { Authorization: `Bearer ${token}` };
    console.log('[DEBUG] ImageAttachment: Requesting image with URL:', imageUrl);

    const aspectRatio = useImageAspectRatio(imageUrl, headers);

    // Create a single, merged style object.
    // This is more stable than passing an array of styles.
    const imageStyle = {
      ...styles.imageAttachment,
      aspectRatio: aspectRatio || 1, // Use the loaded aspect ratio, or fallback to 1:1
    };
    const imageSource = { uri: imageUrl, headers };

    // We apply the bubble styles directly to the Image component
    // and wrap it in a View that will contain the timestamp.
    return (
      <Image source={imageSource} style={[styles.messageBubble, isOwn && styles.ownMessageBubble, imageStyle]} resizeMode="contain" />
    );
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwn = item.sender_id === user?.id;
    
    if (item.message_type === 'file') {
      let fileInfo: { fileName: string; fileType: string } | null = null;
      try {
        fileInfo = JSON.parse(item.encrypted_content);
      } catch (e) {
        // Not a valid file message, render as text
      }

      const isImage = fileInfo?.fileType?.startsWith('image/');

      if (isImage && fileInfo) {
        return (
          <View style={[styles.messageContainer, isOwn && styles.ownMessageContainer]}>
            <TouchableOpacity
              onPress={() => handleDownloadAttachment(item)}
              style={isOwn ? styles.touchableBubbleWrapper : {}}
            >
              <ImageAttachment item={item} isOwn={isOwn} />
              <View style={styles.messageInfoOnImage}>
                <Text style={[styles.messageTime, styles.ownMessageTime]}>
                  {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                {isOwn && renderStatusIndicator(item.status)}
              </View>
            </TouchableOpacity>
          </View>
        );
      }

      // Fallback for non-image files
      return (
        <View style={[styles.messageContainer, isOwn && styles.ownMessageContainer]}>
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
                {isOwn && renderStatusIndicator(item.status)}
              </View>
            </View>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={[styles.messageContainer, isOwn && styles.ownMessageContainer]}>
        <View style={[styles.messageBubble, isOwn && styles.ownMessageBubble]}>
          <Text style={[styles.messageText, isOwn && styles.ownMessageText]}>
            {(() => {
              try {
                return JSON.parse(Buffer.from(item.encrypted_content, 'base64').toString('utf-8')).content;
              } catch (e) {
                // If it's not JSON, it might be a file metadata string
                return item.encrypted_content;
              }
            })()}
          </Text>
          <View style={styles.textMessageInfo}>
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
          <Avatar name={participant.username} avatarUrl={participant.avatar_url} size={40} />
          <View style={{ marginLeft: 12 }}>
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
          <TouchableOpacity style={styles.attachButton} onPress={handlePickDocument}>
            <Ionicons name="attach" size={24} color="#007AFF" />
          </TouchableOpacity>
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
    paddingBottom: 24, // Add padding to make space for the timestamp
    position: 'relative',
  },
  imageAttachment: {
    // Set an explicit width to prevent the component from collapsing to 0x0
    width: 250,
    borderRadius: 18,
    backgroundColor: '#E1E1E1', // Placeholder color while loading
  },
  fileIcon: {
    marginRight: 12,
  },
  fileInfo: {
    // Use flexShrink to prevent it from pushing the timestamp out of the bubble
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
  // Special style for timestamp on images to give it a background
  messageInfoOnImage: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 10,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  textMessageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 4,
    paddingTop: 4,
  },
  // This style is the key to fixing the alignment and touchable area.
  // It forces the TouchableOpacity to shrink-wrap its content to the right.
  touchableBubbleWrapper: {
    alignItems: 'flex-end',
  },
});

export default ChatScreen;
