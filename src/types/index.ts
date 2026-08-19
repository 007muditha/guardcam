export interface MotionEvent {
  id: string;
  timestamp: number;
  type: 'person' | 'motion';
  hasPhoto: boolean;
  hasVideo: boolean;
  photoUri?: string;
  videoUri?: string;
  uploaded: boolean;
  uploadedAt?: number;
}

export interface CCTVSession {
  isActive: boolean;
  startedAt?: number;
  motionCount: number;
  lastMotionAt?: number;
  cameraPosition: 'front' | 'back';
}

export interface AppSettings {
  sensitivity: 'low' | 'medium' | 'high';
  captureMode: 'photo' | 'video' | 'both';
  cameraPosition: 'front' | 'back';
  showStealthIndicator: boolean;
  videoDuration: number;
  saveToGallery: boolean;
  googleDriveEnabled: boolean;
  googleDriveFolderId?: string;
}

export interface StorageStatus {
  available: boolean;
  usedBytes: number;
  freeBytes: number;
}

// Calibrated for v4 thumbnail comparison (16x12 pixel thumbnails)
// At 16x12, sensor noise is eliminated by downscaling.
// Static scene: ~0.01-0.05 | Real motion: ~0.15-0.60+
export const SENSITIVITY_THRESHOLDS = {
  low: 0.20,     // Only large/obvious motion
  medium: 0.12,  // Moderate motion (person crossing room)
  high: 0.07,    // Sensitive (detects subtle movement)
};
