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

// Calibrated for block-averaged grid comparison (v3.1)
// With 48 blocks and normalization divisor of 30:
//   JPEG noise floor: ~0.01-0.04
//   Real motion:      ~0.08-0.25+
export const SENSITIVITY_THRESHOLDS = {
  low: 0.12,     // Only large/obvious motion
  medium: 0.07,  // Moderate motion (person crossing room)
  high: 0.045,   // Sensitive (detects subtle movement)
};
