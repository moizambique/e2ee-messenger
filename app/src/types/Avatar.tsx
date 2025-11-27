import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../services/api';

interface AvatarProps {
  name: string;
  avatarUrl?: string;
  size: number;
  isGroup?: boolean;
}

const Avatar: React.FC<AvatarProps> = ({ name, avatarUrl, size, isGroup }) => {
  const styles = createStyles(size);

  if (isGroup) {
    return (
      <View style={styles.avatar}>
        <Ionicons name="people" size={size * 0.6} color="#fff" />
      </View>
    );
  }

  if (avatarUrl) {
    // Construct the full URL if it's a relative path from the server
    const fullAvatarUrl = avatarUrl.startsWith('http') 
      ? avatarUrl 
      : `${API_BASE_URL.replace('/v1', '')}${avatarUrl}`;
      
    return <Image source={{ uri: fullAvatarUrl }} style={styles.avatarImage} />;
  }

  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
};

const createStyles = (size: number) => StyleSheet.create({
  avatar: {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: size,
    height: size,
    borderRadius: size / 2,
  },
  avatarText: {
    color: '#fff',
    fontSize: size * 0.5,
    fontWeight: 'bold',
  },
});

export default Avatar;