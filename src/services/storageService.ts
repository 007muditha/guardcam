import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { StorageStatus } from '../types';

/**
 * Checks device storage space safely without triggering deprecation crashes.
 */
export const checkStorageSpace = async (): Promise<StorageStatus> => {
  try {
    let freeBytes = 500 * 1024 * 1024; // 500MB fallback
    let totalBytes = 1000 * 1024 * 1024;

    if (typeof FileSystem.getFreeDiskStorageAsync === 'function') {
      try {
        freeBytes = await FileSystem.getFreeDiskStorageAsync();
      } catch (e) {
        // Fallback silently if SDK 54+ legacy method warns
      }
    }
    if (typeof FileSystem.getTotalDiskCapacityAsync === 'function') {
      try {
        totalBytes = await FileSystem.getTotalDiskCapacityAsync();
      } catch (e) {}
    }
    
    const usedBytes = Math.max(0, totalBytes - freeBytes);
    
    return {
      available: freeBytes > 50 * 1024 * 1024, // 50MB min threshold
      usedBytes,
      freeBytes
    };
  } catch (error) {
    console.warn('[Storage] Space check fallback:', error);
    return { available: true, usedBytes: 0, freeBytes: 500 * 1024 * 1024 };
  }
};

/**
 * Requests media library permission. Returns true if granted.
 */
export const requestMediaPermission = async (): Promise<boolean> => {
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      console.warn('[Storage] Media library permission denied');
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[Storage] Permission request error:', e);
    return false;
  }
};

/**
 * Saves a file to the GuardCam album in gallery.
 * Uses asset & album string IDs to prevent native bridge TypeError.
 */
export const saveToGallery = async (fileUri: string, _type: 'photo' | 'video'): Promise<string> => {
  try {
    const hasPermission = await requestMediaPermission();
    if (!hasPermission) {
      throw new Error('Media library permission not granted');
    }

    // Create asset in camera roll
    const asset = await MediaLibrary.createAssetAsync(fileUri);
    if (!asset || !asset.id) {
      throw new Error('Failed to create media asset');
    }

    // Try grouping into GuardCam album
    try {
      const album = await MediaLibrary.getAlbumAsync('GuardCam');
      if (album === null || !album.id) {
        await MediaLibrary.createAlbumAsync('GuardCam', asset.id, false);
      } else {
        await MediaLibrary.addAssetsToAlbumsAsync([asset.id], album.id, false);
      }
    } catch (albumErr) {
      // Album grouping can fail on some iOS/Android devices without breaking saving to Photos
      console.warn('[Storage] Saved to Photos library (album grouping optional):', albumErr);
    }
    
    console.log('[Storage] ✅ Saved to gallery:', asset.uri);
    return asset.uri;
  } catch (error) {
    console.error('[Storage] Failed to save to gallery:', error);
    throw error;
  }
};

/**
 * Checks if enough space is available.
 */
export const hasEnoughSpace = async (requiredBytes: number = 50 * 1024 * 1024): Promise<boolean> => {
  try {
    const status = await checkStorageSpace();
    return status.freeBytes >= requiredBytes;
  } catch (error) {
    return true;
  }
};

/**
 * Cleans up temp capture files in cache.
 */
export const cleanupTempFiles = async (): Promise<number> => {
  let count = 0;
  try {
    const cacheDir = FileSystem.cacheDirectory;
    if (!cacheDir) return 0;
    
    const files = await FileSystem.readDirectoryAsync(cacheDir);
    
    for (const file of files) {
      if (file.endsWith('.jpg') || file.endsWith('.mp4') || file.endsWith('.png')) {
        await FileSystem.deleteAsync(cacheDir + file, { idempotent: true });
        count++;
      }
    }
    console.log(`[Storage] Cleared ${count} temp files`);
  } catch (error) {
    console.error('[Storage] Failed to cleanup temp files:', error);
  }
  return count;
};
