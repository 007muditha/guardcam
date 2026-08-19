import { RefObject } from 'react';
import { SENSITIVITY_THRESHOLDS } from '../types';
import { DETECTION } from '../utils/constants';

/**
 * Motion Detection Service — v2 (Adaptive + Consecutive Frame Confirmation)
 *
 * Key improvements over v1:
 *   1. Requires 2 CONSECUTIVE frames to exceed the threshold before triggering.
 *      This eliminates single-frame JPEG compression noise false positives.
 *   2. Uses adaptive baseline smoothing (exponential moving average) so gradual
 *      lighting changes and camera auto-exposure adjustments don't trigger motion.
 *   3. Higher sensitivity thresholds calibrated to real-world base64 noise floor.
 */

/** Adaptive baseline luminance samples */
let baselineSamples: number[] | null = null;

/** Timestamp of the last motion trigger (for cooldown) */
let lastMotionTimestamp = 0;

/** Whether detection is currently running */
let isRunning = false;

/** The interval timer ID */
let intervalId: ReturnType<typeof setInterval> | null = null;

/** Whether a frame is currently being analyzed (prevent overlap) */
let isAnalyzing = false;

/** Count of consecutive frames that exceeded the motion threshold */
let consecutiveMotionFrames = 0;

/** Number of consecutive frames required before triggering motion */
const REQUIRED_CONSECUTIVE_FRAMES = 2;

/**
 * Extracts a robust luminance fingerprint from base64-encoded image data.
 * Samples character codes at evenly spaced intervals across the payload.
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
 * Takes a single snapshot and compares it against the adaptive baseline.
 * Returns motionDetected=true only after REQUIRED_CONSECUTIVE_FRAMES
 * frames in a row exceed the threshold.
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

    // First frame: establish baseline
    if (!baselineSamples) {
      baselineSamples = currentSamples;
      consecutiveMotionFrames = 0;
      console.log('[Motion] Baseline frame initialized');
      return { motionDetected: false, score: 0 };
    }

    const score = computeDifference(currentSamples, baselineSamples);
    const threshold = SENSITIVITY_THRESHOLDS[sensitivity];
    const frameExceedsThreshold = score > threshold;

    if (frameExceedsThreshold) {
      consecutiveMotionFrames++;
    } else {
      // Reset consecutive counter on any non-motion frame
      consecutiveMotionFrames = 0;
    }

    // Only confirm motion if N consecutive frames exceeded the threshold
    const motionDetected = consecutiveMotionFrames >= REQUIRED_CONSECUTIVE_FRAMES;

    if (motionDetected) {
      console.log(`[Motion] 🚨 CONFIRMED! Score: ${score.toFixed(4)} > ${threshold} (${consecutiveMotionFrames} consecutive frames)`);
      // Reset baseline to current frame after confirmed motion
      baselineSamples = currentSamples;
      consecutiveMotionFrames = 0;
    } else {
      // Smoothly adapt baseline to gradual lighting/auto-exposure changes
      // This prevents slow environmental changes from accumulating into false triggers
      baselineSamples = baselineSamples.map((prev, idx) => {
        const curr = currentSamples[idx] || prev;
        return Math.round(prev * 0.8 + curr * 0.2);
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
 * @param onMotion - Callback when motion is confirmed
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
  baselineSamples = null;
  lastMotionTimestamp = 0;
  consecutiveMotionFrames = 0;

  console.log(`[Motion] ✅ Started (sensitivity: ${sensitivity}, interval: ${intervalMs}ms, requires ${REQUIRED_CONSECUTIVE_FRAMES} consecutive frames)`);

  intervalId = setInterval(async () => {
    if (!isRunning) return;

    const { motionDetected, score } = await analyzeFrame(cameraRef, sensitivity);

    if (motionDetected) {
      const now = Date.now();
      if (now - lastMotionTimestamp > DETECTION.COOLDOWN_MS) {
        lastMotionTimestamp = now;
        onMotion(score);
      } else {
        console.log(`[Motion] Cooldown active (${((DETECTION.COOLDOWN_MS - (now - lastMotionTimestamp)) / 1000).toFixed(0)}s remaining)`);
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
  baselineSamples = null;
  consecutiveMotionFrames = 0;

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
  baselineSamples = null;
  consecutiveMotionFrames = 0;
  console.log('[Motion] Baseline reset');
};
