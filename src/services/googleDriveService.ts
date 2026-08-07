import { GoogleSignin } from '@react-native-google-signin/google-signin';
import RNFS from 'react-native-fs';
import { GOOGLE_DRIVE } from '../utils/constants';

GoogleSignin.configure({
  scopes: GOOGLE_DRIVE.SCOPES,
  webClientId: 'YOUR_WEB_CLIENT_ID_HERE', // Placeholder
});

/**
 * Signs into Google Drive.
 */
export const signIn = async (): Promise<{email: string, accessToken: string}> => {
  try {
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();
    const tokens = await GoogleSignin.getTokens();
    return {
      email: userInfo.user.email,
      accessToken: tokens.accessToken
    };
  } catch (error) {
    console.error('Google Sign-In failed', error);
    throw error;
  }
};

/**
 * Signs out.
 */
export const signOut = async (): Promise<void> => {
  try {
    await GoogleSignin.signOut();
  } catch (error) {
    console.error('Google Sign-Out failed', error);
  }
};

/**
 * Checks if user is signed in.
 */
export const isSignedIn = async (): Promise<boolean> => {
  try {
    return await GoogleSignin.isSignedIn();
  } catch (error) {
    return false;
  }
};

/**
 * Gets access token.
 */
export const getAccessToken = async (): Promise<string | null> => {
  try {
    const tokens = await GoogleSignin.getTokens();
    return tokens.accessToken;
  } catch (error) {
    return null;
  }
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
 * Uploads a file to Google Drive.
 */
export const uploadFile = async (
  filePath: string,
  fileName: string,
  mimeType: string,
  folderId: string,
  accessToken: string
): Promise<{fileId: string, webViewLink: string}> => {
  try {
    const fileContent = await RNFS.readFile(filePath, 'base64');
    
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
