import * as FileSystem from 'expo-file-system';
import { GOOGLE_DRIVE } from '../utils/constants';

/**
 * Google Drive Service
 * 
 * Note: Google Sign-In requires a native build (not Expo Go).
 * These functions use placeholder implementations that can be
 * wired up when building with `npx expo run:ios` or EAS Build.
 */

let _accessToken: string | null = null;
let _email: string | null = null;

/**
 * Signs into Google Drive.
 * TODO: Integrate expo-auth-session for OAuth in Expo Go,
 * or use @react-native-google-signin in a native build.
 */
export const signIn = async (): Promise<{email: string, accessToken: string}> => {
  console.warn('Google Sign-In not available in Expo Go. Use a native build for full Drive integration.');
  throw new Error('Google Sign-In requires a native build');
};

/**
 * Signs out.
 */
export const signOut = async (): Promise<void> => {
  _accessToken = null;
  _email = null;
};

/**
 * Checks if user is signed in.
 */
export const isSignedIn = async (): Promise<boolean> => {
  return _accessToken !== null;
};

/**
 * Gets access token.
 */
export const getAccessToken = async (): Promise<string | null> => {
  return _accessToken;
};

/**
 * Gets or creates folder.
 */
export const getOrCreateFolder = async (folderName: string, accessToken: string): Promise<string> => {
  try {
    const query = `name='${folderName}' and mimeType='${GOOGLE_DRIVE.FOLDER_MIME_TYPE}' and trashed=false`;
    const searchRes = await fetch(`${GOOGLE_DRIVE.QUERY_URL}?q=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }
    
    const createRes = await fetch(GOOGLE_DRIVE.QUERY_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: GOOGLE_DRIVE.FOLDER_MIME_TYPE
      })
    });
    
    const createData = await createRes.json();
    return createData.id;
  } catch (error) {
    console.error('Failed to get/create Google Drive folder', error);
    throw error;
  }
};

/**
 * Uploads a file to Google Drive using expo-file-system.
 */
export const uploadFile = async (
  filePath: string,
  fileName: string,
  mimeType: string,
  folderId: string,
  accessToken: string
): Promise<{fileId: string, webViewLink: string}> => {
  try {
    const fileContent = await FileSystem.readAsStringAsync(filePath, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    const metadata = {
      name: fileName,
      parents: [folderId]
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
        'Content-Length': body.length.toString()
      },
      body: body
    });

    const data = await res.json();
    
    const detailsRes = await fetch(`${GOOGLE_DRIVE.QUERY_URL}/${data.id}?fields=webViewLink`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const detailsData = await detailsRes.json();

    return {
      fileId: data.id,
      webViewLink: detailsData.webViewLink
    };
  } catch (error) {
    console.error('Failed to upload file to Google Drive', error);
    throw error;
  }
};
