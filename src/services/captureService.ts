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
 * Uploads a list of captured burst photos to Google Drive in the background.
 * Sequentially uploads each frame so it never floods the network connection or drops frames.
 */
export const batchUploadToDrive = async (
  fileUris: string[],
  eventId: string,
  folderId: string,
  accessToken: string
): Promise<number> => {
  let successCount = 0;
  console.log(`[DriveBatch] ☁️ Starting sequential background upload of ${fileUris.length} photos...`);

  for (let i = 0; i < fileUris.length; i++) {
    try {
      const fileName = fileUris.length > 1 
        ? `GuardCam_${eventId}_frame${i + 1}.jpg` 
        : `GuardCam_${eventId}.jpg`;

      await uploadFile(
        fileUris[i],
        fileName,
        'image/jpeg',
        folderId,
        accessToken
      );
      successCount++;
      console.log(`[DriveBatch] ☁️ Synced frame ${i + 1}/${fileUris.length} to Google Drive`);
    } catch (err) {
      console.warn(`[DriveBatch] ⚠️ Failed uploading frame ${i + 1}:`, err);
    }
  }

  console.log(`[DriveBatch] ✅ Batch upload complete: ${successCount}/${fileUris.length} files synced.`);
  return successCount;
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

    // 1. Capture sequence runs with ZERO network interference for maximum camera frame rate
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
      console.log(`[Capture] ⚡ Burst sequence completed: ${burstUris.length} frames captured locally.`);
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
      }
    }

    // 2. Batch upload all captured photos to Google Drive in the background (NON-BLOCKING)
    if (gDriveToken && settings.googleDriveFolderId && burstUris.length > 0) {
      batchUploadToDrive(burstUris, eventId, settings.googleDriveFolderId, gDriveToken)
        .catch(err => console.warn('[Capture] Drive batch upload error:', err));
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
      uploaded: !!(gDriveToken && settings.googleDriveFolderId),
      uploadedAt: gDriveToken && settings.googleDriveFolderId ? Date.now() : undefined
    };

    await onEvent(event);

  } catch (error) {
    console.error('Handle capture error', error);
  }
};
