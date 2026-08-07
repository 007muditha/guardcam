import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import RNFS from 'react-native-fs';
import { StorageStatus } from '../types';

/**
 * Checks device storage space.
 */
export const checkStorageSpace = async (): Promise<StorageStatus> => {
  try {
    const info = await RNFS.getFSInfo();
    const freeBytes = info.freeSpace;
    const totalBytes = info.totalSpace;
    const usedBytes = totalBytes - freeBytes;
    
    return {
      available: freeBytes > 50 * 1024 * 1024, // 50MB min threshold
      usedBytes,
      freeBytes
    };
  } catch (error) {
    console.error('Failed to check storage space', error);
    return { available: false, usedBytes: 0, freeBytes: 0 };
  }
};

/**
 * Saves a file to the GuardCam album in gallery.
 */
export const saveToGallery = async (fileUri: string, type: 'photo' | 'video'): Promise<string> => {
  try {
    const uri = await CameraRoll.save(fileUri, {
      type,
      album: 'GuardCam'
    });
    return uri;
  } catch (error) {
    console.error('Failed to save to gallery', error);
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
    return false;
  }
};

/**
 * Cleans up temp capture files.
 */
export const cleanupTempFiles = async (): Promise<void> => {
  try {
    const cacheDir = RNFS.CachesDirectoryPath;
    const files = await RNFS.readDir(cacheDir);
    
    for (const file of files) {
      if (file.isFile() && (file.name.endsWith('.jpg') || file.name.endsWith('.mp4'))) {
        await RNFS.unlink(file.path);
      }
    }
  } catch (error) {
    console.error('Failed to cleanup temp files', error);
  }
};
