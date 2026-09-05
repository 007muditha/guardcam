import { RefObject } from 'react';
import { AppSettings, MotionEvent } from '../types';
import { generateEventId } from '../utils/formatters';
import { hasEnoughSpace, saveToGallery } from './storageService';
import { uploadFile, getAccessToken } from './googleDriveService';

/**
 * Captures a photo using Expo CameraView ref.
 */
export const capturePhoto = async (camera: RefObject<any>): Promise<string | null> => {
  try {
    if (!camera.current) return null;
    const photo = await camera.current.takePictureAsync({
      quality: 0.8,
      shutterSound: false,
    });
    return photo?.uri || null;
  } catch (error) {
    console.error('Failed to capture photo', error);
    return null;
  }
};

/**
 * Starts video recording using Expo CameraView ref.
 */
export const startVideoRecording = async (camera: RefObject<any>, durationSec: number): Promise<string | null> => {
  try {
    if (!camera.current) return null;
    const videoPromise = camera.current.recordAsync({
      maxDuration: durationSec
    });
    const video = await videoPromise;
    return video?.uri || null;
  } catch (error) {
    console.error('Failed to start video recording', error);
    return null;
  }
};

/**
 * Stops video recording.
 */
export const stopVideoRecording = async (camera: RefObject<any>): Promise<void> => {
  try {
    if (!camera.current) return;
    camera.current.stopRecording();
  } catch (error) {
    console.error('Failed to stop video recording', error);
  }
};

/**
 * Orchestrates capturing photo/video, saving, and logging.
 */
export const handleCapture = async (
  camera: RefObject<any>, 
  settings: AppSettings, 
  onEvent: (event: MotionEvent) => Promise<void>
): Promise<void> => {
  try {
    const timestamp = Date.now();
    const eventId = generateEventId();
    
    // 1. Take photo (always)
    const photoUri = await capturePhoto(camera);
    
    // 2. If video enabled, record
    let videoUri: string | null = null;
    if (settings.captureMode === 'video' || settings.captureMode === 'both') {
      videoUri = await startVideoRecording(camera, settings.videoDuration);
    }
    
    let finalPhotoUri = photoUri;
    let uploaded = false;
    let uploadedAt: number | undefined = undefined;
    
    if (photoUri) {
      // 3. If Google Drive configured, upload
      if (settings.googleDriveEnabled && settings.googleDriveFolderId) {
        const token = await getAccessToken();
        if (token) {
          try {
            await uploadFile(
              photoUri,
              `GuardCam_${eventId}.jpg`,
              'image/jpeg',
              settings.googleDriveFolderId,
              token
            );
            uploaded = true;
            uploadedAt = Date.now();
          } catch (e) {
            console.error('Google drive upload failed', e);
          }
        }
      }
      
      // 4. Save to persistent local gallery if enabled
      const shouldSaveGallery = settings.saveToGallery !== false;
      if (shouldSaveGallery) {
        const spaceOk = await hasEnoughSpace();
        if (spaceOk) {
          try {
            finalPhotoUri = await saveToGallery(photoUri, 'photo');
          } catch (e) {
            console.error('Gallery save failed, keeping local temp photo', e);
          }
        }
      }

      // 5. If video was recorded and Google Drive is enabled, upload video too
      if (videoUri && settings.googleDriveEnabled && settings.googleDriveFolderId) {
        const token = await getAccessToken();
        if (token) {
          try {
            await uploadFile(
              videoUri,
              `GuardCam_${eventId}.mp4`,
              'video/mp4',
              settings.googleDriveFolderId,
              token
            );
          } catch (e) {
            console.error('Google drive video upload failed', e);
          }
        }
      }
    }
    
    // 5. Log event with media status
    const event: MotionEvent = {
      id: eventId,
      timestamp,
      type: 'motion',
      hasPhoto: !!finalPhotoUri,
      hasVideo: !!videoUri,
      photoUri: finalPhotoUri || undefined,
      videoUri: videoUri || undefined,
      uploaded,
      uploadedAt
    };
    
    await onEvent(event);
    
  } catch (error) {
    console.error('Handle capture error', error);
  }
};
