import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, Alert, Modal, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SPACING, RADIUS, STORAGE_KEYS } from '../utils/constants';
import { clearEvents } from '../services/movementLogService';
import { cleanupTempFiles } from '../services/storageService';
import {
  initGoogleDrive,
  signIn as gDriveSignIn,
  signOut as gDriveSignOut,
  getRedirectUri,
  saveClientId,
  getStoredClientId,
} from '../services/googleDriveService';
import { AppSettings } from '../types';

const DEFAULT_SETTINGS: AppSettings = {
  sensitivity: 'medium',
  recordVideo: true,
  videoDuration: 10,
  cameraPosition: 'back',
  showStealthIndicator: true,
  saveToGallery: true,
  googleDriveEnabled: false,
};

export const SettingsScreen = () => {
  const navigation = useNavigation();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Google Drive state
  const [gDriveConnected, setGDriveConnected] = useState(false);
  const [gDriveEmail, setGDriveEmail] = useState<string | null>(null);
  const [isConnectingGDrive, setIsConnectingGDrive] = useState(false);
  const [showClientIdModal, setShowClientIdModal] = useState(false);
  const [clientIdInput, setClientIdInput] = useState('');
  const [redirectUri, setRedirectUri] = useState('');

  useEffect(() => {
    loadSettings();
    checkGDriveStatus();
  }, []);

  const checkGDriveStatus = async () => {
    const status = await initGoogleDrive();
    setGDriveConnected(status.isSignedIn);
    setGDriveEmail(status.email);
    setClientIdInput(status.clientId || '');
    setRedirectUri(getRedirectUri());
  };

  const loadSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (saved) setSettings(prev => ({ ...prev, ...JSON.parse(saved) }));
    } catch (e) {
      console.warn('Failed to load settings');
    }
  };

  const updateSetting = async (key: keyof AppSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(newSettings));
    } catch (e) {
      console.warn('Failed to save settings');
    }
  };

  const handleConnectGDrive = async () => {
    const storedId = await getStoredClientId();
    if (!storedId && !clientIdInput.trim()) {
      setShowClientIdModal(true);
      return;
    }

    setIsConnectingGDrive(true);
    try {
      const result = await gDriveSignIn(clientIdInput.trim() || undefined);
      setGDriveConnected(true);
      setGDriveEmail(result.email);
      await updateSetting('googleDriveEnabled', true);
      await updateSetting('googleDriveFolderId', result.folderId);
      Alert.alert(
        '✅ Google Drive Connected',
        `Successfully linked ${result.email}!\n\nSecurity footage will now automatically upload to your dedicated 'GuardCam_Footage' folder.`
      );
    } catch (error: any) {
      if (error?.message === 'USER_CANCELLED') {
        // User closed browser
        return;
      }
      if (error?.message === 'MISSING_CLIENT_ID') {
        setShowClientIdModal(true);
        return;
      }
      Alert.alert('Connection Failed', error?.message || 'Could not connect to Google Drive.');
    } finally {
      setIsConnectingGDrive(false);
    }
  };

  const handleDisconnectGDrive = () => {
    Alert.alert(
      'Disconnect Google Drive',
      'Are you sure you want to unlink your Google Drive account? Cloud backup will be disabled.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await gDriveSignOut();
            setGDriveConnected(false);
            setGDriveEmail(null);
            await updateSetting('googleDriveEnabled', false);
            await updateSetting('googleDriveFolderId', undefined);
          },
        },
      ]
    );
  };

  const handleSaveClientIdAndConnect = async () => {
    if (!clientIdInput.trim()) {
      Alert.alert('Required', 'Please enter your Google Cloud OAuth Client ID.');
      return;
    }
    await saveClientId(clientIdInput.trim());
    setShowClientIdModal(false);
    handleConnectGDrive();
  };

  const handleClearEventsOnly = () => {
    Alert.alert(
      'Clear Movement Log',
      'This will clear all recorded event history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Log',
          style: 'destructive',
          onPress: async () => {
            await clearEvents();
            Alert.alert('Cleared', 'Movement log has been cleared.');
          },
        },
      ]
    );
  };

  const handleClearCacheOnly = () => {
    Alert.alert(
      'Clear Temp Cache',
      'This will delete cached photo/video files from temporary storage.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: async () => {
            const count = await cleanupTempFiles();
            Alert.alert('Cleared', `Removed ${count} temporary files.`);
          },
        },
      ]
    );
  };

  const handleClearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'This will delete all movement log history and cached capture files.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            await clearEvents();
            const count = await cleanupTempFiles();
            Alert.alert('Cleared All', `Deleted logs and ${count} cached files.`);
          },
        },
      ]
    );
  };

  const renderPillRow = (key: keyof AppSettings, options: { value: any; label: string }[]) => {
    return (
      <View style={styles.pillGroup}>
        {options.map((opt) => {
          const isActive = (settings as any)[key] === opt.value;
          return (
            <Pressable
              key={String(opt.value)}
              style={[styles.pillBtn, isActive && styles.pillBtnActive]}
              onPress={() => updateSetting(key, opt.value)}
            >
              <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Camera Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📷 Camera</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Camera Position</Text>
            <View style={styles.pillSpacer}>
              {renderPillRow('cameraPosition', [
                { value: 'front', label: '🤳 Front' },
                { value: 'back', label: '📸 Back' },
              ])}
            </View>
          </View>
        </View>

        {/* Detection Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎯 Detection</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Sensitivity</Text>
            <View style={styles.pillSpacer}>
              {renderPillRow('sensitivity', [
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
              ])}
            </View>
            <Text style={styles.hint}>
              {settings.sensitivity === 'low'
                ? 'Detects large movements only. Best for busy areas.'
                : settings.sensitivity === 'medium'
                ? 'Balanced — detects most motion. Recommended.'
                : 'Detects even subtle movement. May trigger often.'}
            </Text>
          </View>
        </View>

        {/* Capture Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💾 Capture & Save</Text>
          <View style={styles.card}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={styles.label}>Record Video on Motion</Text>
                <Text style={styles.hint}>
                  When motion is detected, record a video clip from the motion point
                </Text>
              </View>
              <Switch
                value={settings.recordVideo !== false}
                onValueChange={(val) => {
                  updateSetting('recordVideo', val);
                  updateSetting('captureMode', val ? 'both' : 'photo');
                }}
                trackColor={{ false: COLORS.SURFACE, true: COLORS.PRIMARY }}
                thumbColor={settings.recordVideo !== false ? '#fff' : COLORS.TEXT_DIM}
              />
            </View>

            {settings.recordVideo !== false && (
              <>
                <View style={styles.divider} />
                <View style={styles.switchRow}>
                  <Text style={styles.label}>Video Clip Duration</Text>
                  <Text style={styles.durationValue}>{settings.videoDuration || 10}s</Text>
                </View>
                <View style={styles.pillSpacer}>
                  {renderPillRow('videoDuration', [
                    { value: 5, label: '5s' },
                    { value: 10, label: '10s (Best)' },
                    { value: 15, label: '15s' },
                    { value: 30, label: '30s' },
                  ])}
                </View>
                <Text style={styles.hint}>
                  ⚡ GuardCam takes an evidence photo and immediately records a {settings.videoDuration || 10}-second video clip from the moment motion is detected.
                </Text>
              </>
            )}

            <View style={styles.divider} />
            <Text style={styles.hint}>
              📱 Photos and videos are saved to device storage (GuardCam folder) and synced directly to Google Drive.
            </Text>
          </View>
        </View>

        {/* Stealth Mode Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🥷 Stealth Mode</Text>
          <View style={styles.card}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={styles.label}>Show Indicator Dot</Text>
                <Text style={styles.hint}>Tiny green pulse in corner when active</Text>
              </View>
              <Switch
                value={settings.showStealthIndicator}
                onValueChange={(val) => updateSetting('showStealthIndicator', val)}
                trackColor={{ false: COLORS.SURFACE, true: COLORS.PRIMARY }}
                thumbColor={settings.showStealthIndicator ? '#fff' : COLORS.TEXT_DIM}
              />
            </View>
          </View>
        </View>

        {/* Google Drive Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>☁️ Google Drive Cloud Backup</Text>

          {/* Privacy Guarantee Card */}
          <View style={styles.privacyCard}>
            <View style={styles.privacyHeader}>
              <Text style={styles.privacyIcon}>🛡️</Text>
              <Text style={styles.privacyTitle}>Privacy-First Guarantee</Text>
            </View>
            <Text style={styles.privacyText}>
              GuardCam requests restricted per-file access (<Text style={styles.codeText}>drive.file</Text>). GuardCam{' '}
              <Text style={{ fontWeight: 'bold', color: '#fff' }}>cannot see, read, or touch</Text> any of your personal
              Google Drive files, photos, or documents. It can only create and access its own private{' '}
              <Text style={styles.codeText}>GuardCam_Footage</Text> folder.
            </Text>
          </View>

          <View style={styles.card}>
            {gDriveConnected ? (
              <View>
                <View style={styles.connectedRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.connectedBadge}>● CONNECTED</Text>
                    <Text style={styles.connectedEmail} numberOfLines={1}>
                      {gDriveEmail || 'Google Account'}
                    </Text>
                    <Text style={styles.connectedFolder}>📁 Folder: GuardCam_Footage</Text>
                  </View>
                  <Pressable style={styles.disconnectBtn} onPress={handleDisconnectGDrive}>
                    <Text style={styles.disconnectBtnText}>Unlink</Text>
                  </Pressable>
                </View>

                <View style={styles.divider} />

                <View style={styles.switchRow}>
                  <View style={styles.switchLabel}>
                    <Text style={styles.label}>Auto-Upload on Motion</Text>
                    <Text style={styles.hint}>Upload footage immediately when motion triggers</Text>
                  </View>
                  <Switch
                    value={settings.googleDriveEnabled}
                    onValueChange={(val) => updateSetting('googleDriveEnabled', val)}
                    trackColor={{ false: COLORS.SURFACE, true: COLORS.PRIMARY }}
                    thumbColor={settings.googleDriveEnabled ? '#fff' : COLORS.TEXT_DIM}
                  />
                </View>
              </View>
            ) : (
              <View>
                <Text style={styles.label}>Cloud Footage Sync</Text>
                <Text style={styles.hint}>
                  Automatically upload security photos and clips to your personal Google Drive in real time.
                </Text>

                <Pressable
                  style={[styles.gDriveConnectBtn, isConnectingGDrive && { opacity: 0.7 }]}
                  onPress={handleConnectGDrive}
                  disabled={isConnectingGDrive}
                >
                  {isConnectingGDrive ? (
                    <ActivityIndicator color="#000" size="small" />
                  ) : (
                    <Text style={styles.gDriveConnectBtnText}>🔗 Connect Google Drive</Text>
                  )}
                </Pressable>

                <Pressable style={styles.configClientBtn} onPress={() => setShowClientIdModal(true)}>
                  <Text style={styles.configClientBtnText}>⚙️ Setup Google OAuth Client ID</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        {/* Storage Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🗄️ Storage & Clean Up</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Manage Saved Data</Text>
            <Text style={styles.hint}>
              Clear event logs or temporary files to free up device space.
            </Text>
            
            <View style={styles.btnRow}>
              <Pressable style={styles.actionBtn} onPress={handleClearEventsOnly}>
                <Text style={styles.actionBtnText}>📋 Clear Log</Text>
              </Pressable>
              
              <Pressable style={styles.actionBtn} onPress={handleClearCacheOnly}>
                <Text style={styles.actionBtnText}>🧹 Clear Cache</Text>
              </Pressable>
            </View>

            <Pressable style={styles.dangerBtn} onPress={handleClearAllData}>
              <Text style={styles.dangerBtnText}>🗑️ Clear All Logs & Temp Photos</Text>
            </Pressable>
          </View>
        </View>

        {/* About & Legal Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ℹ️ About & Legal</Text>
          <View style={styles.card}>
            <Text style={styles.label}>GuardCam v1.0.0</Text>
            <Text style={styles.hint}>
              Turn your phone into a smart security camera with motion detection.
            </Text>
            
            <View style={styles.divider} />

            <Pressable style={styles.legalBtn} onPress={() => setShowTermsModal(true)}>
              <Text style={styles.legalBtnText}>📜 Terms of Service & Privacy Disclaimer</Text>
              <Text style={styles.legalBtnArrow}>›</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Terms & Conditions Modal */}
      <Modal visible={showTermsModal} animationType="slide" transparent={true}>
        <View style={styles.termsModalOverlay}>
          <SafeAreaView style={styles.termsModalContainer}>
            <View style={styles.termsModalHeader}>
              <Text style={styles.termsModalTitle}>Terms & Legal Disclaimer</Text>
              <Pressable style={styles.termsCloseBtn} onPress={() => setShowTermsModal(false)}>
                <Text style={styles.termsCloseText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.termsScroll} showsVerticalScrollIndicator={true}>
              <Text style={styles.termsHeading}>1. Purpose & Intended Use</Text>
              <Text style={styles.termsBody}>
                GuardCam is designed as a security monitoring tool to assist users in detecting motion and capturing security footage. The software is provided on an "AS IS" and "AS AVAILABLE" basis.
              </Text>

              <Text style={styles.termsHeading}>2. User Responsibility & Compliance</Text>
              <Text style={styles.termsBody}>
                You, the user, are solely responsible for how you deploy and operate GuardCam. You agree to comply with all applicable local, state, national, and international laws, including audio/video recording consent, privacy, and surveillance laws in your jurisdiction.
              </Text>

              <Text style={styles.termsHeading}>3. Power & Battery Management</Text>
              <Text style={styles.termsBody}>
                Continuous camera operation and motion detection consume significant battery. For continuous security monitoring, it is strongly recommended to keep your device connected to a reliable power source and ensure adequate device ventilation to prevent overheating.
              </Text>

              <Text style={styles.termsHeading}>4. Storage & Cloud Sharing Safety</Text>
              <Text style={styles.termsBody}>
                When sharing Google Drive folders or using cloud storage integrations, you are solely responsible for managing folder permissions and access keys. Ensure you share folder access only with trusted parties. The developers do not store, access, or sell your private video/photo recordings.
              </Text>

              <Text style={styles.termsHeading}>5. Limitation of Liability</Text>
              <Text style={styles.termsBody}>
                Under no circumstances shall the developer or app distributors be liable for any missed motion events, loss of data, hardware malfunction, unauthorized access to your cloud storage, or legal disputes arising from your use of this application.
              </Text>

              <View style={{ height: 30 }} />
            </ScrollView>

            <Pressable style={styles.termsAcceptBtn} onPress={() => setShowTermsModal(false)}>
              <Text style={styles.termsAcceptText}>I Understand & Agree</Text>
            </Pressable>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Google OAuth Client ID Setup Modal */}
      <Modal visible={showClientIdModal} animationType="slide" transparent={true}>
        <View style={styles.termsModalOverlay}>
          <SafeAreaView style={styles.termsModalContainer}>
            <View style={styles.termsModalHeader}>
              <Text style={styles.termsModalTitle}>⚙️ Google OAuth Setup</Text>
              <Pressable style={styles.termsCloseBtn} onPress={() => setShowClientIdModal(false)}>
                <Text style={styles.termsCloseText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.termsScroll}>
              <Text style={styles.termsHeading}>How to Connect to Google Drive:</Text>
              <Text style={styles.termsBody}>
                To enable Google Drive sync, enter your Google Cloud OAuth 2.0 Web Client ID.
              </Text>

              <Text style={styles.termsHeading}>1. Authorized Redirect URI</Text>
              <Text style={styles.termsBody}>
                Copy this exact Redirect URI into your Google Cloud Console OAuth Client:
              </Text>
              <View style={styles.codeBox}>
                <Text style={styles.codeBoxText} selectable={true}>
                  {redirectUri}
                </Text>
              </View>

              <Text style={styles.termsHeading}>2. Google Client ID</Text>
              <Text style={styles.termsBody}>
                Paste your Web Client ID below (e.g. xxxxx.apps.googleusercontent.com):
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Enter Google Client ID"
                placeholderTextColor={COLORS.TEXT_DIM}
                value={clientIdInput}
                onChangeText={setClientIdInput}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Pressable style={styles.termsAcceptBtn} onPress={handleSaveClientIdAndConnect}>
                <Text style={styles.termsAcceptText}>Save & Connect to Drive</Text>
              </Pressable>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  backBtn: {
    padding: SPACING.sm,
    width: 40,
    alignItems: 'center',
  },
  backIcon: {
    color: COLORS.TEXT,
    fontSize: 24,
  },
  title: {
    color: COLORS.TEXT,
    fontSize: 20,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: COLORS.CARD,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  label: {
    color: COLORS.TEXT,
    fontSize: 15,
    fontWeight: '600',
  },
  hint: {
    color: COLORS.TEXT_DIM,
    fontSize: 12,
    marginTop: SPACING.xs,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.BORDER,
    marginVertical: SPACING.md,
  },
  pillSpacer: {
    marginTop: SPACING.sm,
  },
  pillGroup: {
    flexDirection: 'row',
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  pillBtn: {
    flex: 1,
    paddingVertical: SPACING.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  pillBtnActive: {
    backgroundColor: COLORS.PRIMARY,
  },
  pillText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  pillTextActive: {
    color: '#000',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    flex: 1,
    marginRight: SPACING.md,
  },
  statusBadge: {
    backgroundColor: COLORS.SURFACE,
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  statusBadgeText: {
    color: COLORS.TEXT_DIM,
    fontSize: 11,
    fontWeight: 'bold',
  },
  proActiveBadge: {
    backgroundColor: 'rgba(0, 255, 136, 0.15)',
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY,
  },
  proActiveBadgeText: {
    color: COLORS.PRIMARY,
    fontSize: 11,
    fontWeight: 'bold',
  },
  durationValue: {
    color: COLORS.PRIMARY,
    fontSize: 14,
    fontWeight: 'bold',
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: COLORS.SURFACE,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  actionBtnText: {
    color: COLORS.TEXT,
    fontWeight: '600',
    fontSize: 13,
  },
  dangerBtn: {
    marginTop: SPACING.md,
    backgroundColor: 'rgba(255, 51, 102, 0.1)',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.DANGER,
  },
  dangerBtnText: {
    color: COLORS.DANGER,
    fontWeight: 'bold',
    fontSize: 13,
  },
  legalBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  legalBtnText: {
    color: COLORS.PRIMARY,
    fontSize: 14,
    fontWeight: '600',
  },
  legalBtnArrow: {
    color: COLORS.PRIMARY,
    fontSize: 18,
    fontWeight: 'bold',
  },
  termsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  termsModalContainer: {
    backgroundColor: COLORS.SURFACE,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  termsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
    marginBottom: SPACING.md,
  },
  termsModalTitle: {
    color: COLORS.TEXT,
    fontSize: 18,
    fontWeight: 'bold',
  },
  termsCloseBtn: {
    padding: SPACING.xs,
  },
  termsCloseText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 20,
  },
  termsScroll: {
    paddingRight: SPACING.xs,
  },
  termsHeading: {
    color: COLORS.PRIMARY,
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  termsBody: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    lineHeight: 20,
  },
  termsAcceptBtn: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  termsAcceptText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 15,
  },
  privacyCard: {
    backgroundColor: 'rgba(0, 255, 136, 0.08)',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.3)',
    marginBottom: SPACING.md,
  },
  privacyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  privacyIcon: {
    fontSize: 18,
    marginRight: 6,
  },
  privacyTitle: {
    color: COLORS.PRIMARY,
    fontSize: 14,
    fontWeight: 'bold',
  },
  privacyText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 18,
  },
  codeText: {
    color: COLORS.PRIMARY,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  connectedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  connectedBadge: {
    color: COLORS.PRIMARY,
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  connectedEmail: {
    color: COLORS.TEXT,
    fontSize: 15,
    fontWeight: 'bold',
  },
  connectedFolder: {
    color: COLORS.TEXT_DIM,
    fontSize: 12,
    marginTop: 2,
  },
  disconnectBtn: {
    backgroundColor: 'rgba(255, 51, 102, 0.15)',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.DANGER,
  },
  disconnectBtnText: {
    color: COLORS.DANGER,
    fontSize: 12,
    fontWeight: 'bold',
  },
  gDriveConnectBtn: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  gDriveConnectBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: 'bold',
  },
  configClientBtn: {
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  configClientBtnText: {
    color: COLORS.TEXT_DIM,
    fontSize: 12,
  },
  codeBox: {
    backgroundColor: COLORS.SURFACE,
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    marginVertical: SPACING.xs,
  },
  codeBoxText: {
    color: COLORS.PRIMARY,
    fontSize: 11,
    fontFamily: 'monospace',
  },
  input: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    color: COLORS.TEXT,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 13,
    marginVertical: SPACING.sm,
  },
});
