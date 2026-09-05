import * as FileSystem from 'expo-file-system/legacy';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GOOGLE_DRIVE, STORAGE_KEYS } from '../utils/constants';

// Complete auth session if returning from web browser
WebBrowser.maybeCompleteAuthSession();

/**
 * Google Drive Service — v2.0 (expo-auth-session with restricted drive.file scope)
 * 
 * Privacy Policy:
 *   Requests ONLY https://www.googleapis.com/auth/drive.file and userinfo.email.
 *   GuardCam CANNOT access, read, or see any of the user's existing files or folders.
 *   It can only access files and folders created by GuardCam.
 */

let _accessToken: string | null = null;
let _email: string | null = null;
let _folderId: string | null = null;
let _clientId: string | null = null;

// Default demo Web Client ID (can be overridden by user in Settings)
export const DEFAULT_CLIENT_ID = '1096752013890-guardcam.apps.googleusercontent.com';

/**
 * Initializes state from persistent AsyncStorage.
 */
export const initGoogleDrive = async (): Promise<{
  isSignedIn: boolean;
  email: string | null;
  folderId: string | null;
  clientId: string | null;
}> => {
  try {
    const [token, email, folder, storedClientId] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.GDRIVE_TOKEN),
      AsyncStorage.getItem(STORAGE_KEYS.GDRIVE_EMAIL),
      AsyncStorage.getItem(STORAGE_KEYS.GDRIVE_FOLDER_ID),
      AsyncStorage.getItem(STORAGE_KEYS.GDRIVE_CLIENT_ID),
    ]);

    _accessToken = token;
    _email = email;
    _folderId = folder;
    _clientId = storedClientId;

    return {
      isSignedIn: _accessToken !== null,
      email: _email,
      folderId: _folderId,
      clientId: _clientId,
    };
  } catch (error) {
    console.warn('[GDrive] Failed to initialize Google Drive state:', error);
    return { isSignedIn: false, email: null, folderId: null, clientId: null };
  }
};

/**
 * Returns the OAuth redirect URI for this app.
 */
export const getRedirectUri = (): string => {
  return AuthSession.makeRedirectUri({
    scheme: 'guardcam',
    path: 'oauthredirect',
  });
};

/**
 * Signs into Google Drive via OAuth 2.0 with restricted per-file access.
 */
export const signIn = async (customClientId?: string): Promise<{
  email: string;
  accessToken: string;
  folderId: string;
}> => {
  const activeClientId = customClientId || _clientId || (await AsyncStorage.getItem(STORAGE_KEYS.GDRIVE_CLIENT_ID));

  if (!activeClientId) {
    throw new Error('MISSING_CLIENT_ID');
  }

  const redirectUri = getRedirectUri();
  console.log('[GDrive] Starting OAuth flow with redirect URI:', redirectUri);

  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(activeClientId.trim())}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=token&` +
    `scope=${encodeURIComponent(GOOGLE_DRIVE.SCOPES.join(' '))}&` +
    `prompt=consent`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

  if (result.type !== 'success' || !result.url) {
    if (result.type === 'cancel' || result.type === 'dismiss') {
      throw new Error('USER_CANCELLED');
    }
    throw new Error(`Authentication failed: ${result.type}`);
  }

  // Parse access token from URL hash/query
  const urlParts = result.url.split('#');
  const fragment = urlParts[1] || result.url.split('?')[1] || '';
  const params = new URLSearchParams(fragment);
  const token = params.get('access_token');

  if (!token) {
    const errorMsg = params.get('error') || 'No access token received from Google';
    throw new Error(errorMsg);
  }

  _accessToken = token;
  await AsyncStorage.setItem(STORAGE_KEYS.GDRIVE_TOKEN, token);

  // Fetch connected user email for UI display
  let userEmail = 'Connected Account';
  try {
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (userRes.ok) {
      const userData = await userRes.json();
      userEmail = userData.email || userEmail;
    }
  } catch (e) {
    console.warn('[GDrive] Could not fetch user profile:', e);
  }

  _email = userEmail;
  await AsyncStorage.setItem(STORAGE_KEYS.GDRIVE_EMAIL, userEmail);

  // Get or create dedicated GuardCam_Footage folder
  const folderId = await getOrCreateFolder('GuardCam_Footage', token);
  _folderId = folderId;
  await AsyncStorage.setItem(STORAGE_KEYS.GDRIVE_FOLDER_ID, folderId);

  console.log('[GDrive] ✅ Successfully signed in:', userEmail, 'Folder:', folderId);
  return { email: userEmail, accessToken: token, folderId };
};

/**
 * Signs out and clears stored credentials.
 */
export const signOut = async (): Promise<void> => {
  _accessToken = null;
  _email = null;
  _folderId = null;

  await Promise.all([
    AsyncStorage.removeItem(STORAGE_KEYS.GDRIVE_TOKEN),
    AsyncStorage.removeItem(STORAGE_KEYS.GDRIVE_EMAIL),
    AsyncStorage.removeItem(STORAGE_KEYS.GDRIVE_FOLDER_ID),
  ]);

  console.log('[GDrive] Signed out and cleared credentials');
};

export const isSignedIn = async (): Promise<boolean> => {
  if (_accessToken) return true;
  const token = await AsyncStorage.getItem(STORAGE_KEYS.GDRIVE_TOKEN);
  return token !== null;
};

export const getAccessToken = async (): Promise<string | null> => {
  if (_accessToken) return _accessToken;
  return AsyncStorage.getItem(STORAGE_KEYS.GDRIVE_TOKEN);
};

export const getConnectedEmail = (): string | null => _email;
export const getFolderId = (): string | null => _folderId;

export const saveClientId = async (clientId: string): Promise<void> => {
  _clientId = clientId.trim();
  await AsyncStorage.setItem(STORAGE_KEYS.GDRIVE_CLIENT_ID, _clientId);
};

export const getStoredClientId = async (): Promise<string | null> => {
  if (_clientId) return _clientId;
  _clientId = await AsyncStorage.getItem(STORAGE_KEYS.GDRIVE_CLIENT_ID);
  return _clientId;
};

/**
 * Gets or creates the dedicated GuardCam folder.
 */
export const getOrCreateFolder = async (folderName: string, accessToken: string): Promise<string> => {
  try {
    const query = `name='${folderName}' and mimeType='${GOOGLE_DRIVE.FOLDER_MIME_TYPE}' and trashed=false`;
    const searchRes = await fetch(`${GOOGLE_DRIVE.QUERY_URL}?q=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }

    // Create folder
    const createRes = await fetch(GOOGLE_DRIVE.QUERY_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: GOOGLE_DRIVE.FOLDER_MIME_TYPE,
      }),
    });

    const createData = await createRes.json();
    return createData.id;
  } catch (error) {
    console.error('[GDrive] Failed to get/create folder:', error);
    throw error;
  }
};

/**
 * Uploads a photo or video to the GuardCam_Footage folder.
 */
export const uploadFile = async (
  filePath: string,
  fileName: string,
  mimeType: string,
  folderId: string,
  accessToken: string
): Promise<{ fileId: string; webViewLink: string }> => {
  try {
    const fileContent = await FileSystem.readAsStringAsync(filePath, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const metadata = {
      name: fileName,
      parents: [folderId],
    };

    const boundary = 'guardcam_upload_boundary';
    const body =
      `\r\n--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${mimeType}\r\n` +
      `Content-Transfer-Encoding: base64\r\n\r\n` +
      `${fileContent}\r\n` +
      `--${boundary}--`;

    const res = await fetch(GOOGLE_DRIVE.UPLOAD_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': body.length.toString(),
      },
      body,
    });

    const data = await res.json();
    if (!res.ok || !data.id) {
      throw new Error(data.error?.message || 'Upload failed');
    }

    // Fetch view link
    let webViewLink = `https://drive.google.com/file/d/${data.id}/view`;
    try {
      const detailsRes = await fetch(`${GOOGLE_DRIVE.QUERY_URL}/${data.id}?fields=webViewLink`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (detailsRes.ok) {
        const detailsData = await detailsRes.json();
        if (detailsData.webViewLink) webViewLink = detailsData.webViewLink;
      }
    } catch {
      // Use fallback view URL
    }

    console.log('[GDrive] ✅ Uploaded file:', fileName, 'ID:', data.id);
    return {
      fileId: data.id,
      webViewLink,
    };
  } catch (error) {
    console.error('[GDrive] Failed to upload file to Google Drive:', error);
    throw error;
  }
};
