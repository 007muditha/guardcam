export const COLORS = {
  BACKGROUND: '#0A0A0F',
  SURFACE: '#12121A',
  CARD: '#1A1A2E',
  PRIMARY: '#00FF88',
  WARNING: '#FFB800',
  DANGER: '#FF3366',
  TEXT: '#FFFFFF',
  TEXT_SECONDARY: '#8888AA',
  TEXT_DIM: '#555577',
  OVERLAY: 'rgba(0,0,0,0.95)',
  GLASS: 'rgba(26,26,46,0.8)',
  BORDER: 'rgba(255,255,255,0.08)'
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32
};

export const DETECTION = {
  FRAME_SKIP: 3,
  DOWNSCALE_WIDTH: 320,
  DOWNSCALE_HEIGHT: 180,
  PERSON_CONFIDENCE_THRESHOLD: 0.5,
  COOLDOWN_MS: 5000,
  VIDEO_DEFAULT_DURATION: 15
};

export const STEALTH = {
  MIN_BRIGHTNESS: 0.01,
  CONTROLS_AUTO_HIDE_MS: 5000
};

export const STORAGE_KEYS = {
  EVENTS: '@guardcam_events',
  SETTINGS: '@guardcam_settings',
  GDRIVE_TOKEN: '@guardcam_gdrive_token',
  GDRIVE_EMAIL: '@guardcam_gdrive_email',
  GDRIVE_FOLDER_ID: '@guardcam_gdrive_folder_id',
  GDRIVE_CLIENT_ID: '@guardcam_gdrive_client_id',
};

export const GOOGLE_DRIVE = {
  SCOPES: [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
  UPLOAD_URL: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
  QUERY_URL: 'https://www.googleapis.com/drive/v3/files',
  FOLDER_MIME_TYPE: 'application/vnd.google-apps.folder',
};

export const ADMOB = {
  APP_ID_IOS: 'ca-app-pub-3016089881840447~6601316334',
  BANNER_ID_IOS: 'ca-app-pub-3016089881840447/7722826310',
  TEST_BANNER_ID: 'ca-app-pub-3940256099942544/6300978111',
};
