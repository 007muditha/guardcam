import { RefObject } from 'react';
import { CameraView } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { SENSITIVITY_THRESHOLDS } from '../types';
import { DETECTION } from '../utils/constants';

/**
 * Motion Detection Service
 *
 * Since Expo Go doesn't support native frame processors (react-native-vision-camera),
 * we use a snapshot-comparison approach:
 *   1. Periodically capture low-quality snapshots from CameraView
 *   2. Read the snapshot as base64
 *   3. Sample pixel luminance values from the JPEG data
 *   4. Compare with the previous frame's samples
 *   5. If the difference exceeds the sensitivity threshold → motion detected
 *
 * This is lightweight enough to run in JS without native frame processors.
 */

/** Stores the previous frame's luminance samples for comparison */
let previousSamples: number[] | null = null;

/** Timestamp of the last motion trigger (for cooldown) */
let lastMotionTimestamp = 0;

/** Whether detection is currently running */
let isRunning = false;

/** The interval timer ID */
let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Extracts a rough luminance fingerprint from a base64-encoded JPEG.
 *
 * We sample bytes at regular intervals from the raw base64 string.
 * This isn't pixel-accurate but is fast and gives a reliable signal
 * for detecting scene-wide changes (movement, lights on/off, etc.).
 *
 * @param base64 - Base64 encoded JPEG data
 * @param sampleCount - How many samples to take (default 200)
 * @returns Array of numeric luminance samples
 */
const extractLuminanceSamples = (base64: string, sampleCount = 200): number[] => {
  const samples: number[] = [];
  const step = Math.max(1, Math.floor(base64.length / sampleCount));

  for (let i = 0; i < base64.length && samples.length < sampleCount; i += step) {
    // charCodeAt gives us a numeric value from the base64 character
    samples.push(base64.charCodeAt(i));
  }
  return samples;
};

/**
 * Computes the normalized difference between two luminance sample arrays.
 *
 * @param a - Current frame samples
 * @param b - Previous frame samples
 * @returns Value between 0 (identical) and 1 (completely different)
 */
const computeDifference = (a: number[], b: number[]): number => {
  if (a.length === 0 || b.length === 0) return 0;
  const len = Math.min(a.length, b.length);
  let totalDiff = 0;

  for (let i = 0; i < len; i++) {
    totalDiff += Math.abs(a[i] - b[i]);
  }

  // Normalize: max possible diff per sample is ~64 (base64 charset range)
  return totalDiff / (len * 64);
};

/**
 * Takes a single low-quality snapshot and compares it against the previous frame.
 *
 * @param cameraRef - Reference to the CameraView component
 * @param sensitivity - 'low' | 'medium' | 'high'
 * @returns Object with `motionDetected` boolean and `score` (0–1)
 */
export const analyzeFrame = async (
  cameraRef: RefObject<CameraView>,
  sensitivity: 'low' | 'medium' | 'high'
): Promise<{ motionDetected: boolean; score: number }> => {
  try {
    if (!cameraRef.current) {
      return { motionDetected: false, score: 0 };
    }

    // Capture a tiny, low-quality snapshot (fast, minimal memory)
    const photo = await cameraRef.current.takePictureAsync({
      quality: 0.1,
      skipProcessing: true,
    });

    if (!photo?.uri) {
      return { motionDetected: false, score: 0 };
    }

    // Read the snapshot as base64
    const base64 = await FileSystem.readAsStringAsync(photo.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Clean up the temp snapshot file
    FileSystem.deleteAsync(photo.uri, { idempotent: true }).catch(() => {});

    // Extract luminance samples
    const currentSamples = extractLuminanceSamples(base64);

    if (!previousSamples) {
      // First frame — store as baseline, no motion
      previousSamples = currentSamples;
      return { motionDetected: false, score: 0 };
    }

    // Compare frames
    const score = computeDifference(currentSamples, previousSamples);
    const threshold = SENSITIVITY_THRESHOLDS[sensitivity];
    const motionDetected = score > threshold;

    // Update baseline
    previousSamples = currentSamples;

    return { motionDetected, score };
  } catch (error) {
    console.warn('Motion analysis error:', error);
    return { motionDetected: false, score: 0 };
  }
};

/**
 * Starts continuous motion detection.
 *
 * @param cameraRef - Reference to the CameraView
 * @param sensitivity - Detection sensitivity level
 * @param onMotion - Callback when motion is detected
 * @param intervalMs - Milliseconds between checks (default 2000 = 2s)
 */
export const startMotionDetection = (
  cameraRef: RefObject<CameraView>,
  sensitivity: 'low' | 'medium' | 'high',
  onMotion: (score: number) => void,
  intervalMs: number = 2000
) => {
  if (isRunning) {
    stopMotionDetection();
  }

  isRunning = true;
  previousSamples = null;
  lastMotionTimestamp = 0;

  console.log(`[MotionDetection] Started (sensitivity: ${sensitivity}, interval: ${intervalMs}ms)`);

  intervalId = setInterval(async () => {
    if (!isRunning) return;

    const { motionDetected, score } = await analyzeFrame(cameraRef, sensitivity);

    if (motionDetected) {
      const now = Date.now();
      // Respect cooldown to avoid spamming
      if (now - lastMotionTimestamp > DETECTION.COOLDOWN_MS) {
        lastMotionTimestamp = now;
        console.log(`[MotionDetection] 🚨 Motion detected! Score: ${score.toFixed(3)}`);
        onMotion(score);
      }
    }
  }, intervalMs);
};

/**
 * Stops continuous motion detection.
 */
export const stopMotionDetection = () => {
  isRunning = false;
  previousSamples = null;

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  console.log('[MotionDetection] Stopped');
};

/**
 * Resets the baseline frame (useful when switching cameras).
 */
export const resetBaseline = () => {
  previousSamples = null;
};
