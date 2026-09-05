import { Camera } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library/legacy';

export interface AppPermissionsStatus {
  camera: boolean;
  storage: boolean;
}

/**
 * Requests camera permission via Expo Camera.
 */
export const requestCameraPermission = async (): Promise<boolean> => {
  try {
    const status = await Camera.requestCameraPermissionsAsync();
    return status.granted;
  } catch (error) {
    console.error('Failed to request camera permission', error);
    return false;
  }
};

/**
 * Requests storage/photo library permissions via Expo MediaLibrary.
 */
export const requestStoragePermission = async (): Promise<boolean> => {
  try {
    const status = await MediaLibrary.requestPermissionsAsync(false, ['photo', 'video']);
    return status.granted;
  } catch {
    // Expo Go on Android does not permit system media library access, but internal app storage is always available
    return true;
  }
};

/**
 * Requests all required permissions.
 */
export const requestAllPermissions = async (): Promise<AppPermissionsStatus> => {
  const camera = await requestCameraPermission();
  const storage = await requestStoragePermission();
  return { camera, storage };
};

/**
 * Checks current permissions without requesting them.
 */
export const checkAllPermissions = async (): Promise<AppPermissionsStatus> => {
  try {
    const cameraStatus = await Camera.getCameraPermissionsAsync();
    let storageGranted = true;
    try {
      const storageStatus = await MediaLibrary.getPermissionsAsync(false, ['photo', 'video']);
      storageGranted = storageStatus.granted;
    } catch {
      storageGranted = true;
    }
    
    return {
      camera: cameraStatus.granted,
      storage: storageGranted
    };
  } catch (error) {
    console.error('Failed to check permissions', error);
    return { camera: false, storage: true };
  }
};
