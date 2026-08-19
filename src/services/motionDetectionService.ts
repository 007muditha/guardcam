import { RefObject } from 'react';
import * as ImageManipulator from 'expo-image-manipulator';
import { SENSITIVITY_THRESHOLDS } from '../types';
import { DETECTION } from '../utils/constants';

/**
 * Motion Detection Service — v5 (Sequential Frame-to-Frame Comparison)
 *
 * Implements direct frame-to-frame baseline comparison:
 *   1. Captures Frame N and resizes to a 20x15 thumbnail.
 *   2. Compares Frame N against Previous Frame (N-1).
 *   3. Uses normalized mean character difference + length delta ratio.
 *      - Static scene: score ~0.01 - 0.04 (well below threshold).
 *      - Real motion:  score ~0.15 - 0.50+ (triggers motion).
 *   4. Always updates baseline to Frame N for continuous tracking.
 */

const THUMBNAIL_WIDTH = 20;
const THUMBNAIL_HEIGHT = 15;
const REQUIRED_CONSECUTIVE_FRAMES = 2;

/** Previous frame's thumbnail base64 string */
let previousThumbnail: string | null = null;

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
  hasBaseline: previousThumbnail !== null,
  consecutiveFrames: consecutiveMotionFrames,
});

/**
 * Computes the normalized mathematical difference between two thumbnail base64 strings.
 *
 * Combines:
 *   1. Mean absolute byte difference: sum(|a[i] - b[i]|) / (length * 255)
 *   2. Length delta ratio: |len(a) - len(b)| / max(len(a), len(b))
 *
 * Results:
 *   - Static scene: ~0.01 - 0.04
 *   - Real motion:  ~0.15 - 0.50+
 */
const computeNormalizedDiff = (a: string, b: string): number => {
  const minLen = Math.min(a.length, b.length);
  const maxLen = Math.max(a.length, b.length);

  if (minLen === 0) return 0;

  let totalDiff = 0;
  for (let i = 0; i < minLen; i++) {
    totalDiff += Math.abs(a.charCodeAt(i) - b.charCodeAt(i));
  }

  const meanCharDiff = (totalDiff / minLen) / 255;
  const lengthDiffRatio = (maxLen - minLen) / maxLen;

  return (meanCharDiff * 0.7) + (lengthDiffRatio * 0.3);
};

/**
 * Captures Frame N, compares it against Frame N-1, and updates baseline.
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

    // Resize to tiny 20x15 PNG thumbnail
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
    const currentThumbnail = thumbnail.base64;

    // First frame: store as baseline and wait for next frame
    if (!previousThumbnail) {
      previousThumbnail = currentThumbnail;
      consecutiveMotionFrames = 0;
      console.log(`[Motion] ✅ Initial baseline set (frame #${frameCount}, len: ${currentThumbnail.length})`);
      return { motionDetected: false, score: 0 };
    }

    // Compare Frame N against Frame N-1
    const score = computeNormalizedDiff(currentThumbnail, previousThumbnail);
    latestScore = score;

    // Always update baseline to current frame for next comparison
    previousThumbnail = currentThumbnail;

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
      consecutiveMotionFrames = 0;
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
  previousThumbnail = null;
  lastMotionTimestamp = 0;
  consecutiveMotionFrames = 0;
  frameCount = 0;
  latestScore = 0;

  console.log(`[Motion] ✅ STARTED v5 Sequential (sensitivity: ${sensitivity}, interval: ${intervalMs}ms)`);

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
  previousThumbnail = null;
  consecutiveMotionFrames = 0;

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  console.log('[Motion] ⏹ Stopped');
};

export const resetBaseline = () => {
  previousThumbnail = null;
  consecutiveMotionFrames = 0;
  console.log('[Motion] Baseline reset');
};
