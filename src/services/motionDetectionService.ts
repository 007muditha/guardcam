import { RefObject } from 'react';
import { SENSITIVITY_THRESHOLDS } from '../types';
import { DETECTION } from '../utils/constants';

/**
 * Motion Detection Service — v3.2 (Debug + Block-Averaged)
 */

const GRID_BLOCKS = 48;
const REQUIRED_CONSECUTIVE_FRAMES = 2;

let baselineFingerprint: number[] | null = null;
let lastMotionTimestamp = 0;
let isRunning = false;
let intervalId: ReturnType<typeof setInterval> | null = null;
let isAnalyzing = false;
let consecutiveMotionFrames = 0;

/** Latest score for debug display */
let latestScore = 0;
let frameCount = 0;

/** Get latest debug info */
export const getDebugInfo = () => ({
  score: latestScore,
  frameCount,
  isRunning,
  hasBaseline: baselineFingerprint !== null,
  consecutiveFrames: consecutiveMotionFrames,
});

const computeBlockFingerprint = (base64: string): number[] => {
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

const computeBlockDifference = (a: number[], b: number[]): number => {
  if (a.length === 0 || b.length === 0) return 0;
  const len = Math.min(a.length, b.length);
  let totalDiff = 0;

  for (let i = 0; i < len; i++) {
    totalDiff += Math.abs(a[i] - b[i]);
  }

  return totalDiff / (len * 30);
};

export const analyzeFrame = async (
  cameraRef: RefObject<any>,
  sensitivity: 'low' | 'medium' | 'high'
): Promise<{ motionDetected: boolean; score: number }> => {
  if (isAnalyzing) {
    console.log('[Motion] ⏳ Still analyzing previous frame, skipping');
    return { motionDetected: false, score: latestScore };
  }
  isAnalyzing = true;

  try {
    if (!cameraRef.current) {
      console.log('[Motion] ❌ Camera ref is NULL');
      return { motionDetected: false, score: 0 };
    }

    console.log('[Motion] 📸 Taking snapshot...');
    const photo = await cameraRef.current.takePictureAsync({
      quality: 0.1,
      base64: true,
    });

    if (!photo?.base64) {
      console.log('[Motion] ❌ No base64 data returned from camera');
      return { motionDetected: false, score: 0 };
    }

    console.log(`[Motion] 📊 Photo base64 length: ${photo.base64.length}`);

    const currentFingerprint = computeBlockFingerprint(photo.base64);

    if (currentFingerprint.length === 0) {
      console.log('[Motion] ❌ Fingerprint is empty (image too small)');
      return { motionDetected: false, score: 0 };
    }

    frameCount++;

    if (!baselineFingerprint) {
      baselineFingerprint = currentFingerprint;
      consecutiveMotionFrames = 0;
      console.log(`[Motion] ✅ Baseline set (frame #${frameCount}, ${currentFingerprint.length} blocks)`);
      return { motionDetected: false, score: 0 };
    }

    const score = computeBlockDifference(currentFingerprint, baselineFingerprint);
    latestScore = score;
    const threshold = SENSITIVITY_THRESHOLDS[sensitivity];
    const frameExceedsThreshold = score > threshold;

    // LOG EVERY FRAME for debugging
    console.log(`[Motion] Frame #${frameCount} | Score: ${score.toFixed(4)} | Threshold: ${threshold} | ${frameExceedsThreshold ? '⚠️ ABOVE' : '✅ below'} | Consecutive: ${consecutiveMotionFrames}`);

    if (frameExceedsThreshold) {
      consecutiveMotionFrames++;
    } else {
      consecutiveMotionFrames = 0;
    }

    const motionDetected = consecutiveMotionFrames >= REQUIRED_CONSECUTIVE_FRAMES;

    if (motionDetected) {
      console.log(`[Motion] 🚨🚨🚨 MOTION CONFIRMED! Score: ${score.toFixed(4)}`);
      baselineFingerprint = currentFingerprint;
      consecutiveMotionFrames = 0;
    } else if (!frameExceedsThreshold) {
      baselineFingerprint = baselineFingerprint.map((prev, idx) => {
        const curr = currentFingerprint[idx] ?? prev;
        return prev * 0.85 + curr * 0.15;
      });
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
  baselineFingerprint = null;
  lastMotionTimestamp = 0;
  consecutiveMotionFrames = 0;
  frameCount = 0;
  latestScore = 0;

  console.log(`[Motion] ✅ STARTED v3.2 (sensitivity: ${sensitivity}, interval: ${intervalMs}ms)`);
  console.log(`[Motion] Thresholds: low=${SENSITIVITY_THRESHOLDS.low}, medium=${SENSITIVITY_THRESHOLDS.medium}, high=${SENSITIVITY_THRESHOLDS.high}`);

  intervalId = setInterval(async () => {
    if (!isRunning) return;

    const { motionDetected, score } = await analyzeFrame(cameraRef, sensitivity);

    if (motionDetected) {
      const now = Date.now();
      if (now - lastMotionTimestamp > DETECTION.COOLDOWN_MS) {
        lastMotionTimestamp = now;
        console.log(`[Motion] 📷 Triggering capture callback!`);
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
  baselineFingerprint = null;
  consecutiveMotionFrames = 0;

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  console.log('[Motion] ⏹ Stopped');
};

export const resetBaseline = () => {
  baselineFingerprint = null;
  consecutiveMotionFrames = 0;
  console.log('[Motion] Baseline reset');
};
