import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const DeviceKeysScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Device Keys</Text>
      <Text style={styles.subtitle}>
        Management of your device keys and sessions will be available here.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F2F2F7',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
});

export default DeviceKeysScreen;