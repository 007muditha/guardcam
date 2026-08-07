import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SPACING, RADIUS } from '../utils/constants';

export const SettingsScreen = () => {
  const navigation = useNavigation();
  const [settings, setSettings] = useState({
    sensitivity: 'medium',
    captureMode: 'video',
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
      const saved = await AsyncStorage.getItem('@guardcam_settings');
      if (saved) setSettings(JSON.parse(saved));
    } catch (e) {
      console.warn('Failed to load settings');
    }
  };

  const updateSetting = async (key: string, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    try {
      await AsyncStorage.setItem('@guardcam_settings', JSON.stringify(newSettings));
    } catch (e) {
      console.warn('Failed to save settings');
    }
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'Are you sure you want to delete all recordings and photos?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => console.log('Deleted') }
      ]
    );
  };

  const renderPill = (key: string, value: string, label: string) => {
    const isActive = (settings as any)[key] === value;
    return (
      <Pressable 
        key={value}
        style={[styles.pillBtn, isActive && styles.pillBtnActive]}
        onPress={() => updateSetting(key, value)}
      >
        <Text style={[styles.pillText, isActive && styles.pillTextActive]}>{label}</Text>
      </Pressable>
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

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Camera</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>Camera Position</Text>
              <View style={styles.pillGroup}>
                {renderPill('cameraPosition', 'front', 'Front')}
                {renderPill('cameraPosition', 'back', 'Back')}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detection</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Sensitivity</Text>
            <View style={styles.pillGroupFull}>
              {renderPill('sensitivity', 'low', 'Low')}
              {renderPill('sensitivity', 'medium', 'Med')}
              {renderPill('sensitivity', 'high', 'High')}
            </View>
            <Text style={styles.hint}>Higher sensitivity detects smaller movements.</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Capture</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Capture Mode</Text>
            <View style={styles.pillGroupFull}>
              {renderPill('captureMode', 'photo', 'Photo')}
              {renderPill('captureMode', 'video', 'Video')}
              {renderPill('captureMode', 'both', 'Both')}
            </View>
            
            {settings.captureMode !== 'photo' && (
              <View style={[styles.row, { marginTop: SPACING.md }]}>
                <Text style={styles.label}>Video Duration</Text>
                <View style={styles.pillGroup}>
                  {renderPill('videoDuration', 10, '10s')}
                  {renderPill('videoDuration', 15, '15s')}
                  {renderPill('videoDuration', 30, '30s')}
                </View>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stealth Mode</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>Show Indicator Dot</Text>
              <Switch
                value={settings.showStealthIndicator}
                onValueChange={(val) => updateSetting('showStealthIndicator', val)}
                trackColor={{ false: COLORS.BORDER, true: COLORS.PRIMARY }}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Google Drive Sync</Text>
          <View style={styles.card}>
            {/* TODO: Integrate GoogleDriveService */}
            <View style={styles.row}>
              <Text style={styles.label}>Status: Not Connected</Text>
              <Pressable style={styles.actionBtn}>
                <Text style={styles.actionBtnText}>Connect</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Storage</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Storage used: ~120 MB</Text>
            <Pressable style={styles.dangerBtn} onPress={handleClearData}>
              <Text style={styles.dangerBtnText}>Clear All Recordings</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <Text style={styles.label}>GuardCam v1.0.0</Text>
            <Text style={styles.linkText}>How it works</Text>
          </View>
        </View>

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
    fontSize: 14,
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: COLORS.TEXT,
    fontSize: 16,
  },
  hint: {
    color: COLORS.TEXT_DIM,
    fontSize: 12,
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
  pillGroupFull: {
    flexDirection: 'row',
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    marginTop: SPACING.sm,
  },
  pillBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    flex: 1,
    alignItems: 'center',
  },
  pillBtnActive: {
    backgroundColor: COLORS.PRIMARY,
  },
  pillText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
    fontWeight: 'bold',
  },
  pillTextActive: {
    color: '#000',
  },
  actionBtn: {
    backgroundColor: COLORS.SURFACE,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY,
  },
  actionBtnText: {
    color: COLORS.PRIMARY,
    fontWeight: 'bold',
  },
  dangerBtn: {
    marginTop: SPACING.md,
    backgroundColor: 'rgba(255, 51, 102, 0.1)',
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.DANGER,
  },
  dangerBtnText: {
    color: COLORS.DANGER,
    fontWeight: 'bold',
  },
  linkText: {
    color: COLORS.PRIMARY,
    fontSize: 14,
    marginTop: SPACING.sm,
  },
});
