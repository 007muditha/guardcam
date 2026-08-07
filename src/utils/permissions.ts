import { Camera } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';

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
    const status = await MediaLibrary.requestPermissionsAsync();
    return status.granted;
  } catch (error) {
    console.error('Failed to request storage permission', error);
    return false;
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
    const storageStatus = await MediaLibrary.getPermissionsAsync();
    
    return {
      camera: cameraStatus.granted,
      storage: storageStatus.granted
    };
  } catch (error) {
    console.error('Failed to check permissions', error);
    return { camera: false, storage: false };
  }
};
