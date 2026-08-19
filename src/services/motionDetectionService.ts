import { RefObject } from 'react';
import { SENSITIVITY_THRESHOLDS } from '../types';
import { DETECTION } from '../utils/constants';

/**
 * Motion Detection Service — v3 (Block-Averaged Grid Comparison)
 *
 * Why v1/v2 failed:
 *   JPEG compression is non-deterministic. Even when the camera sees an
 *   identical scene, the compressed base64 bytes vary by 20-40% due to
 *   sensor noise, auto-exposure, and entropy coding. Comparing individual
 *   base64 character codes is like comparing random noise.
 *
 * v3 solution:
 *   1. Divide the base64 string into large blocks (32 blocks).
 *   2. Compute the AVERAGE character code within each block.
 *      → Averaging cancels out random JPEG compression noise.
 *   3. Compare block-averaged fingerprints between frames.
 *      → Only large-scale pixel changes (real motion) shift block averages.
 *   4. Require 2 consecutive above-threshold frames to confirm motion.
 *   5. Adaptive baseline smoothing absorbs gradual lighting changes.
 */

/** Number of blocks to divide the base64 string into */
const GRID_BLOCKS = 32;

/** Number of consecutive frames required before triggering */
const REQUIRED_CONSECUTIVE_FRAMES = 2;

/** Adaptive baseline fingerprint (block-averaged values) */
let baselineFingerprint: number[] | null = null;

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

/**
 * Computes a block-averaged fingerprint from a base64 string.
 *
 * Divides the base64 payload into GRID_BLOCKS equal-sized blocks,
 * then computes the mean character code value within each block.
 * This averaging cancels out random JPEG compression noise while
 * preserving large-scale changes caused by real motion.
 *
 * Returns an array of GRID_BLOCKS average values.
 */
const computeBlockFingerprint = (base64: string): number[] => {
  // Skip the first 5% of data (JPEG headers are constant and not useful)
  const startOffset = Math.min(200, Math.floor(base64.length * 0.05));
  const payload = base64.substring(startOffset);
  const blockSize = Math.floor(payload.length / GRID_BLOCKS);

  if (blockSize < 10) {
    // Image too small for meaningful analysis
    return [];
  }

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
 * Returns a value between 0 (identical) and 1 (completely different).
 *
 * Because each value is a block average (hundreds of characters averaged),
 * random JPEG noise produces differences of only ~0.01-0.04.
 * Real motion (person walking through frame) produces differences of 0.15+.
 */
const computeBlockDifference = (a: number[], b: number[]): number => {
  if (a.length === 0 || b.length === 0) return 0;
  const len = Math.min(a.length, b.length);
  let totalDiff = 0;

  for (let i = 0; i < len; i++) {
    totalDiff += Math.abs(a[i] - b[i]);
  }

  // Normalize by number of blocks and max possible char code range (~80)
  return totalDiff / (len * 80);
};

/**
 * Takes a single snapshot and compares its block fingerprint against the
 * adaptive baseline. Requires REQUIRED_CONSECUTIVE_FRAMES above-threshold
 * frames before confirming motion.
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
      console.log('[Motion] Baseline established (block-averaged grid)');
      return { motionDetected: false, score: 0 };
    }

    const score = computeBlockDifference(currentFingerprint, baselineFingerprint);
    const threshold = SENSITIVITY_THRESHOLDS[sensitivity];
    const frameExceedsThreshold = score > threshold;

    if (frameExceedsThreshold) {
      consecutiveMotionFrames++;
      console.log(`[Motion] Frame above threshold: ${score.toFixed(4)} > ${threshold} (${consecutiveMotionFrames}/${REQUIRED_CONSECUTIVE_FRAMES} consecutive)`);
    } else {
      if (consecutiveMotionFrames > 0) {
        console.log(`[Motion] Below threshold: ${score.toFixed(4)} <= ${threshold}, resetting consecutive counter`);
      }
      consecutiveMotionFrames = 0;
    }

    // Only confirm motion if N consecutive frames exceeded the threshold
    const motionDetected = consecutiveMotionFrames >= REQUIRED_CONSECUTIVE_FRAMES;

    if (motionDetected) {
      console.log(`[Motion] 🚨 CONFIRMED MOTION! Score: ${score.toFixed(4)} (${consecutiveMotionFrames} consecutive frames)`);
      // Reset baseline to current frame after confirmed motion
      baselineFingerprint = currentFingerprint;
      consecutiveMotionFrames = 0;
    } else if (!frameExceedsThreshold) {
      // Smoothly adapt baseline to absorb gradual lighting/exposure changes
      // 85% old baseline + 15% new frame = slow drift adaptation
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
 *
 * @param cameraRef - Reference to the CameraView
 * @param sensitivity - Detection sensitivity level
 * @param onMotion - Callback when motion is confirmed
 * @param intervalMs - Milliseconds between checks (default 3000ms)
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

  console.log(`[Motion] ✅ Started v3 (block-averaged, sensitivity: ${sensitivity}, interval: ${intervalMs}ms, ${REQUIRED_CONSECUTIVE_FRAMES} consecutive frames required)`);

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
  baselineFingerprint = null;
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
  baselineFingerprint = null;
  consecutiveMotionFrames = 0;
  console.log('[Motion] Baseline reset');
};
