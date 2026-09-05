import * as MediaLibrary from 'expo-media-library/legacy';
import * as FileSystem from 'expo-file-system/legacy';
import { StorageStatus } from '../types';

/**
 * Checks device storage space safely.
 */
export const checkStorageSpace = async (): Promise<StorageStatus> => {
  try {
    let freeBytes = 500 * 1024 * 1024; // 500MB fallback
    let totalBytes = 1000 * 1024 * 1024;

    if (typeof FileSystem.getFreeDiskStorageAsync === 'function') {
      try {
        freeBytes = await FileSystem.getFreeDiskStorageAsync();
      } catch (e) {}
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
    return { available: true, usedBytes: 0, freeBytes: 500 * 1024 * 1024 };
  }
};

/**
 * Requests media library permission. Returns true if granted.
 */
export const requestMediaPermission = async (): Promise<boolean> => {
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync(false, ['photo', 'video']);
    if (status !== 'granted') {
      console.warn('[Storage] Media library permission denied');
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[Storage] Permission request error, checking existing permissions:', e);
    try {
      const res = await MediaLibrary.getPermissionsAsync(false, ['photo', 'video']);
      return res.granted;
    } catch {
      return false;
    }
  }
};

/**
 * Saves a file to the GuardCam album in gallery.
 * Returns local file:// URI (or asset.uri if file:// is unavailable)
 * so React Native <Image /> can render it without iOS ph:// URL handler crashes.
 */
export const saveToGallery = async (fileUri: string, _type: 'photo' | 'video'): Promise<string> => {
  try {
    const hasPermission = await requestMediaPermission();
    if (!hasPermission) {
      throw new Error('Media library permission not granted');
    }

    // Save asset to system camera roll
    const asset = await MediaLibrary.createAssetAsync(fileUri);
    if (asset && asset.id) {
      try {
        const album = await MediaLibrary.getAlbumAsync('GuardCam');
        if (album === null || !album.id) {
          await MediaLibrary.createAlbumAsync('GuardCam', asset.id, false);
        } else {
          // Note: Expo MediaLibrary uses singular addAssetsToAlbumAsync
          await MediaLibrary.addAssetsToAlbumAsync([asset.id], album.id, false);
        }
      } catch (albumErr) {
        console.warn('[Storage] Album grouping fallback:', albumErr);
      }
    }
    
    // Always return fileUri (file://...) so React Native <Image /> renders it natively on iOS/Android
    const targetUri = fileUri.startsWith('file://') || fileUri.startsWith('/') ? fileUri : (asset?.uri || fileUri);
    console.log('[Storage] ✅ Saved asset to gallery, display URI:', targetUri);
    return targetUri;
  } catch (error) {
    console.error('[Storage] Failed to save to gallery:', error);
    // Return original fileUri as fallback so app doesn't break
    return fileUri;
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
