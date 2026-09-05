import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Image, Dimensions, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as MediaLibrary from 'expo-media-library/legacy';
import { COLORS, SPACING, RADIUS } from '../utils/constants';
import { getEvents } from '../services/movementLogService';
import { formatTime, formatRelativeDate } from '../utils/formatters';
import { MotionEvent } from '../types';

const { width } = Dimensions.get('window');
const THUMBNAIL_SIZE = (width - (SPACING.md * 2) - (SPACING.xs * 2)) / 3;

export const GalleryScreen = () => {
  const navigation = useNavigation();
  const [media, setMedia] = useState<MotionEvent[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<MotionEvent | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    loadMedia();
  }, []);

  const resolveItemUri = async (item: MotionEvent): Promise<MotionEvent> => {
    if (item.photoUri && item.photoUri.startsWith('ph://')) {
      try {
        const assetId = item.photoUri.replace('ph://', '');
        const info = await MediaLibrary.getAssetInfoAsync(assetId);
        if (info?.localUri) {
          return { ...item, photoUri: info.localUri };
        }
      } catch (e) {
        console.warn('Failed to resolve ph:// URI:', item.photoUri);
      }
    }
    return item;
  };

  const loadMedia = async () => {
    try {
      const events = await getEvents();
      const withMedia = events.filter((e: any) => e.hasPhoto || e.hasVideo || e.burstUris?.length);
      
      // Resolve any legacy ph:// URIs into local file URIs
      const resolvedMedia = await Promise.all(withMedia.map(resolveItemUri));
      setMedia(resolvedMedia.sort((a: any, b: any) => b.timestamp - a.timestamp));
    } catch (e) {
      console.warn('Failed to load gallery media');
    }
  };

  const handleOpenMedia = (item: MotionEvent) => {
    setFrameIndex(0);
    setSelectedMedia(item);
  };

  const renderItem = ({ item }: { item: MotionEvent }) => {
    const isBurst = item.isBurst || (item.burstUris && item.burstUris.length > 1);
    const count = item.burstCount || item.burstUris?.length;
    return (
      <Pressable style={styles.thumbnailContainer} onPress={() => handleOpenMedia(item)}>
        <Image 
          source={{ uri: item.photoUri }} 
          style={styles.thumbnail}
          resizeMode="cover"
        />
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeText}>{isBurst ? `⚡ ${count || 10}P` : '📷'}</Text>
        </View>
        {item.uploaded && <View style={styles.uploadedDot} />}
      </Pressable>
    );
  };

  const currentUri = (selectedMedia?.burstUris && selectedMedia.burstUris[frameIndex]) || selectedMedia?.photoUri;
  const burstCount = selectedMedia?.burstUris?.length || 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.title}>Gallery</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={media}
        numColumns={3}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.gridContent}
        columnWrapperStyle={styles.rowWrapper}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📷</Text>
            <Text style={styles.emptyTitle}>No captures yet</Text>
            <Text style={styles.emptySubtext}>Start monitoring to capture security footage</Text>
          </View>
        )}
      />

      <Modal visible={!!selectedMedia} transparent={true} animationType="fade">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalDate}>
                {selectedMedia ? formatRelativeDate(selectedMedia.timestamp) : ''}
              </Text>
              <Text style={styles.modalTime}>
                {selectedMedia ? formatTime(selectedMedia.timestamp) : ''}
              </Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={() => setSelectedMedia(null)}>
              <Text style={styles.closeIcon}>✕</Text>
            </Pressable>
          </View>
          
          {selectedMedia && (
            <Image 
              source={{ uri: currentUri }} 
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}

          {burstCount > 1 && (
            <View style={styles.scrubberRow}>
              <Pressable
                disabled={frameIndex === 0}
                onPress={() => setFrameIndex(prev => Math.max(0, prev - 1))}
                style={[styles.scrubBtn, frameIndex === 0 && { opacity: 0.3 }]}
              >
                <Text style={styles.scrubBtnText}>‹ Prev</Text>
              </Pressable>
              <Text style={styles.scrubCounter}>
                Frame {frameIndex + 1} of {burstCount}
              </Text>
              <Pressable
                disabled={frameIndex === burstCount - 1}
                onPress={() => setFrameIndex(prev => Math.min(burstCount - 1, prev + 1))}
                style={[styles.scrubBtn, frameIndex === burstCount - 1 && { opacity: 0.3 }]}
              >
                <Text style={styles.scrubBtnText}>Next ›</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.modalFooter}>
            <Text style={styles.modalFooterText}>
              {burstCount > 1 ? `⚡ 10s Burst Sequence (${burstCount} photos)  •  ` : ''}
              {selectedMedia?.uploaded ? '☁️ Synced to Drive' : '💾 Saved Locally'}
            </Text>
          </View>
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
  gridContent: {
    padding: SPACING.md,
  },
  rowWrapper: {
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  thumbnailContainer: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  badgeContainer: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: COLORS.GLASS,
    borderRadius: RADIUS.sm,
    padding: 2,
  },
  badgeText: {
    fontSize: 10,
  },
  uploadedDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.PRIMARY,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 150,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: SPACING.md,
    opacity: 0.8,
  },
  emptyTitle: {
    color: COLORS.TEXT,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: SPACING.sm,
  },
  emptySubtext: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
  },
  modalHeader: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    zIndex: 10,
  },
  modalDate: {
    color: COLORS.TEXT,
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalTime: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
  },
  closeBtn: {
    padding: SPACING.sm,
    backgroundColor: COLORS.GLASS,
    borderRadius: RADIUS.xl,
  },
  closeIcon: {
    color: COLORS.TEXT,
    fontSize: 18,
    fontWeight: 'bold',
  },
  fullImage: {
    width: '100%',
    height: '80%',
  },
  modalFooter: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  modalFooterText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
    backgroundColor: COLORS.GLASS,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.xl,
  },
  scrubberRow: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    zIndex: 20,
  },
  scrubBtn: {
    backgroundColor: COLORS.CARD,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  scrubBtnText: {
    color: COLORS.PRIMARY,
    fontSize: 14,
    fontWeight: 'bold',
  },
  scrubCounter: {
    color: COLORS.TEXT,
    fontSize: 14,
    fontFamily: 'monospace',
    backgroundColor: COLORS.SURFACE,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
});
