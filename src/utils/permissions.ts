import { Platform } from 'react-native';
import { Camera } from 'react-native-vision-camera';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';

export interface AppPermissionsStatus {
  camera: boolean;
  storage: boolean;
}

/**
 * Requests camera permission.
 */
export const requestCameraPermission = async (): Promise<boolean> => {
  try {
    const status = await Camera.requestCameraPermission();
    return status === 'granted';
  } catch (error) {
    console.error('Failed to request camera permission', error);
    return false;
  }
};

/**
 * Requests storage/photo library permissions.
 */
export const requestStoragePermission = async (): Promise<boolean> => {
  try {
    if (Platform.OS === 'ios') {
      const status = await request(PERMISSIONS.IOS.PHOTO_LIBRARY);
      return status === RESULTS.GRANTED || status === RESULTS.LIMITED;
    } else {
      if (Platform.Version >= 33) {
        const photoStatus = await request(PERMISSIONS.ANDROID.READ_MEDIA_IMAGES);
        const videoStatus = await request(PERMISSIONS.ANDROID.READ_MEDIA_VIDEO);
        return photoStatus === RESULTS.GRANTED && videoStatus === RESULTS.GRANTED;
      } else {
        const status = await request(PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE);
        return status === RESULTS.GRANTED;
      }
    }
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
    const cameraStatus = await Camera.getCameraPermissionStatus();
    let storageStatus = false;
    
    if (Platform.OS === 'ios') {
      const result = await check(PERMISSIONS.IOS.PHOTO_LIBRARY);
      storageStatus = result === RESULTS.GRANTED || result === RESULTS.LIMITED;
    } else {
      if (Platform.Version >= 33) {
        const photoResult = await check(PERMISSIONS.ANDROID.READ_MEDIA_IMAGES);
        const videoResult = await check(PERMISSIONS.ANDROID.READ_MEDIA_VIDEO);
        storageStatus = photoResult === RESULTS.GRANTED && videoResult === RESULTS.GRANTED;
      } else {
        const result = await check(PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE);
        storageStatus = result === RESULTS.GRANTED;
      }
    }
    
    return {
      camera: cameraStatus === 'granted',
      storage: storageStatus
    };
  } catch (error) {
    console.error('Failed to check permissions', error);
    return { camera: false, storage: false };
  }
};
