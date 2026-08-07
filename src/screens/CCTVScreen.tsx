import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, StatusBar, Vibration } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { COLORS, SPACING, RADIUS, DETECTION } from '../utils/constants';
import { AppSettings, MotionEvent } from '../types';
import { startMotionDetection, stopMotionDetection, resetBaseline } from '../services/motionDetectionService';
import { handleCapture } from '../services/captureService';
import { addEvent } from '../services/movementLogService';
import { formatTime } from '../utils/formatters';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../utils/constants';

const DEFAULT_SETTINGS: AppSettings = {
  sensitivity: 'medium',
  captureMode: 'photo',
  cameraPosition: 'back',
  showStealthIndicator: true,
  videoDuration: DETECTION.VIDEO_DEFAULT_DURATION,
  googleDriveEnabled: false,
};

export const CCTVScreen = () => {
  const navigation = useNavigation();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const cameraRef = useRef<CameraView>(null);

  const [state, setState] = useState<'initializing' | 'preview' | 'stealth' | 'controls_visible'>('initializing');
  const [eventCount, setEventCount] = useState(0);
  const [lastDetection, setLastDetection] = useState<string | null>(null);
  const [motionScore, setMotionScore] = useState(0);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const sessionStartTime = useRef(Date.now());
  const isCapturing = useRef(false);

  const controlsAnim = useRef(new Animated.Value(300)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Load settings from AsyncStorage
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
        if (stored) {
          const parsed = JSON.parse(stored);
          setSettings({ ...DEFAULT_SETTINGS, ...parsed });
          setFacing(parsed.cameraPosition || 'back');
        }
      } catch (e) {
        console.warn('Failed to load settings', e);
      }
    };
    loadSettings();
  }, []);

  /**
   * Called when motion is detected by the motionDetectionService.
   * Triggers capture, saves event, and updates UI.
   */
  const onMotionDetected = useCallback(async (score: number) => {
    // Prevent concurrent captures
    if (isCapturing.current) return;
    isCapturing.current = true;

    try {
      setMotionScore(score);

      // Flash the screen briefly (green border flash for visual feedback)
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();

      // Vibrate briefly
      Vibration.vibrate(200);

      // Capture photo/video
      await handleCapture(cameraRef, settings, async (event: MotionEvent) => {
        // Save to movement log
        await addEvent(event);

        // Update UI
        setEventCount(prev => prev + 1);
        setLastDetection(formatTime(event.timestamp));
      });
    } catch (error) {
      console.error('Motion capture error:', error);
    } finally {
      isCapturing.current = false;
    }
  }, [settings]);

  // Initialize camera + start motion detection
  useEffect(() => {
    activateKeepAwakeAsync();

    const init = async () => {
      if (!permission?.granted) {
        await requestPermission();
      }
      setState('preview');

      // Show preview for 3 seconds, then go stealth and start detection
      setTimeout(() => {
        setState('stealth');
        // Start motion detection after entering stealth mode
        startMotionDetection(
          cameraRef,
          settings.sensitivity,
          onMotionDetected,
          2000 // Check every 2 seconds
        );
      }, 3000);
    };
    init();

    // Pulse animation for stealth indicator
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
      ])
    ).start();

    return () => {
      deactivateKeepAwake();
      stopMotionDetection();
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  // Restart motion detection when sensitivity changes
  useEffect(() => {
    if (state === 'stealth' || state === 'controls_visible') {
      stopMotionDetection();
      startMotionDetection(cameraRef, settings.sensitivity, onMotionDetected, 2000);
    }
  }, [settings.sensitivity, onMotionDetected]);

  const showControls = () => {
    setState('controls_visible');
    Animated.spring(controlsAnim, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 0,
    }).start();

    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      hideControls();
    }, 5000);
  };

  const hideControls = () => {
    Animated.timing(controlsAnim, {
      toValue: 300,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setState('stealth');
    });
  };

  const handleStop = () => {
    stopMotionDetection();
    navigation.goBack();
  };

  const handleSwitchCamera = () => {
    const newFacing = facing === 'back' ? 'front' : 'back';
    setFacing(newFacing);
    resetBaseline(); // Reset motion baseline when switching cameras
  };

  const getElapsedTime = () => {
    const ms = Date.now() - sessionStartTime.current;
    const hours = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ color: COLORS.TEXT, textAlign: 'center', marginTop: 100 }}>
          Camera permission needed
        </Text>
        <Pressable style={styles.switchBtn} onPress={requestPermission}>
          <Text style={styles.btnText}>Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {state === 'stealth' && <StatusBar hidden />}

      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
      />

      {/* Motion flash indicator */}
      <Animated.View
        style={[styles.motionFlash, { opacity: flashAnim }]}
        pointerEvents="none"
      />

      {(state === 'stealth' || state === 'controls_visible') && (
        <Pressable
          style={styles.stealthOverlay}
          onPress={state === 'stealth' ? showControls : hideControls}
        >
          {state === 'stealth' && settings.showStealthIndicator && (
            <View style={styles.indicatorRow}>
              <Animated.View style={[styles.indicator, { transform: [{ scale: pulseAnim }] }]} />
              {eventCount > 0 && (
                <Text style={styles.eventBadge}>{eventCount}</Text>
              )}
            </View>
          )}
        </Pressable>
      )}

      {state === 'controls_visible' && (
        <Animated.View style={[styles.controlsPanel, { transform: [{ translateY: controlsAnim }] }]}>
          <View style={styles.controlsHeader}>
            <Text style={styles.controlsTitle}>🔴 CCTV Active</Text>
            <Text style={styles.controlsTime}>{getElapsedTime()}</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{eventCount}</Text>
              <Text style={styles.statLabel}>Events</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{(motionScore * 100).toFixed(0)}%</Text>
              <Text style={styles.statLabel}>Last Score</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{settings.sensitivity}</Text>
              <Text style={styles.statLabel}>Sensitivity</Text>
            </View>
          </View>

          {lastDetection && (
            <Text style={styles.lastDetectionText}>
              ⚡ Last motion at {lastDetection}
            </Text>
          )}

          <View style={styles.actionsRow}>
            <Pressable style={styles.switchBtn} onPress={handleSwitchCamera}>
              <Text style={styles.btnText}>🔄 Switch</Text>
            </Pressable>
            <Pressable style={styles.stopBtn} onPress={handleStop}>
              <Text style={styles.stopBtnText}>⏹ STOP</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {/* Preview mode indicator */}
      {state === 'preview' && (
        <View style={styles.previewBanner}>
          <Text style={styles.previewText}>📷 Initializing camera...</Text>
          <Text style={styles.previewSubtext}>Stealth mode activating in 3s</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  stealthOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  motionFlash: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 4,
    borderColor: COLORS.PRIMARY,
    borderRadius: 0,
    zIndex: 100,
  },
  indicatorRow: {
    position: 'absolute',
    top: 50,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.PRIMARY,
  },
  eventBadge: {
    color: COLORS.PRIMARY,
    fontSize: 10,
    marginLeft: 6,
    fontWeight: 'bold',
  },
  controlsPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.GLASS,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.xl,
    paddingBottom: SPACING.xxl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: COLORS.BORDER,
  },
  controlsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  controlsTitle: {
    color: COLORS.PRIMARY,
    fontSize: 20,
    fontWeight: 'bold',
  },
  controlsTime: {
    color: COLORS.TEXT,
    fontSize: 16,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.CARD,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    color: COLORS.TEXT,
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: COLORS.BORDER,
  },
  lastDetectionText: {
    color: COLORS.WARNING,
    fontSize: 14,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  switchBtn: {
    flex: 1,
    backgroundColor: COLORS.SURFACE,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  btnText: {
    color: COLORS.TEXT,
    fontWeight: 'bold',
    fontSize: 16,
  },
  stopBtn: {
    flex: 1,
    backgroundColor: COLORS.DANGER,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    marginLeft: SPACING.sm,
  },
  stopBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  previewBanner: {
    position: 'absolute',
    bottom: 80,
    left: SPACING.xl,
    right: SPACING.xl,
    backgroundColor: COLORS.GLASS,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  previewText: {
    color: COLORS.PRIMARY,
    fontSize: 18,
    fontWeight: 'bold',
  },
  previewSubtext: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
    marginTop: 4,
  },
});
