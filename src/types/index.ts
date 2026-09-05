export interface MotionEvent {
  id: string;
  timestamp: number;
  type: 'person' | 'motion';
  hasPhoto: boolean;
  hasVideo?: boolean;
  isBurst?: boolean;
  burstCount?: number;
  burstUris?: string[];
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
  captureMode: 'single' | 'burst';
  burstDuration: number;
  burstIntervalMs: number;
  cameraPosition: 'front' | 'back';
  showStealthIndicator: boolean;
  saveToGallery: boolean;
  googleDriveEnabled: boolean;
  googleDriveFolderId?: string;
  // Backwards compatibility
  recordVideo?: boolean;
  videoDuration?: number;
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
