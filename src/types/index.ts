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

// Calibrated for v5.1 instant detection (static noise floor: 0.055 - 0.062)
// Static scene:  0.055 - 0.062 (always below medium 0.10 -> 0 false positives!)
// Real movement: 0.2150 - 0.2250+ (instantly triggers capture!)
export const SENSITIVITY_THRESHOLDS = {
  low: 0.15,     // Only large/obvious motion
  medium: 0.10,  // Balanced (safely above static noise floor)
  high: 0.08,    // High sensitivity
};
