import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, RADIUS, ADMOB } from '../utils/constants';

/**
 * Reusable Banner Ad Component
 *
 * In Production / Native builds: Renders real Google AdMob Banner
 * In Expo Go: Renders a clean Ad banner placeholder without native crashes
 */
export const AdBanner: React.FC<{ style?: any }> = ({ style }) => {
  // Check if native react-native-google-mobile-ads is available at runtime
  let MobileAdsBanner: any = null;
  try {
    const mobileAds = require('react-native-google-mobile-ads');
    MobileAdsBanner = mobileAds.BannerAd;
    const { BannerAdSize } = mobileAds;
    
    if (MobileAdsBanner) {
      const adUnitId = __DEV__ ? ADMOB.TEST_BANNER_ID : ADMOB.BANNER_ID_IOS;
      return (
        <View style={[styles.adContainer, style]}>
          <MobileAdsBanner
            unitId={adUnitId}
            size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
            requestOptions={{
              requestNonPersonalizedAdsOnly: true,
            }}
          />
        </View>
      );
    }
  } catch (e) {
    // MobileAds module not loaded in Expo Go sandbox — render styled preview badge
  }

  // Styled Ad Banner preview for Expo Go / Dev mode
  return (
    <View style={[styles.adContainer, styles.previewContainer, style]}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>AD</Text>
      </View>
      <Text style={styles.adTitle}>GuardCam Security</Text>
      <Text style={styles.adSubtext}>AdMob Banner Placement ({ADMOB.BANNER_ID_IOS.slice(0, 18)}...)</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  adContainer: {
    width: '100%',
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.SURFACE,
    borderTopWidth: 1,
    borderColor: COLORS.BORDER,
  },
  previewContainer: {
    paddingVertical: SPACING.xs + 2,
    paddingHorizontal: SPACING.md,
    backgroundColor: 'rgba(18, 18, 26, 0.95)',
    flexDirection: 'row',
    gap: SPACING.xs + 2,
  },
  badge: {
    backgroundColor: COLORS.WARNING,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: RADIUS.sm - 4,
  },
  badgeText: {
    color: '#000',
    fontSize: 9,
    fontWeight: 'bold',
  },
  adTitle: {
    color: COLORS.TEXT,
    fontSize: 12,
    fontWeight: '600',
  },
  adSubtext: {
    color: COLORS.TEXT_DIM,
    fontSize: 10,
    flex: 1,
    textAlign: 'right',
  },
});
