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
  googleDriveEnabled: boolean;
  googleDriveFolderId?: string;
}

export interface StorageStatus {
  available: boolean;
  usedBytes: number;
  freeBytes: number;
}

export const SENSITIVITY_THRESHOLDS = {
  low: 0.15,
  medium: 0.08,
  high: 0.03,
};
