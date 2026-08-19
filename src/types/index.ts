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

// Calibrated for v5 sequential frame-to-frame comparison
// Static scene: ~0.01 - 0.04 | Real motion: ~0.15 - 0.50+
export const SENSITIVITY_THRESHOLDS = {
  low: 0.15,     // Only large/obvious motion
  medium: 0.08,  // Moderate motion (person crossing room)
  high: 0.045,   // Sensitive (detects subtle movement)
};
