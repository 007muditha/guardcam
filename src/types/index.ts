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
// Static scene:  0.055 - 0.062 (always below 0.072 -> 0 false positives!)
// Normal motion: 0.075 - 0.120+ (triggers photo capture!)
// Big motion:    0.150 - 0.500+ (triggers photo capture!)
export const SENSITIVITY_THRESHOLDS = {
  low: 0.10,      // Requires moderate/large motion
  medium: 0.072,  // Normal sensitivity (detects hand wave / walking)
  high: 0.065,    // Very sensitive (detects slight movement)
};
