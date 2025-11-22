import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert as RNAlert,
  ScrollView,
  Clipboard,
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { generateSafetyNumber } from '../crypto/crypto';
import { KeyVerification } from '../crypto/types';
import { RootStackParamList } from '../types';

type KeyVerificationScreenRouteProp = RouteProp<RootStackParamList, 'KeyVerification'>;

const KeyVerificationScreen: React.FC = () => {
  const route = useRoute<KeyVerificationScreenRouteProp>();
  const { userId, deviceId } = route.params;
  
  const [keyVerification, setKeyVerification] = useState<KeyVerification | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSafetyNumber();
  }, [userId, deviceId]);

  const loadSafetyNumber = async () => {
    try {
      setLoading(true);
      const verification = await generateSafetyNumber(userId, deviceId);
      setKeyVerification(verification);
    } catch (error) {
      RNAlert.alert('Error', 'Failed to generate safety number');
    } finally {
      setLoading(false);
    }
  };

  const handleCopySafetyNumber = () => {
    if (keyVerification) {
      Clipboard.setString(keyVerification.safetyNumber);
      RNAlert.alert('Copied', 'Safety number copied to clipboard');
    }
  };

  const handleCopyFingerprint = () => {
    if (keyVerification) {
      Clipboard.setString(keyVerification.fingerprint);
      RNAlert.alert('Copied', 'Fingerprint copied to clipboard');
    }
  };

  const handleVerify = () => {
    RNAlert.alert(
      'Verify Contact',
      'Have you verified this safety number with the contact in person or through a secure channel?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Verify', 
          onPress: () => {
            setKeyVerification(prev => prev ? { ...prev, isVerified: true, verifiedAt: new Date() } : null);
            RNAlert.alert('Verified', 'Contact has been verified successfully');
          }
        },
      ]
    );
  };

  const handleUnverify = () => {
    RNAlert.alert(
      'Unverify Contact',
      'Are you sure you want to unverify this contact?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Unverify', 
          style: 'destructive',
          onPress: () => {
            setKeyVerification(prev => prev ? { ...prev, isVerified: false, verifiedAt: undefined } : null);
            RNAlert.alert('Unverified', 'Contact verification has been removed');
          }
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Generating safety number...</Text>
      </View>
    );
  }

  if (!keyVerification) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={60} color="#FF3B30" />
        <Text style={styles.errorTitle}>Error</Text>
        <Text style={styles.errorText}>Failed to generate safety number</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadSafetyNumber}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="shield-checkmark" size={80} color="#007AFF" />
        <Text style={styles.title}>Key Verification</Text>
        <Text style={styles.subtitle}>
          Verify this contact's identity by comparing safety numbers
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Safety Number</Text>
        <View style={styles.codeContainer}>
          <Text style={styles.safetyNumber}>{keyVerification.safetyNumber}</Text>
          <TouchableOpacity style={styles.copyButton} onPress={handleCopySafetyNumber}>
            <Ionicons name="copy-outline" size={20} color="#007AFF" />
          </TouchableOpacity>
        </View>
        <Text style={styles.helpText}>
          Share this safety number with your contact through a secure channel to verify their identity.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Fingerprint</Text>
        <View style={styles.codeContainer}>
          <Text style={styles.fingerprint}>{keyVerification.fingerprint}</Text>
          <TouchableOpacity style={styles.copyButton} onPress={handleCopyFingerprint}>
            <Ionicons name="copy-outline" size={20} color="#007AFF" />
          </TouchableOpacity>
        </View>
        <Text style={styles.helpText}>
          A shorter identifier for quick verification.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Verification Status</Text>
        <View style={styles.statusContainer}>
          <View style={styles.statusIcon}>
            <Ionicons 
              name={keyVerification.isVerified ? "checkmark-circle" : "ellipse-outline"} 
              size={24} 
              color={keyVerification.isVerified ? "#34C759" : "#8E8E93"} 
            />
          </View>
          <View style={styles.statusContent}>
            <Text style={styles.statusTitle}>
              {keyVerification.isVerified ? 'Verified' : 'Not Verified'}
            </Text>
            {keyVerification.verifiedAt && (
              <Text style={styles.statusSubtitle}>
                Verified on {keyVerification.verifiedAt.toLocaleDateString()}
              </Text>
            )}
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        {keyVerification.isVerified ? (
          <TouchableOpacity style={styles.unverifyButton} onPress={handleUnverify}>
            <Ionicons name="close-circle-outline" size={20} color="#FF3B30" />
            <Text style={styles.unverifyButtonText}>Unverify Contact</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.verifyButton} onPress={handleVerify}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#34C759" />
            <Text style={styles.verifyButtonText}>Mark as Verified</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.warningSection}>
        <Ionicons name="warning-outline" size={24} color="#FF9500" />
        <Text style={styles.warningTitle}>Important</Text>
        <Text style={styles.warningText}>
          Only verify contacts after confirming their safety number through a secure, out-of-band channel (in person, phone call, etc.).
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 20,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 20,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12,
  },
  safetyNumber: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'monospace',
    color: '#000',
    letterSpacing: 1,
  },
  fingerprint: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'monospace',
    color: '#000',
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  copyButton: {
    padding: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    marginRight: 12,
  },
  statusContent: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  statusSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  actions: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34C759',
    paddingVertical: 16,
    borderRadius: 12,
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  unverifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF3B30',
    paddingVertical: 16,
    borderRadius: 12,
  },
  unverifyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  warningSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF3CD',
    marginHorizontal: 20,
    marginBottom: 40,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginLeft: 12,
    marginBottom: 4,
  },
  warningText: {
    fontSize: 14,
    color: '#000',
    lineHeight: 20,
    marginLeft: 12,
    flex: 1,
  },
});

export default KeyVerificationScreen;
