import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing, StatusBar } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useKeepAwake } from 'react-native-keep-awake';
import { COLORS, SPACING, RADIUS } from '../utils/constants';

export const CCTVScreen = () => {
  const navigation = useNavigation();
  const { hasPermission, requestPermission } = useCameraPermission();
  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('back');
  const device = useCameraDevice(cameraPosition);
  
  const [state, setState] = useState<'initializing' | 'preview' | 'stealth' | 'controls_visible'>('initializing');
  const [eventCount, setEventCount] = useState(0);
  const [lastDetection, setLastDetection] = useState<string | null>(null);
  const sessionStartTime = useRef(Date.now());

  const controlsAnim = useRef(new Animated.Value(300)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();

  const [showStealthIndicator, setShowStealthIndicator] = useState(true);

  useKeepAwake();

  useEffect(() => {
    const init = async () => {
      if (!hasPermission) {
        await requestPermission();
      }
      setState('preview');
      setTimeout(() => {
        setState('stealth');
        // TODO: ScreenBrightness.setBrightness(0.01)
      }, 2000);
    };
    init();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
      ])
    ).start();

    return () => {
      // TODO: ScreenBrightness.setBrightness(originalBrightness)
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

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
    navigation.goBack();
  };

  const handleSwitchCamera = () => {
    setCameraPosition(prev => prev === 'back' ? 'front' : 'back');
  };

  const getElapsedTime = () => {
    const ms = Date.now() - sessionStartTime.current;
    const hours = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${mins}m`;
  };

  if (!hasPermission) return <View style={styles.blackBg} />;
  if (device == null) return <View style={styles.blackBg} />;

  return (
    <View style={styles.container}>
      {state === 'stealth' && <StatusBar hidden />}
      
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        photo={true}
        video={true}
      />
      {/* TODO: Add frame processor for motion detection */}
      
      {(state === 'stealth' || state === 'controls_visible') && (
        <Pressable 
          style={styles.stealthOverlay} 
          onPress={state === 'stealth' ? showControls : hideControls}
        >
          {state === 'stealth' && showStealthIndicator && (
            <Animated.View style={[styles.indicator, { transform: [{ scale: pulseAnim }] }]} />
          )}
        </Pressable>
      )}

      {state === 'controls_visible' && (
        <Animated.View style={[styles.controlsPanel, { transform: [{ translateY: controlsAnim }] }]}>
          <View style={styles.controlsHeader}>
            <Text style={styles.controlsTitle}>CCTV Active</Text>
            <Text style={styles.controlsTime}>{getElapsedTime()}</Text>
          </View>
          
          <View style={styles.statsRow}>
            <Text style={styles.statsText}>{eventCount} motion events detected</Text>
            {lastDetection && <Text style={styles.statsSubtext}>Last: {lastDetection}</Text>}
          </View>

          <View style={styles.actionsRow}>
            <Pressable style={styles.switchBtn} onPress={handleSwitchCamera}>
              <Text style={styles.btnText}>Switch Camera</Text>
            </Pressable>
            <Pressable style={styles.stopBtn} onPress={handleStop}>
              <Text style={styles.stopBtnText}>STOP</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  blackBg: {
    flex: 1,
    backgroundColor: '#000',
  },
  stealthOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  indicator: {
    position: 'absolute',
    top: 40,
    right: 20,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.PRIMARY,
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
    backgroundColor: COLORS.CARD,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.xl,
  },
  statsText: {
    color: COLORS.TEXT,
    fontSize: 16,
  },
  statsSubtext: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
    marginTop: SPACING.xs,
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
});
