import { RefObject } from 'react';
import { CameraView } from 'expo-camera';
import { SENSITIVITY_THRESHOLDS } from '../types';
import { DETECTION } from '../utils/constants';

/**
 * Motion Detection Service
 *
 * Uses snapshot-comparison approach for Expo Go compatibility:
 *   1. Periodically capture low-quality snapshots with base64 data
 *   2. Sample luminance values from the base64 string
 *   3. Compare with the previous frame's samples
 *   4. If the difference exceeds the sensitivity threshold → motion detected
 */

/** Previous frame's luminance samples */
let previousSamples: number[] | null = null;

/** Timestamp of the last motion trigger (for cooldown) */
let lastMotionTimestamp = 0;

/** Whether detection is currently running */
let isRunning = false;

/** The interval timer ID */
let intervalId: ReturnType<typeof setInterval> | null = null;

/** Whether a frame is currently being analyzed (prevent overlap) */
let isAnalyzing = false;

/**
 * Extracts a rough luminance fingerprint from base64-encoded image data.
 * Samples bytes at regular intervals for a fast approximation.
 */
const extractLuminanceSamples = (base64: string, sampleCount = 256): number[] => {
  const samples: number[] = [];
  // Skip the first ~100 chars (JPEG/PNG header metadata) to get to actual image data
  const startOffset = Math.min(100, Math.floor(base64.length * 0.05));
  const usableLength = base64.length - startOffset;
  const step = Math.max(1, Math.floor(usableLength / sampleCount));

  for (let i = startOffset; i < base64.length && samples.length < sampleCount; i += step) {
    samples.push(base64.charCodeAt(i));
  }
  return samples;
};

/**
 * Computes the normalized difference between two sample arrays.
 * Returns value between 0 (identical) and 1 (completely different).
 */
const computeDifference = (a: number[], b: number[]): number => {
  if (a.length === 0 || b.length === 0) return 0;
  const len = Math.min(a.length, b.length);
  let totalDiff = 0;

  for (let i = 0; i < len; i++) {
    totalDiff += Math.abs(a[i] - b[i]);
  }

  // Normalize: max possible diff per sample is ~64 (base64 charset range ~48-122)
  return totalDiff / (len * 64);
};

/**
 * Takes a single snapshot and compares it against the previous frame.
 */
export const analyzeFrame = async (
  cameraRef: RefObject<CameraView>,
  sensitivity: 'low' | 'medium' | 'high'
): Promise<{ motionDetected: boolean; score: number }> => {
  // Prevent overlapping analysis
  if (isAnalyzing) {
    return { motionDetected: false, score: 0 };
  }
  isAnalyzing = true;

  try {
    if (!cameraRef.current) {
      console.log('[Motion] Camera ref is null, skipping');
      return { motionDetected: false, score: 0 };
    }

    // Capture a low-quality snapshot with base64 data directly
    const photo = await cameraRef.current.takePictureAsync({
      quality: 0.1,
      base64: true,
    });

    if (!photo?.base64) {
      console.log('[Motion] No base64 data in photo');
      return { motionDetected: false, score: 0 };
    }

    // Extract luminance samples from the base64 data
    const currentSamples = extractLuminanceSamples(photo.base64);

    if (!previousSamples) {
      // First frame — store as baseline
      previousSamples = currentSamples;
      console.log('[Motion] Baseline frame captured');
      return { motionDetected: false, score: 0 };
    }

    // Compare frames
    const score = computeDifference(currentSamples, previousSamples);
    const threshold = SENSITIVITY_THRESHOLDS[sensitivity];
    const motionDetected = score > threshold;

    // Update baseline
    previousSamples = currentSamples;

    if (motionDetected) {
      console.log(`[Motion] 🚨 DETECTED! Score: ${score.toFixed(4)} > threshold: ${threshold}`);
    }

    return { motionDetected, score };
  } catch (error: any) {
    console.warn('[Motion] Analysis error:', error?.message || error);
    return { motionDetected: false, score: 0 };
  } finally {
    isAnalyzing = false;
  }
};

/**
 * Starts continuous motion detection.
 *
 * @param cameraRef - Reference to the CameraView
 * @param sensitivity - Detection sensitivity level
 * @param onMotion - Callback when motion is detected
 * @param intervalMs - Milliseconds between checks (default 2500ms)
 */
export const startMotionDetection = (
  cameraRef: RefObject<CameraView>,
  sensitivity: 'low' | 'medium' | 'high',
  onMotion: (score: number) => void,
  intervalMs: number = 2500
) => {
  if (isRunning) {
    stopMotionDetection();
  }

  isRunning = true;
  isAnalyzing = false;
  previousSamples = null;
  lastMotionTimestamp = 0;

  console.log(`[Motion] ✅ Started detection (sensitivity: ${sensitivity}, interval: ${intervalMs}ms)`);

  intervalId = setInterval(async () => {
    if (!isRunning) return;

    const { motionDetected, score } = await analyzeFrame(cameraRef, sensitivity);

    if (motionDetected) {
      const now = Date.now();
      // Respect cooldown to avoid spamming
      if (now - lastMotionTimestamp > DETECTION.COOLDOWN_MS) {
        lastMotionTimestamp = now;
        onMotion(score);
      } else {
        console.log(`[Motion] Cooldown active, skipping (${((DETECTION.COOLDOWN_MS - (now - lastMotionTimestamp)) / 1000).toFixed(0)}s remaining)`);
      }
    }
  }, intervalMs);
};

/**
 * Stops continuous motion detection.
 */
export const stopMotionDetection = () => {
  isRunning = false;
  isAnalyzing = false;
  previousSamples = null;

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  console.log('[Motion] ⏹ Stopped');
};

/**
 * Resets the baseline frame (useful when switching cameras).
 */
export const resetBaseline = () => {
  previousSamples = null;
  console.log('[Motion] Baseline reset');
};
