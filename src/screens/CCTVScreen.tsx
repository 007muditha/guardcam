import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, StatusBar } from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { COLORS, SPACING, RADIUS, DETECTION } from '../utils/constants';
import { AppSettings, MotionEvent } from '../types';
import { startMotionDetection, stopMotionDetection, resetBaseline, getDebugInfo } from '../services/motionDetectionService';
import { handleCapture } from '../services/captureService';
import { addEvent } from '../services/movementLogService';
import { formatTime } from '../utils/formatters';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../utils/constants';
import { requestMediaPermission } from '../services/storageService';

const DEFAULT_SETTINGS: AppSettings = {
  sensitivity: 'medium',
  recordVideo: true,
  videoDuration: DETECTION.VIDEO_DEFAULT_DURATION,
  cameraPosition: 'back',
  showStealthIndicator: true,
  saveToGallery: true,
  googleDriveEnabled: false,
};

export const CCTVScreen = () => {
  const navigation = useNavigation();
  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [cameraMode, setCameraMode] = useState<'picture' | 'video'>('picture');
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const cameraRef = useRef<any>(null);

  const [state, setState] = useState<'initializing' | 'preview' | 'stealth' | 'controls_visible'>('initializing');
  const [eventCount, setEventCount] = useState(0);
  const [lastDetection, setLastDetection] = useState<string | null>(null);
  const [motionScore, setMotionScore] = useState(0);
  const [debugText, setDebugText] = useState('Waiting...');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const sessionStartTime = useRef(Date.now());
  const isCapturing = useRef(false);
  const cameraReadyPromiseRef = useRef<(() => void) | null>(null);

  const handleCameraReady = useCallback(() => {
    console.log('[CameraView] ✅ Native camera is READY (mode:', cameraMode, ')');
    if (cameraReadyPromiseRef.current) {
      cameraReadyPromiseRef.current();
      cameraReadyPromiseRef.current = null;
    }
  }, [cameraMode]);

  const controlsAnim = useRef(new Animated.Value(300)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const controlsTimeoutRef = useRef<any>(null);

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
    if (isCapturing.current) return;
    isCapturing.current = true;

    try {
      setMotionScore(score);

      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();

      // Pause frame analysis during active capture & 10s video recording
      stopMotionDetection();

      await handleCapture(
        cameraRef,
        settings,
        async (event: MotionEvent) => {
          await addEvent(event);
          setEventCount(prev => prev + 1);
          setLastDetection(formatTime(event.timestamp));
        },
        async (mode: 'picture' | 'video') => {
          if (cameraMode === mode) return;
          console.log(`[CameraView] 🔄 Switching mode to: ${mode}...`);
          const waitReady = new Promise<void>((resolve) => {
            cameraReadyPromiseRef.current = resolve;
            // Safety timeout fallback if onCameraReady doesn't fire
            setTimeout(() => {
              console.log('[CameraView] ⏱️ Timeout fallback reached for mode switch');
              resolve();
            }, 1800);
          });
          setCameraMode(mode);
          await waitReady;
          // Short safety buffer for native hardware pipeline stabilization
          await new Promise(r => setTimeout(r, 300));
        },
        (recording: boolean) => {
          setIsRecordingVideo(recording);
        }
      );
    } catch (error) {
      console.error('Motion capture error:', error);
    } finally {
      setCameraMode('picture');
      setIsRecordingVideo(false);
      isCapturing.current = false;
      // Resume motion detection loop
      startMotionDetection(cameraRef, settings.sensitivity, onMotionDetected, 3000);
    }
  }, [settings]);

  // Initialize camera + start motion detection
  useEffect(() => {
    activateKeepAwakeAsync();

    const init = async () => {
      if (!permission?.granted) {
        await requestPermission();
      }
      if (!micPermission?.granted) {
        try {
          await requestMicPermission();
        } catch (e) {
          console.warn('Microphone permission optional:', e);
        }
      }
      await requestMediaPermission();
      setState('preview');

      setTimeout(() => {
        setState('stealth');
        startMotionDetection(
          cameraRef,
          settings.sensitivity,
          onMotionDetected,
          3000
        );
      }, 3000);
    };
    init();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
      ])
    ).start();

    // Debug: update live score display every 1.5s
    const debugInterval = setInterval(() => {
      const info = getDebugInfo();
      setDebugText(`Score: ${info.score.toFixed(4)} | Frames: ${info.frameCount} | Running: ${info.isRunning} | Baseline: ${info.hasBaseline}`);
    }, 1500);

    return () => {
      deactivateKeepAwake();
      stopMotionDetection();
      clearInterval(debugInterval);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (state === 'stealth' || state === 'controls_visible') {
      stopMotionDetection();
      startMotionDetection(cameraRef, settings.sensitivity, onMotionDetected, 3000);
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
    resetBaseline();
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
      {state === 'stealth' ? (
        <StatusBar hidden backgroundColor="#000000" />
      ) : (
        <StatusBar barStyle="light-content" backgroundColor="#0A0A0F" />
      )}

      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        mode={cameraMode}
        mute={!micPermission?.granted}
        animateShutter={false}
        onCameraReady={handleCameraReady}
      />

      {state !== 'stealth' && (
        <Animated.View
          style={[styles.motionFlash, { opacity: flashAnim }]}
          pointerEvents="none"
        />
      )}

      {(state === 'stealth' || state === 'controls_visible') && (
        <Pressable
          style={styles.stealthOverlay}
          onPress={state === 'stealth' ? showControls : hideControls}
        >
          {state === 'stealth' && settings.showStealthIndicator && (
            <View style={styles.indicatorRow}>
              <Animated.View style={[styles.indicator, { transform: [{ scale: pulseAnim }] }]} />
              {isRecordingVideo ? (
                <View style={styles.recTag}>
                  <Text style={styles.recTagText}>REC {settings.videoDuration || 10}s</Text>
                </View>
              ) : (
                eventCount > 0 && (
                  <Text style={styles.eventBadge}>{eventCount}</Text>
                )
              )}
            </View>
          )}
        </Pressable>
      )}

      {state === 'controls_visible' && (
        <Animated.View style={[styles.controlsPanel, { transform: [{ translateY: controlsAnim }] }]}>
          <View style={styles.controlsHeader}>
            <Text style={styles.controlsTitle}>
              {isRecordingVideo ? '🎥 Recording 10s Clip...' : '🔴 CCTV Active'}
            </Text>
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
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
    zIndex: 50,
    elevation: 50,
  },
  motionFlash: {
    ...StyleSheet.absoluteFill,
    borderWidth: 4,
    borderColor: COLORS.PRIMARY,
    borderRadius: 0,
    zIndex: 100,
    elevation: 100,
  },
  indicatorRow: {
    position: 'absolute',
    top: 50,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 55,
    elevation: 55,
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
    zIndex: 60,
    elevation: 60,
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
  debugBar: {
    position: 'absolute',
    bottom: 20,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  debugText: {
    color: '#00FF88',
    fontSize: 10,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  recTag: {
    backgroundColor: COLORS.DANGER,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    marginLeft: 8,
  },
  recTagText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
