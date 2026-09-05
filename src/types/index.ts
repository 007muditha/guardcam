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
  recordVideo: boolean;
  videoDuration: number;
  captureMode?: 'photo' | 'video' | 'both';
  cameraPosition: 'front' | 'back';
  showStealthIndicator: boolean;
  saveToGallery: boolean;
  googleDriveEnabled: boolean;
  googleDriveFolderId?: string;
}

export interface StorageStatus {
  available: boolean;
  usedBytes: number;
  freeBytes: number;
}

// Calibrated for pixelmatch: fraction of frame pixels that changed significantly
// High = 0.05 (5% of frame), Medium = 0.10 (10% of frame), Low = 0.20 (20% of frame)
export const SENSITIVITY_THRESHOLDS = {
  low: 0.20,
  medium: 0.10,
  high: 0.05,
};
