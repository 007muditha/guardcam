import { RefObject } from 'react';
import { Camera } from 'react-native-vision-camera';
import { AppSettings, MotionEvent } from '../types';
import { generateEventId } from '../utils/formatters';
import { hasEnoughSpace, saveToGallery } from './storageService';
import { uploadFile, getAccessToken } from './googleDriveService';

/**
 * Captures a photo using the camera ref.
 */
export const capturePhoto = async (camera: RefObject<Camera>): Promise<string | null> => {
  try {
    if (!camera.current) return null;
    const photo = await camera.current.takePhoto({
      qualityPrioritization: 'speed'
    });
    return photo.path;
  } catch (error) {
    console.error('Failed to capture photo', error);
    return null;
  }
};

/**
 * Starts video recording.
 */
export const startVideoRecording = async (camera: RefObject<Camera>, durationSec: number): Promise<void> => {
  try {
    if (!camera.current) return;
    camera.current.startRecording({
      onRecordingError: (error) => console.error('Recording error', error),
      onRecordingFinished: (video) => console.log('Recording finished', video)
    });
    
    setTimeout(async () => {
      if (camera.current) {
        await camera.current.stopRecording();
      }
    }, durationSec * 1000);
  } catch (error) {
    console.error('Failed to start video recording', error);
  }
};

/**
 * Stops video recording.
 */
export const stopVideoRecording = async (camera: RefObject<Camera>): Promise<string | null> => {
  try {
    if (!camera.current) return null;
    await camera.current.stopRecording();
    return null; 
  } catch (error) {
    console.error('Failed to stop video recording', error);
    return null;
  }
};

/**
 * Orchestrates capturing photo/video, saving, and logging.
 */
export const handleCapture = async (
  camera: RefObject<Camera>, 
  settings: AppSettings, 
  onEvent: (event: MotionEvent) => Promise<void>
): Promise<void> => {
  try {
    const timestamp = Date.now();
    const eventId = generateEventId();
    
    // 1. Take photo (always)
    const photoUri = await capturePhoto(camera);
    
    // 2. If video enabled, record
    if (settings.captureMode === 'video' || settings.captureMode === 'both') {
      await startVideoRecording(camera, settings.videoDuration);
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
      
      // 4. Else if storage available, save to gallery
      if (!uploaded) {
        const spaceOk = await hasEnoughSpace();
        if (spaceOk) {
          try {
            finalPhotoUri = await saveToGallery(photoUri, 'photo');
          } catch (e) {
            console.error('Gallery save failed', e);
          }
        }
      }
    }
    
    // 5 & 6. Log event only with no media (if no space/failed), or log with media
    const event: MotionEvent = {
      id: eventId,
      timestamp,
      type: 'motion',
      hasPhoto: !!finalPhotoUri,
      hasVideo: settings.captureMode === 'video' || settings.captureMode === 'both',
      photoUri: finalPhotoUri || undefined,
      uploaded,
      uploadedAt
    };
    
    await onEvent(event);
    
  } catch (error) {
    console.error('Handle capture error', error);
  }
};
