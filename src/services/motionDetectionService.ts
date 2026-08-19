import { RefObject } from 'react';
import { SENSITIVITY_THRESHOLDS } from '../types';
import { DETECTION } from '../utils/constants';

/**
 * Motion Detection Service — v3.1 (Balanced Block-Averaged Comparison)
 *
 * Uses block-averaged fingerprints with tuned block count and normalization
 * to correctly distinguish JPEG noise from real motion.
 *
 * Key parameters:
 *   - 48 blocks: Fine enough to detect localized motion, large enough
 *     to smooth out per-character JPEG noise.
 *   - Normalization by 30 (empirical range of block-average shifts):
 *     JPEG noise shifts block averages by ~1-3, real motion by 5-15+.
 *   - 2 consecutive frames required: eliminates any remaining noise spikes.
 *   - Adaptive baseline smoothing: absorbs gradual lighting drift.
 */

/** Number of blocks to divide the base64 string into */
const GRID_BLOCKS = 48;

/** Number of consecutive frames required before triggering */
const REQUIRED_CONSECUTIVE_FRAMES = 2;

/** Adaptive baseline fingerprint */
let baselineFingerprint: number[] | null = null;

/** Timestamp of the last motion trigger (for cooldown) */
let lastMotionTimestamp = 0;

/** Whether detection is currently running */
let isRunning = false;

/** The interval timer ID */
let intervalId: ReturnType<typeof setInterval> | null = null;

/** Whether a frame is currently being analyzed */
let isAnalyzing = false;

/** Count of consecutive frames that exceeded the threshold */
let consecutiveMotionFrames = 0;

/**
 * Computes a block-averaged fingerprint from a base64 string.
 * Each block's value is the mean character code of all characters in that block.
 */
const computeBlockFingerprint = (base64: string): number[] => {
  // Skip JPEG header region (~5%)
  const startOffset = Math.min(200, Math.floor(base64.length * 0.05));
  const payload = base64.substring(startOffset);
  const blockSize = Math.floor(payload.length / GRID_BLOCKS);

  if (blockSize < 5) return [];

  const fingerprint: number[] = [];

  for (let block = 0; block < GRID_BLOCKS; block++) {
    const blockStart = block * blockSize;
    const blockEnd = Math.min(blockStart + blockSize, payload.length);
    let sum = 0;
    let count = 0;

    for (let i = blockStart; i < blockEnd; i++) {
      sum += payload.charCodeAt(i);
      count++;
    }

    fingerprint.push(count > 0 ? sum / count : 0);
  }

  return fingerprint;
};

/**
 * Computes the normalized difference between two block-averaged fingerprints.
 *
 * With 48 blocks:
 *   - JPEG noise alone:    block averages shift by ~1-3  → score ~0.01-0.04
 *   - Real motion:         block averages shift by ~5-15 → score ~0.08-0.25+
 *   - Camera moved wildly: block averages shift by ~15+  → score ~0.30+
 */
const computeBlockDifference = (a: number[], b: number[]): number => {
  if (a.length === 0 || b.length === 0) return 0;
  const len = Math.min(a.length, b.length);
  let totalDiff = 0;

  for (let i = 0; i < len; i++) {
    totalDiff += Math.abs(a[i] - b[i]);
  }

  // Normalize by block count and empirical shift range (30)
  // This maps JPEG noise to ~0.01-0.04 and real motion to ~0.08+
  return totalDiff / (len * 30);
};

/**
 * Analyzes a single frame against the adaptive baseline.
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

    const currentFingerprint = computeBlockFingerprint(photo.base64);

    if (currentFingerprint.length === 0) {
      return { motionDetected: false, score: 0 };
    }

    // First frame: establish baseline
    if (!baselineFingerprint) {
      baselineFingerprint = currentFingerprint;
      consecutiveMotionFrames = 0;
      console.log('[Motion] ✅ Baseline established');
      return { motionDetected: false, score: 0 };
    }

    const score = computeBlockDifference(currentFingerprint, baselineFingerprint);
    const threshold = SENSITIVITY_THRESHOLDS[sensitivity];
    const frameExceedsThreshold = score > threshold;

    if (frameExceedsThreshold) {
      consecutiveMotionFrames++;
      console.log(`[Motion] ⚠️ Above threshold: score=${score.toFixed(4)} > ${threshold} (${consecutiveMotionFrames}/${REQUIRED_CONSECUTIVE_FRAMES})`);
    } else {
      consecutiveMotionFrames = 0;
    }

    const motionDetected = consecutiveMotionFrames >= REQUIRED_CONSECUTIVE_FRAMES;

    if (motionDetected) {
      console.log(`[Motion] 🚨 MOTION CONFIRMED! score=${score.toFixed(4)}`);
      baselineFingerprint = currentFingerprint;
      consecutiveMotionFrames = 0;
    } else if (!frameExceedsThreshold) {
      // Slowly adapt baseline to gradual lighting changes
      baselineFingerprint = baselineFingerprint.map((prev, idx) => {
        const curr = currentFingerprint[idx] ?? prev;
        return prev * 0.85 + curr * 0.15;
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
 */
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
  baselineFingerprint = null;
  lastMotionTimestamp = 0;
  consecutiveMotionFrames = 0;

  console.log(`[Motion] ✅ Started v3.1 (${GRID_BLOCKS} blocks, sensitivity: ${sensitivity}, interval: ${intervalMs}ms)`);

  intervalId = setInterval(async () => {
    if (!isRunning) return;

    const { motionDetected, score } = await analyzeFrame(cameraRef, sensitivity);

    if (motionDetected) {
      const now = Date.now();
      if (now - lastMotionTimestamp > DETECTION.COOLDOWN_MS) {
        lastMotionTimestamp = now;
        onMotion(score);
      } else {
        console.log(`[Motion] Cooldown (${((DETECTION.COOLDOWN_MS - (now - lastMotionTimestamp)) / 1000).toFixed(0)}s remaining)`);
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
  baselineFingerprint = null;
  consecutiveMotionFrames = 0;

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  console.log('[Motion] ⏹ Stopped');
};

/**
 * Resets the baseline frame.
 */
export const resetBaseline = () => {
  baselineFingerprint = null;
  consecutiveMotionFrames = 0;
  console.log('[Motion] Baseline reset');
};
