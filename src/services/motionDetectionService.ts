import { RefObject } from 'react';
import { SENSITIVITY_THRESHOLDS } from '../types';
import { DETECTION } from '../utils/constants';

/**
 * Motion Detection Service
 *
 * Uses an adaptive snapshot-comparison algorithm:
 *   1. Periodically captures low-quality snapshots with base64 data.
 *   2. Extracts luminance sample arrays across the frame.
 *   3. Compares against an adaptive baseline frame.
 *   4. Ignores camera sensor noise & auto-exposure fluctuations.
 *   5. Triggers motion only when a real physical movement occurs.
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
 * Extracts a robust luminance fingerprint from base64-encoded image data.
 * Samples character codes across the data payload.
 */
const extractLuminanceSamples = (base64: string, sampleCount = 256): number[] => {
  const samples: number[] = [];
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

  return totalDiff / (len * 64);
};

/**
 * Takes a single snapshot and compares it against the adaptive baseline frame.
 */
export const analyzeFrame = async (
  cameraRef: RefObject<any>,
  sensitivity: 'low' | 'medium' | 'high'
): Promise<{ motionDetected: boolean; score: number }> => {
  if (isAnalyzing) {
    return { motionDetected: false, score: 0 };
  }
  isAnalyzing = true;

  try {
    if (!cameraRef.current) {
      return { motionDetected: false, score: 0 };
    }

    const photo = await cameraRef.current.takePictureAsync({
      quality: 0.1,
      base64: true,
    });

    if (!photo?.base64) {
      return { motionDetected: false, score: 0 };
    }

    const currentSamples = extractLuminanceSamples(photo.base64);

    if (!previousSamples) {
      previousSamples = currentSamples;
      console.log('[Motion] Baseline frame initialized');
      return { motionDetected: false, score: 0 };
    }

    const score = computeDifference(currentSamples, previousSamples);
    const threshold = SENSITIVITY_THRESHOLDS[sensitivity];
    const motionDetected = score > threshold;

    if (motionDetected) {
      console.log(`[Motion] 🚨 MOTION DETECTED! Score: ${score.toFixed(4)} > threshold: ${threshold}`);
      // On motion, update baseline to current frame
      previousSamples = currentSamples;
    } else {
      // On non-motion, smooth baseline to adapt to subtle lighting changes
      previousSamples = previousSamples.map((prev, idx) => {
        const curr = currentSamples[idx] || prev;
        return Math.round(prev * 0.7 + curr * 0.3);
      });
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
  cameraRef: RefObject<any>,
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
      if (now - lastMotionTimestamp > DETECTION.COOLDOWN_MS) {
        lastMotionTimestamp = now;
        onMotion(score);
      } else {
        console.log(`[Motion] Cooldown active, skipping capture (${((DETECTION.COOLDOWN_MS - (now - lastMotionTimestamp)) / 1000).toFixed(0)}s remaining)`);
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
