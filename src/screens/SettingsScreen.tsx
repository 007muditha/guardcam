import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SPACING, RADIUS, STORAGE_KEYS } from '../utils/constants';
import { clearEvents } from '../services/movementLogService';

export const SettingsScreen = () => {
  const navigation = useNavigation();
  const [settings, setSettings] = useState({
    sensitivity: 'medium',
    captureMode: 'photo',
    cameraPosition: 'back',
    showStealthIndicator: true,
    videoDuration: 15,
    googleDriveEnabled: false,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (saved) setSettings(prev => ({ ...prev, ...JSON.parse(saved) }));
    } catch (e) {
      console.warn('Failed to load settings');
    }
  };

  const updateSetting = async (key: string, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(newSettings));
    } catch (e) {
      console.warn('Failed to save settings');
    }
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'This will delete all movement logs and cached photos. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            await clearEvents();
            Alert.alert('Done', 'All data has been cleared.');
          },
        },
      ]
    );
  };

  const renderPillRow = (key: string, options: { value: any; label: string }[]) => {
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
          <Text style={styles.sectionTitle}>💾 Capture</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Capture Mode</Text>
            <View style={styles.pillSpacer}>
              {renderPillRow('captureMode', [
                { value: 'photo', label: '📷 Photo' },
                { value: 'video', label: '🎥 Video' },
                { value: 'both', label: '📷+🎥' },
              ])}
            </View>

            {settings.captureMode !== 'photo' && (
              <>
                <View style={styles.divider} />
                <Text style={styles.label}>Video Duration</Text>
                <View style={styles.pillSpacer}>
                  {renderPillRow('videoDuration', [
                    { value: 10, label: '10s' },
                    { value: 15, label: '15s' },
                    { value: 30, label: '30s' },
                    { value: 60, label: '60s' },
                  ])}
                </View>
              </>
            )}

            <View style={styles.divider} />
            <Text style={styles.hint}>
              📱 Photos & videos are saved to your device gallery automatically.
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
          <Text style={styles.sectionTitle}>☁️ Google Drive</Text>
          <View style={styles.card}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={styles.label}>Cloud Backup</Text>
                <Text style={styles.hint}>Requires native build (not Expo Go)</Text>
              </View>
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>Coming Soon</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Storage Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🗄️ Storage</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Local Storage</Text>
            <Text style={styles.hint}>
              Captured photos & videos are saved to your device gallery in the "GuardCam" album.
            </Text>
            <Pressable style={styles.dangerBtn} onPress={handleClearData}>
              <Text style={styles.dangerBtnText}>🗑️ Clear All Movement Logs</Text>
            </Pressable>
          </View>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ℹ️ About</Text>
          <View style={styles.card}>
            <Text style={styles.label}>GuardCam v1.0.0</Text>
            <Text style={styles.hint}>
              Turn your phone into a smart security camera with motion detection.
              {'\n\n'}
              How it works:{'\n'}
              • Tap START to begin monitoring{'\n'}
              • Screen goes black (stealth mode){'\n'}
              • Camera detects motion every 2 seconds{'\n'}
              • Photos are captured & saved automatically{'\n'}
              • Tap the black screen to show controls{'\n'}
              • View events in the Movement Log
            </Text>
          </View>
        </View>

        {/* Bottom spacer */}
        <View style={{ height: 40 }} />
      </ScrollView>
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
    fontSize: 14,
  },
});
