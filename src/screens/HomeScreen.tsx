import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SPACING, RADIUS } from '../utils/constants';
import { getEvents } from '../services/movementLogService';
import { AdBanner } from '../components/AdBanner';

type RootStackParamList = {
  Home: undefined;
  CCTV: undefined;
  Settings: undefined;
  MovementLog: undefined;
  Gallery: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export const HomeScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const [eventCount, setEventCount] = useState(0);
  const [photoCount, setPhotoCount] = useState(0);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useFocusEffect(
    useCallback(() => {
      const fetchStats = async () => {
        try {
          const events = await getEvents();
          setEventCount(events.length);
          setPhotoCount(events.filter((e: any) => e.hasPhoto).length);
        } catch (error) {
          console.warn('Could not fetch events', error);
        }
      };
      fetchStats();
    }, [])
  );

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📹 GuardCam</Text>
        <Text style={styles.subtitle}>Security Camera</Text>
      </View>

      <View style={styles.mainContent}>
        <Animated.View style={[styles.startBtnOuter, { transform: [{ scale: pulseAnim }] }]}>
          <Pressable 
            style={({pressed}) => [styles.startBtnInner, pressed && styles.startBtnPressed]}
            onPress={() => navigation.navigate('CCTV')}
          >
            <Text style={styles.startBtnText}>START CCTV</Text>
          </Pressable>
        </Animated.View>

        <View style={styles.statusCard}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Ready to Monitor</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>🏃‍♂️</Text>
            <Text style={styles.statValue}>{eventCount}</Text>
            <Text style={styles.statLabel}>Events</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>📸</Text>
            <Text style={styles.statValue}>{photoCount}</Text>
            <Text style={styles.statLabel}>Photos</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>☁️</Text>
            <Text style={styles.statValue}>No Drive</Text>
            <Text style={styles.statLabel}>Sync</Text>
          </View>
        </View>
      </View>

      <View style={styles.navRow}>
        <Pressable style={styles.navBtn} onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.navIcon}>⚙️</Text>
          <Text style={styles.navLabel}>Settings</Text>
        </Pressable>
        <Pressable style={styles.navBtn} onPress={() => navigation.navigate('MovementLog')}>
          <Text style={styles.navIcon}>📋</Text>
          <Text style={styles.navLabel}>Logs</Text>
        </Pressable>
        <Pressable style={styles.navBtn} onPress={() => navigation.navigate('Gallery')}>
          <Text style={styles.navIcon}>🖼️</Text>
          <Text style={styles.navLabel}>Gallery</Text>
        </Pressable>
      </View>

      <AdBanner />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  header: {
    alignItems: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.TEXT,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
    marginTop: SPACING.xs,
  },
  mainContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtnOuter: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: COLORS.GLASS,
    borderWidth: 2,
    borderColor: COLORS.PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.PRIMARY,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  startBtnInner: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: COLORS.SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtnPressed: {
    backgroundColor: COLORS.CARD,
  },
  startBtnText: {
    color: COLORS.PRIMARY,
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.GLASS,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    marginTop: SPACING.xl,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.TEXT_DIM,
    marginRight: SPACING.sm,
  },
  statusText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
  },
  statCard: {
    backgroundColor: COLORS.CARD,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    width: '30%',
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  statIcon: {
    fontSize: 20,
    marginBottom: SPACING.xs,
  },
  statValue: {
    color: COLORS.TEXT,
    fontSize: 16,
    fontWeight: 'bold',
  },
  statLabel: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    marginTop: SPACING.xs,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
    backgroundColor: COLORS.SURFACE,
  },
  navBtn: {
    alignItems: 'center',
    padding: SPACING.sm,
  },
  navIcon: {
    fontSize: 24,
    marginBottom: SPACING.xs,
  },
  navLabel: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
  },
});
