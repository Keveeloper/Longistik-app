/*
 * Files kept on the phone for offline use (manifiesto PDFs, photos of deliveries waiting
 * for signal). Native: the app's private data folder. Web: IndexedDB (Capacitor's fallback).
 */
import { Directory, Filesystem } from '@capacitor/filesystem';

const directory = Directory.Data;

export const base64ToBytes = (base64: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

export const writeBase64 = async (path: string, data: string) => {
  await Filesystem.writeFile({ path, data, directory, recursive: true });
};

/** Base64 content of a file written with writeBase64. */
export const readBase64 = async (path: string) => {
  const { data } = await Filesystem.readFile({ path, directory });
  return typeof data === 'string' ? data : blobToBase64(data);
};

/** Never throws: a missing file is already gone. */
export const removePath = async (path: string) => {
  try {
    await Filesystem.rmdir({ path, directory, recursive: true });
  } catch {
    try {
      await Filesystem.deleteFile({ path, directory });
    } catch {
      // nothing to delete
    }
  }
};
