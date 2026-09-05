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
/**
 * Requests media library permission. Returns true if granted.
 * In Expo Go on modern Android, media library access is restricted by Google Play policy,
 * so we gracefully return false without throwing.
 */
export const requestMediaPermission = async (): Promise<boolean> => {
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync(false, ['photo', 'video']);
    return status === 'granted';
  } catch (e: any) {
    return false;
  }
};

/**
 * Saves a file to persistent app storage (and system photo library if supported).
 * Returns the permanent file URI so React Native <Image /> can render it.
 */
export const saveToGallery = async (fileUri: string, _type: 'photo' | 'video'): Promise<string> => {
  let persistentUri = fileUri;

  // 1. Always copy to persistent app storage so photo is never lost to cache clearing
  try {
    const filename = fileUri.split('/').pop() || `capture_${Date.now()}.jpg`;
    const destDir = `${FileSystem.documentDirectory}GuardCam/`;
    
    const dirInfo = await FileSystem.getInfoAsync(destDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
    }
    
    const destUri = `${destDir}${filename}`;
    await FileSystem.copyAsync({ from: fileUri, to: destUri });
    persistentUri = destUri;
    console.log('[Storage] ✅ Saved to persistent app storage:', persistentUri);
  } catch (fsErr) {
    console.warn('[Storage] Using original URI:', fsErr);
  }

  // 2. Also try saving to device system gallery if running in a build with MediaLibrary support
  try {
    const hasPermission = await requestMediaPermission();
    if (hasPermission) {
      const asset = await MediaLibrary.createAssetAsync(persistentUri);
      if (asset && asset.id) {
        try {
          const album = await MediaLibrary.getAlbumAsync('GuardCam');
          if (album === null || !album.id) {
            await MediaLibrary.createAlbumAsync('GuardCam', asset.id, false);
          } else {
            await MediaLibrary.addAssetsToAlbumAsync([asset.id], album.id, false);
          }
        } catch (albumErr) {
          console.warn('[Storage] Album grouping fallback:', albumErr);
        }
      }
      console.log('[Storage] ✅ Also saved to system photo library');
    }
  } catch {
    // Expo Go graceful fallback: photos remain safely in persistent app storage
  }

  return persistentUri;
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
