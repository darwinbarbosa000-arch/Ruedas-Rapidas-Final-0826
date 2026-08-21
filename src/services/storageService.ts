import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

/**
 * Converts a base64 string (e.g. data:image/jpeg;base64,...) into a Blob.
 */
export function base64ToBlob(base64: string): Blob {
  try {
    const parts = base64.split(';base64,');
    if (parts.length < 2) {
      throw new Error("Invalid base64 string format");
    }
    const contentType = parts[0].split(':')[1] || 'image/jpeg';
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: contentType });
  } catch (error) {
    console.error("Error converting base64 to Blob:", error);
    throw error;
  }
}

/**
 * Uploads a Blob or File to Firebase Storage and returns its public Download URL.
 * Falls back gracefully to original base64 or a local string if storage fails.
 */
export async function uploadToStorage(
  fileOrBase64: File | Blob | string,
  folder: string,
  fileName: string
): Promise<string> {
  try {
    let dataToUpload: Blob | File;
    let extension = 'jpg';

    if (typeof fileOrBase64 === 'string') {
      if (fileOrBase64.startsWith('data:')) {
        dataToUpload = base64ToBlob(fileOrBase64);
        const match = fileOrBase64.match(/data:image\/([a-zA-Z+]+);base64/);
        if (match && match[1]) {
          extension = match[1] === 'jpeg' ? 'jpg' : match[1];
        }
      } else {
        // Not a base64 data url, return as is
        return fileOrBase64;
      }
    } else {
      dataToUpload = fileOrBase64;
      if (fileOrBase64 instanceof File) {
        const parts = fileOrBase64.name.split('.');
        if (parts.length > 1) {
          extension = parts[parts.length - 1];
        }
      }
    }

    // Append unique timestamp to prevent caching issues and namespace conflicts
    const timestamp = Date.now();
    const finalFileName = `${fileName}_${timestamp}.${extension}`;
    const storageRef = ref(storage, `${folder}/${finalFileName}`);

    console.log(`Uploading file to Firebase Storage: ${folder}/${finalFileName}`);
    const snapshot = await uploadBytes(storageRef, dataToUpload);
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log(`Upload successful! Download URL: ${downloadURL}`);
    return downloadURL;
  } catch (error) {
    console.error("Firebase Storage upload failed. Falling back to base64/original data:", error);
    // If upload fails (e.g. storage rules or storage not fully initialized yet in firebase),
    // return the original string or throw error depending on context. Here we return the base64
    // to guarantee 100% functional fallback.
    if (typeof fileOrBase64 === 'string') {
      return fileOrBase64;
    }
    throw error;
  }
}
