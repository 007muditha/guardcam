import { RefObject } from 'react';
import * as ImageManipulator from 'expo-image-manipulator';
import { SENSITIVITY_THRESHOLDS } from '../types';
import { DETECTION } from '../utils/constants';

/**
 * Motion Detection Service — v5.1 (Instant Single-Frame Trigger)
 *
 * Analysis of real test logs:
 *   - Static scene noise floor: 0.055 - 0.062 (rock solid, predictable).
 *   - Movement score: 0.2159 - 0.2250+ (clear, massive spike!).
 *
 * Why v5 didn't capture when moving camera:
 *   REQUIRED_CONSECUTIVE_FRAMES was set to 2. A 3-second interval meant motion
 *   had to span 6 full seconds across 2 consecutive checks. Frame 6 spiked to 0.2159,
 *   but Frame 7 landed on 0.0556, resetting the consecutive counter!
 *
 * v5.1 Fix:
 *   1. Set REQUIRED_CONSECUTIVE_FRAMES = 1 for instant response on the very first motion frame.
 *   2. Set thresholds above the 0.062 static noise floor (medium = 0.10) to guarantee 0 false positives.
 */

const THUMBNAIL_WIDTH = 20;
const THUMBNAIL_HEIGHT = 15;
const REQUIRED_CONSECUTIVE_FRAMES = 1;

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
 * Computes normalized mathematical difference between two thumbnail base64 strings.
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

    if (!previousThumbnail) {
      previousThumbnail = currentThumbnail;
      consecutiveMotionFrames = 0;
      console.log(`[Motion] ✅ Initial baseline set (frame #${frameCount}, len: ${currentThumbnail.length})`);
      return { motionDetected: false, score: 0 };
    }

    const score = computeNormalizedDiff(currentThumbnail, previousThumbnail);
    latestScore = score;

    // Always update baseline to current frame for sequential comparison
    previousThumbnail = currentThumbnail;

    const threshold = SENSITIVITY_THRESHOLDS[sensitivity];
    const frameExceedsThreshold = score > threshold;

    console.log(`[Motion] Frame #${frameCount} | Score: ${score.toFixed(4)} | Threshold: ${threshold} | ${frameExceedsThreshold ? '⚠️ ABOVE' : '✅ below'}`);

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

  console.log(`[Motion] ✅ STARTED v5.1 Instant (sensitivity: ${sensitivity}, interval: ${intervalMs}ms)`);

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
