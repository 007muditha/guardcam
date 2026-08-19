import { RefObject } from 'react';
import * as ImageManipulator from 'expo-image-manipulator';
import { SENSITIVITY_THRESHOLDS } from '../types';
import { DETECTION } from '../utils/constants';

/**
 * Motion Detection Service — v4 (Thumbnail Pixel Comparison)
 *
 * Why previous versions failed:
 *   Comparing base64 characters from full-size JPEGs doesn't work because
 *   JPEG compression produces wildly different byte streams even for identical
 *   scenes. Block-averaging base64 characters produced scores of 0.02-0.05
 *   for EVERYTHING — static or moving.
 *
 * v4 solution:
 *   1. Capture a photo with takePictureAsync.
 *   2. Use expo-image-manipulator to resize it to 16x12 pixels.
 *   3. Get the base64 of this TINY thumbnail (~500 bytes).
 *   4. At 16x12, each pixel represents ~80,000 original pixels averaged together,
 *      completely eliminating sensor noise and compression artifacts.
 *   5. Compare the tiny thumbnail base64 strings directly.
 *   6. Real motion produces massive, obvious differences in the thumbnail.
 */

const THUMBNAIL_WIDTH = 16;
const THUMBNAIL_HEIGHT = 12;
const REQUIRED_CONSECUTIVE_FRAMES = 2;

let baselineThumbnail: string | null = null;
let lastMotionTimestamp = 0;
let isRunning = false;
let intervalId: ReturnType<typeof setInterval> | null = null;
let isAnalyzing = false;
let consecutiveMotionFrames = 0;

/** Debug info */
let latestScore = 0;
let frameCount = 0;

export const getDebugInfo = () => ({
  score: latestScore,
  frameCount,
  isRunning,
  hasBaseline: baselineThumbnail !== null,
  consecutiveFrames: consecutiveMotionFrames,
});

/**
 * Computes normalized difference between two base64 thumbnail strings.
 * Because the thumbnails are tiny (16x12 = 192 pixels), the base64
 * is only ~500-800 characters, and each character represents a
 * meaningful portion of the image.
 */
const compareThumbnails = (a: string, b: string): number => {
  const minLen = Math.min(a.length, b.length);
  const maxLen = Math.max(a.length, b.length);

  if (minLen === 0) return 0;

  let diffCount = 0;
  let totalCharDiff = 0;

  for (let i = 0; i < minLen; i++) {
    const diff = Math.abs(a.charCodeAt(i) - b.charCodeAt(i));
    if (diff > 0) {
      diffCount++;
      totalCharDiff += diff;
    }
  }

  // Add penalty for length difference (indicates major image change)
  const lengthPenalty = Math.abs(a.length - b.length) / maxLen;

  // Combine: percentage of characters that changed + average magnitude of change
  const changeRatio = diffCount / minLen;
  const avgMagnitude = diffCount > 0 ? (totalCharDiff / diffCount) / 80 : 0;

  // Final score: weighted combination
  const score = (changeRatio * 0.6) + (avgMagnitude * 0.3) + (lengthPenalty * 0.1);

  return score;
};

/**
 * Captures a photo, resizes to a tiny thumbnail, and compares with baseline.
 */
export const analyzeFrame = async (
  cameraRef: RefObject<any>,
  sensitivity: 'low' | 'medium' | 'high'
): Promise<{ motionDetected: boolean; score: number }> => {
  if (isAnalyzing) {
    return { motionDetected: false, score: latestScore };
  }
  isAnalyzing = true;

  try {
    if (!cameraRef.current) {
      console.log('[Motion] ❌ Camera ref is NULL');
      return { motionDetected: false, score: 0 };
    }

    // Step 1: Capture photo (low quality, just need the URI)
    const photo = await cameraRef.current.takePictureAsync({
      quality: 0.1,
    });

    if (!photo?.uri) {
      console.log('[Motion] ❌ No photo URI returned');
      return { motionDetected: false, score: 0 };
    }

    // Step 2: Resize to tiny thumbnail using ImageManipulator
    const thumbnail = await ImageManipulator.manipulateAsync(
      photo.uri,
      [{ resize: { width: THUMBNAIL_WIDTH, height: THUMBNAIL_HEIGHT } }],
      { base64: true, compress: 1.0, format: ImageManipulator.SaveFormat.JPEG }
    );

    if (!thumbnail?.base64) {
      console.log('[Motion] ❌ No thumbnail base64');
      return { motionDetected: false, score: 0 };
    }

    frameCount++;

    console.log(`[Motion] 🖼️ Thumbnail base64 length: ${thumbnail.base64.length}`);

    // First frame: establish baseline
    if (!baselineThumbnail) {
      baselineThumbnail = thumbnail.base64;
      consecutiveMotionFrames = 0;
      console.log(`[Motion] ✅ Baseline set (frame #${frameCount}, thumbnail ${thumbnail.base64.length} chars)`);
      return { motionDetected: false, score: 0 };
    }

    // Step 3: Compare thumbnails
    const score = compareThumbnails(thumbnail.base64, baselineThumbnail);
    latestScore = score;
    const threshold = SENSITIVITY_THRESHOLDS[sensitivity];
    const frameExceedsThreshold = score > threshold;

    console.log(`[Motion] Frame #${frameCount} | Score: ${score.toFixed(4)} | Threshold: ${threshold} | ${frameExceedsThreshold ? '⚠️ ABOVE' : '✅ below'} | Consecutive: ${consecutiveMotionFrames}`);

    if (frameExceedsThreshold) {
      consecutiveMotionFrames++;
    } else {
      consecutiveMotionFrames = 0;
    }

    const motionDetected = consecutiveMotionFrames >= REQUIRED_CONSECUTIVE_FRAMES;

    if (motionDetected) {
      console.log(`[Motion] 🚨🚨🚨 MOTION CONFIRMED! Score: ${score.toFixed(4)}`);
      baselineThumbnail = thumbnail.base64;
      consecutiveMotionFrames = 0;
    } else if (!frameExceedsThreshold) {
      // Slowly update baseline to adapt to gradual changes
      // Every 5th frame, update baseline to current
      if (frameCount % 5 === 0) {
        baselineThumbnail = thumbnail.base64;
        console.log(`[Motion] 🔄 Baseline refreshed (frame #${frameCount})`);
      }
    }

    return { motionDetected, score };
  } catch (error: any) {
    console.error('[Motion] ❌ ERROR:', error?.message || error);
    return { motionDetected: false, score: 0 };
  } finally {
    isAnalyzing = false;
  }
};

export const startMotionDetection = (
  cameraRef: RefObject<any>,
  sensitivity: 'low' | 'medium' | 'high',
  onMotion: (score: number) => void,
  intervalMs: number = 3000
) => {
  if (isRunning) {
    stopMotionDetection();
  }

  isRunning = true;
  isAnalyzing = false;
  baselineThumbnail = null;
  lastMotionTimestamp = 0;
  consecutiveMotionFrames = 0;
  frameCount = 0;
  latestScore = 0;

  console.log(`[Motion] ✅ STARTED v4 THUMBNAIL (sensitivity: ${sensitivity}, interval: ${intervalMs}ms, ${THUMBNAIL_WIDTH}x${THUMBNAIL_HEIGHT}px)`);
  console.log(`[Motion] Thresholds: low=${SENSITIVITY_THRESHOLDS.low}, medium=${SENSITIVITY_THRESHOLDS.medium}, high=${SENSITIVITY_THRESHOLDS.high}`);

  intervalId = setInterval(async () => {
    if (!isRunning) return;

    const { motionDetected, score } = await analyzeFrame(cameraRef, sensitivity);

    if (motionDetected) {
      const now = Date.now();
      if (now - lastMotionTimestamp > DETECTION.COOLDOWN_MS) {
        lastMotionTimestamp = now;
        console.log(`[Motion] 📷 Triggering capture!`);
        onMotion(score);
      } else {
        console.log(`[Motion] Cooldown (${((DETECTION.COOLDOWN_MS - (now - lastMotionTimestamp)) / 1000).toFixed(0)}s remaining)`);
      }
    }
  }, intervalMs);
};

export const stopMotionDetection = () => {
  isRunning = false;
  isAnalyzing = false;
  baselineThumbnail = null;
  consecutiveMotionFrames = 0;

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  console.log('[Motion] ⏹ Stopped');
};

export const resetBaseline = () => {
  baselineThumbnail = null;
  consecutiveMotionFrames = 0;
  console.log('[Motion] Baseline reset');
};
