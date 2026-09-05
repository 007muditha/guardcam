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
    if (!camera.current) {
      console.warn('[Capture] Camera ref is null when starting video');
      return null;
    }

    console.log(`[Capture] 🎥 Calling recordAsync(maxDuration: ${durationSec}s)...`);

    let stopTimer: any = null;
    const safetyPromise = new Promise<void>((resolve) => {
      stopTimer = setTimeout(async () => {
        try {
          console.log('[Capture] ⏱️ Duration reached, ensuring recording stops...');
          if (camera.current && typeof camera.current.stopRecording === 'function') {
            camera.current.stopRecording();
          }
        } catch (e) {
          console.warn('[Capture] Error calling stopRecording:', e);
        }
        resolve();
      }, (durationSec + 1) * 1000);
    });

    const videoPromise = camera.current.recordAsync({
      maxDuration: durationSec,
    });

    const recordingResult = await Promise.race([
      videoPromise,
      safetyPromise.then(() => videoPromise),
    ]);

    if (stopTimer) clearTimeout(stopTimer);
    console.log('[Capture] 🎥 recordAsync completed with:', recordingResult);
    return recordingResult?.uri || null;
  } catch (error: any) {
    console.error('[Capture] ❌ Failed to record video:', error?.message || error);
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
 * Orchestrates capturing photo (single or 10-second burst sequence), saving to local storage, and uploading to Google Drive.
 */
export const handleCapture = async (
  camera: RefObject<any>, 
  settings: AppSettings, 
  onEvent: (event: MotionEvent) => Promise<void>,
  onBurstProgress?: (currentCount: number, isBursting: boolean) => void
): Promise<void> => {
  try {
    const timestamp = Date.now();
    const eventId = generateEventId();
    const isBurstMode = settings.captureMode !== 'single';
    const burstDurationSec = settings.burstDuration || 10;
    const burstIntervalMs = settings.burstIntervalMs || 500;
    const shouldSaveGallery = settings.saveToGallery !== false;

    // Get Google Drive token if enabled
    let gDriveToken: string | null = null;
    if (settings.googleDriveEnabled && settings.googleDriveFolderId) {
      gDriveToken = await getAccessToken();
    }

    const burstUris: string[] = [];
    let uploadedCount = 0;

    if (isBurstMode) {
      console.log(`[Capture] ⚡ Starting ${burstDurationSec}s burst sequence (every ${burstIntervalMs}ms)...`);
      if (onBurstProgress) onBurstProgress(0, true);

      const startTime = Date.now();
      const endTime = startTime + (burstDurationSec * 1000);
      let frameIndex = 1;

      while (Date.now() < endTime) {
        try {
          const photoUri = await capturePhoto(camera);
          if (photoUri) {
            let finalUri = photoUri;
            if (shouldSaveGallery) {
              try {
                finalUri = await saveToGallery(photoUri, 'photo');
              } catch (e) {
                console.warn('[Capture] Gallery save fallback:', e);
              }
            }
            burstUris.push(finalUri);

            // Upload frame to Google Drive in background
            if (gDriveToken && settings.googleDriveFolderId) {
              uploadFile(
                finalUri,
                `GuardCam_${eventId}_frame${frameIndex}.jpg`,
                'image/jpeg',
                settings.googleDriveFolderId,
                gDriveToken
              ).then(() => {
                uploadedCount++;
              }).catch(err => {
                console.warn('[Capture] Drive upload frame error:', err);
              });
            }

            if (onBurstProgress) onBurstProgress(frameIndex, true);
            frameIndex++;
          }
        } catch (frameErr) {
          console.error('[Capture] Burst frame error:', frameErr);
        }

        // Wait interval before next frame
        await new Promise(r => setTimeout(r, burstIntervalMs));
      }

      if (onBurstProgress) onBurstProgress(burstUris.length, false);
      console.log(`[Capture] ⚡ Burst sequence completed: ${burstUris.length} frames captured.`);
    } else {
      // Single instant evidence photo
      const photoUri = await capturePhoto(camera);
      if (photoUri) {
        let finalUri = photoUri;
        if (shouldSaveGallery) {
          try {
            finalUri = await saveToGallery(photoUri, 'photo');
          } catch (e) {
            console.warn('[Capture] Gallery save fallback:', e);
          }
        }
        burstUris.push(finalUri);

        if (gDriveToken && settings.googleDriveFolderId) {
          try {
            await uploadFile(
              finalUri,
              `GuardCam_${eventId}.jpg`,
              'image/jpeg',
              settings.googleDriveFolderId,
              gDriveToken
            );
            uploadedCount++;
          } catch (e) {
            console.warn('[Capture] Single photo Drive upload error:', e);
          }
        }
      }
    }

    const mainPhotoUri = burstUris[0] || undefined;

    // Log event with burst details
    const event: MotionEvent = {
      id: eventId,
      timestamp,
      type: 'motion',
      hasPhoto: burstUris.length > 0,
      isBurst: isBurstMode,
      burstCount: burstUris.length,
      burstUris,
      photoUri: mainPhotoUri,
      uploaded: uploadedCount > 0,
      uploadedAt: uploadedCount > 0 ? Date.now() : undefined
    };

    await onEvent(event);

  } catch (error) {
    console.error('Handle capture error', error);
  }
};
