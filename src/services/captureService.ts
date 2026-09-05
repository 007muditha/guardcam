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
 * Orchestrates capturing photo and/or 10s video, saving to local storage, and uploading to Google Drive.
 */
export const handleCapture = async (
  camera: RefObject<any>, 
  settings: AppSettings, 
  onEvent: (event: MotionEvent) => Promise<void>,
  switchCameraMode?: (mode: 'picture' | 'video') => Promise<void>,
  onRecordingStatusChange?: (isRecording: boolean) => void
): Promise<void> => {
  try {
    const timestamp = Date.now();
    const eventId = generateEventId();
    const isVideoRequested = settings.captureMode === 'video' || settings.captureMode === 'both';
    const isPhotoRequested = settings.captureMode === 'photo' || settings.captureMode === 'both';
    const videoDuration = settings.videoDuration || 10;
    
    // 1. Capture instant evidence photo snapshot if requested
    let photoUri: string | null = null;
    if (isPhotoRequested) {
      photoUri = await capturePhoto(camera);
    }
    
    // 2. If 10s video recording is requested, switch camera mode and record
    let videoUri: string | null = null;
    if (isVideoRequested) {
      try {
        if (switchCameraMode) {
          await switchCameraMode('video');
        }
        if (onRecordingStatusChange) {
          onRecordingStatusChange(true);
        }

        console.log(`[Capture] 🎥 Recording ${videoDuration}s video clip...`);
        videoUri = await startVideoRecording(camera, videoDuration);
        console.log('[Capture] 🎥 Video recording finished:', videoUri ? 'Success' : 'Failed');
      } catch (videoErr) {
        console.error('[Capture] Video recording error:', videoErr);
      } finally {
        if (onRecordingStatusChange) {
          onRecordingStatusChange(false);
        }
        if (switchCameraMode) {
          await switchCameraMode('picture');
        }
      }
    }
    
    let finalPhotoUri = photoUri;
    let finalVideoUri = videoUri;
    let uploaded = false;
    let uploadedAt: number | undefined = undefined;
    const shouldSaveGallery = settings.saveToGallery !== false;

    // Get Google Drive token if enabled
    let gDriveToken: string | null = null;
    if (settings.googleDriveEnabled && settings.googleDriveFolderId) {
      gDriveToken = await getAccessToken();
    }

    // 3. Process photo (upload to Google Drive & save to persistent storage)
    if (photoUri) {
      if (gDriveToken && settings.googleDriveFolderId) {
        try {
          await uploadFile(
            photoUri,
            `GuardCam_${eventId}.jpg`,
            'image/jpeg',
            settings.googleDriveFolderId,
            gDriveToken
          );
          uploaded = true;
          uploadedAt = Date.now();
          console.log('[Capture] ☁️ Photo uploaded to Google Drive');
        } catch (e) {
          console.error('[Capture] Google Drive photo upload failed', e);
        }
      }

      if (shouldSaveGallery) {
        const spaceOk = await hasEnoughSpace();
        if (spaceOk) {
          try {
            finalPhotoUri = await saveToGallery(photoUri, 'photo');
          } catch (e) {
            console.error('[Capture] Gallery photo save failed', e);
          }
        }
      }
    }

    // 4. Process video (upload to Google Drive & save to persistent storage)
    if (videoUri) {
      if (gDriveToken && settings.googleDriveFolderId) {
        try {
          await uploadFile(
            videoUri,
            `GuardCam_${eventId}.mp4`,
            'video/mp4',
            settings.googleDriveFolderId,
            gDriveToken
          );
          uploaded = true;
          uploadedAt = Date.now();
          console.log('[Capture] ☁️ Video clip uploaded to Google Drive');
        } catch (e) {
          console.error('[Capture] Google Drive video upload failed', e);
        }
      }

      if (shouldSaveGallery) {
        const spaceOk = await hasEnoughSpace();
        if (spaceOk) {
          try {
            finalVideoUri = await saveToGallery(videoUri, 'video');
          } catch (e) {
            console.error('[Capture] Gallery video save failed', e);
          }
        }
      }
    }
    
    // 5. Log event with photo and video details
    const event: MotionEvent = {
      id: eventId,
      timestamp,
      type: 'motion',
      hasPhoto: !!finalPhotoUri,
      hasVideo: !!finalVideoUri,
      photoUri: finalPhotoUri || undefined,
      videoUri: finalVideoUri || undefined,
      uploaded,
      uploadedAt
    };
    
    await onEvent(event);
    
  } catch (error) {
    console.error('Handle capture error', error);
  }
};
