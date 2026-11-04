/*
 * Delivery evidence: photo from the camera and the phone's location. Each photo is
 * stamped with the remesa, date, time and coordinates, so the evidence speaks for
 * itself wherever it ends up (web, email, a printed copy).
 */
import { Camera, CameraDirection } from '@capacitor/camera';
import { Device } from '@capacitor/device';
import { Geolocation } from '@capacitor/geolocation';

export interface Ubicacion {
  latitud: number;
  longitud: number;
  /** Meters */
  precision: number;
  /** When the fix was taken */
  fecha: Date;
}

/** Longest side of the stamped photo: enough to read a signature, small enough for a weak signal. */
const MAX_LADO = 1600;

/** The user closed the camera: not an error worth a message. */
export const isCancelacion = (error: unknown) => /cancel/i.test(String((error as Error)?.message ?? error));

export const formatoCoordenadas = ({ latitud, longitud }: Pick<Ubicacion, 'latitud' | 'longitud'>) =>
  `${latitud.toFixed(5)}, ${longitud.toFixed(5)}`;

/** Asks for permission the first time. Rejects with a user-facing message. */
export const obtenerUbicacion = async (): Promise<Ubicacion> => {
  try {
    const { coords, timestamp } = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 30000,
    });
    return { latitud: coords.latitude, longitud: coords.longitude, precision: coords.accuracy, fecha: new Date(timestamp) };
  } catch (error) {
    const message = String((error as Error)?.message ?? error);
    if (/denied|permission/i.test(message)) {
      throw new Error('Activa el permiso de ubicación para Longistik en los ajustes del teléfono.');
    }
    if (/disabled|location services/i.test(message)) throw new Error('Activa la ubicación (GPS) del teléfono.');
    throw new Error('No se pudo obtener la ubicación. Sal a un lugar abierto e intenta de nuevo.');
  }
};

/** "android 14 · Pixel 7", sent with the delivery. */
export const descripcionDispositivo = async () => {
  try {
    const info = await Device.getInfo();
    return [`${info.platform} ${info.osVersion}`.trim(), info.model].filter(Boolean).join(' · ');
  } catch {
    return undefined;
  }
};

const cargarImagen = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo leer la foto'));
    img.src = src;
  });

/**
 * Opens the camera (a file picker in the browser) and returns the stamped photo as
 * JPEG base64, without the data: prefix. Rejects with a "cancel" error if the user backs out.
 */
export const tomarFotoEstampada = async (lineas: string[]): Promise<string> => {
  const foto = await Camera.takePhoto({
    quality: 85,
    correctOrientation: true,
    saveToGallery: false,
    cameraDirection: CameraDirection.Rear,
    webUseInput: true,
  });
  if (!foto.webPath) throw new Error('No se pudo leer la foto');
  const img = await cargarImagen(foto.webPath);
  return estampar(img, lineas);
};

/** Scales the photo down and draws a dark band with the evidence data at the bottom. */
export const estampar = (img: HTMLImageElement, lineas: string[]) => {
  const escala = Math.min(1, MAX_LADO / Math.max(img.naturalWidth, img.naturalHeight));
  const ancho = Math.round(img.naturalWidth * escala);
  const alto = Math.round(img.naturalHeight * escala);
  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo procesar la foto');
  ctx.drawImage(img, 0, 0, ancho, alto);

  const fuente = Math.max(16, Math.round(ancho / 40));
  const interlineado = Math.round(fuente * 1.35);
  const margen = Math.round(fuente * 0.8);
  const banda = interlineado * lineas.length + margen * 2;
  ctx.fillStyle = 'rgba(21, 55, 65, 0.78)'; // tinta
  ctx.fillRect(0, alto - banda, ancho, banda);
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';
  ctx.font = `600 ${fuente}px Figtree Variable, Figtree, sans-serif`;
  lineas.forEach((linea, i) => ctx.fillText(linea, margen, alto - banda + margen + i * interlineado, ancho - margen * 2));

  return canvas.toDataURL('image/jpeg', 0.8).replace(/^data:image\/jpeg;base64,/, '');
};
