import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { StorageStatus } from '../types';

/**
 * Checks device storage space.
 */
export const checkStorageSpace = async (): Promise<StorageStatus> => {
  try {
    const freeBytes = await FileSystem.getFreeDiskStorageAsync();
    const totalBytes = await FileSystem.getTotalDiskCapacityAsync();
    const usedBytes = totalBytes - freeBytes;
    
    return {
      available: freeBytes > 50 * 1024 * 1024, // 50MB min threshold
      usedBytes,
      freeBytes
    };
  } catch (error) {
    console.error('Failed to check storage space', error);
    return { available: true, usedBytes: 0, freeBytes: 100 * 1024 * 1024 };
  }
};

/**
 * Requests media library permission. Returns true if granted.
 */
export const requestMediaPermission = async (): Promise<boolean> => {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== 'granted') {
    console.warn('[Storage] Media library permission denied');
    return false;
  }
  return true;
};

/**
 * Saves a file to the GuardCam album in gallery.
 * Automatically requests permission if needed.
 */
export const saveToGallery = async (fileUri: string, _type: 'photo' | 'video'): Promise<string> => {
  try {
    // Ensure we have permission
    const hasPermission = await requestMediaPermission();
    if (!hasPermission) {
      throw new Error('Media library permission not granted');
    }

    const asset = await MediaLibrary.createAssetAsync(fileUri);
    const album = await MediaLibrary.getAlbumAsync('GuardCam');
    
    if (album == null) {
      await MediaLibrary.createAlbumAsync('GuardCam', asset, false);
    } else {
      await MediaLibrary.addAssetsToAlbumsAsync([asset], album, false);
    }
    
    console.log('[Storage] ✅ Saved to gallery:', asset.uri);
    return asset.uri;
  } catch (error) {
    console.error('[Storage] Failed to save to gallery', error);
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
    console.error('Failed to check if enough space', error);
    return true;
  }
};

/**
 * Cleans up temp capture files.
 */
export const cleanupTempFiles = async (): Promise<void> => {
  try {
    const cacheDir = FileSystem.cacheDirectory;
    if (!cacheDir) return;
    
    const files = await FileSystem.readDirectoryAsync(cacheDir);
    
    for (const file of files) {
      if (file.endsWith('.jpg') || file.endsWith('.mp4')) {
        await FileSystem.deleteAsync(cacheDir + file, { idempotent: true });
      }
    }
  } catch (error) {
    console.error('Failed to cleanup temp files', error);
  }
};
