import { RefObject } from 'react';
import * as ImageManipulator from 'expo-image-manipulator';
import { SENSITIVITY_THRESHOLDS } from '../types';
import { DETECTION } from '../utils/constants';

/**
 * Motion Detection Service — v4.1 (PNG Thumbnail + Noise-Filtered Comparison)
 *
 * Key improvements over v4:
 *   1. Uses PNG format instead of JPEG for thumbnails.
 *      PNG is lossless and deterministic — identical pixels produce identical bytes.
 *   2. Ignores small character changes (±5) which are compression/rounding noise.
 *      Only counts SIGNIFICANT character changes as potential motion.
 *   3. Slightly larger thumbnail (20x15 = 300 pixels) for better spatial resolution.
 */

const THUMBNAIL_WIDTH = 20;
const THUMBNAIL_HEIGHT = 15;
const REQUIRED_CONSECUTIVE_FRAMES = 2;

/** Minimum character difference to count as "significant" (ignores rounding noise) */
const CHAR_NOISE_FLOOR = 3;

let baselineThumbnail: string | null = null;
let lastMotionTimestamp = 0;
let isRunning = false;
let intervalId: ReturnType<typeof setInterval> | null = null;
let isAnalyzing = false;
let consecutiveMotionFrames = 0;

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
 * Compares two PNG thumbnail base64 strings with noise filtering.
 *
 * Only counts character differences ABOVE the noise floor.
 * Small variations (±1-3 charCode) from PNG compression rounding are ignored.
 * Large variations (±10+) from real pixel changes are counted.
 *
 * Returns a score between 0 (identical) and 1 (completely different).
 */
const compareThumbnails = (a: string, b: string): number => {
  const minLen = Math.min(a.length, b.length);
  const maxLen = Math.max(a.length, b.length);

  if (minLen === 0) return 0;

  let significantChanges = 0;
  let totalSignificantDiff = 0;

  for (let i = 0; i < minLen; i++) {
    const diff = Math.abs(a.charCodeAt(i) - b.charCodeAt(i));
    if (diff > CHAR_NOISE_FLOOR) {
      significantChanges++;
      totalSignificantDiff += diff;
    }
  }

  // Length difference penalty (major image restructuring)
  const lengthDiffRatio = Math.abs(a.length - b.length) / maxLen;

  // Ratio of characters with significant changes
  const changeRatio = significantChanges / minLen;

  // Average magnitude of significant changes (normalized)
  const avgMagnitude = significantChanges > 0
    ? (totalSignificantDiff / significantChanges) / 60
    : 0;

  // Combined score
  const score = (changeRatio * 0.5) + (avgMagnitude * 0.35) + (lengthDiffRatio * 0.15);

  return score;
};

/**
 * Captures a photo, resizes to a tiny PNG thumbnail, and compares with baseline.
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

    const photo = await cameraRef.current.takePictureAsync({
      quality: 0.1,
    });

    if (!photo?.uri) {
      console.log('[Motion] ❌ No photo URI returned');
      return { motionDetected: false, score: 0 };
    }

    // Resize to tiny thumbnail using PNG (lossless, deterministic)
    const thumbnail = await ImageManipulator.manipulateAsync(
      photo.uri,
      [{ resize: { width: THUMBNAIL_WIDTH, height: THUMBNAIL_HEIGHT } }],
      { base64: true, compress: 1.0, format: ImageManipulator.SaveFormat.PNG }
    );

    if (!thumbnail?.base64) {
      console.log('[Motion] ❌ No thumbnail base64');
      return { motionDetected: false, score: 0 };
    }

    frameCount++;

    // First frame: establish baseline
    if (!baselineThumbnail) {
      baselineThumbnail = thumbnail.base64;
      consecutiveMotionFrames = 0;
      console.log(`[Motion] ✅ Baseline set (frame #${frameCount}, PNG ${thumbnail.base64.length} chars)`);
      return { motionDetected: false, score: 0 };
    }

    const score = compareThumbnails(thumbnail.base64, baselineThumbnail);
    latestScore = score;
    const threshold = SENSITIVITY_THRESHOLDS[sensitivity];
    const frameExceedsThreshold = score > threshold;

    console.log(`[Motion] Frame #${frameCount} | Score: ${score.toFixed(4)} | Threshold: ${threshold} | ${frameExceedsThreshold ? '⚠️ ABOVE' : '✅ below'} | Len: ${thumbnail.base64.length}`);

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
      // Update baseline on stable frames to adapt to gradual changes
      baselineThumbnail = thumbnail.base64;
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

  console.log(`[Motion] ✅ STARTED v4.1 PNG (sensitivity: ${sensitivity}, interval: ${intervalMs}ms, ${THUMBNAIL_WIDTH}x${THUMBNAIL_HEIGHT}px, noise floor: ${CHAR_NOISE_FLOOR})`);
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
