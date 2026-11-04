/*
 * Push notifications through Firebase Cloud Messaging (request/notificaciones-push.md §7).
 * Only on the phone (Android/iOS): the web build shows the bell without push. The plugin is
 * loaded on demand, so the web bundle doesn't carry Firebase.
 *
 * The phone's token is registered with the company backend (POST /mobile/dispositivos);
 * the company backend asks the ConfigPanel to send, and only the panel holds the Firebase
 * credential.
 */
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import type { FirebaseMessagingPlugin } from '@capacitor-firebase/messaging';
import { notificacionesService } from '../services/notificaciones.service';
import { descripcionDispositivo } from '../offline/evidencia';
import { useAuthStore } from '../store/auth.store';
import type { DataPush } from './avisos';

export type PermisoPush = 'granted' | 'denied' | 'prompt' | 'no_disponible';

const TOKEN_KEY = 'push-token';

/** Android channels (the backend picks one per notification type). */
const CANALES = [
  { id: 'operacion', name: 'Operación', description: 'Sobreanticipos, manifiestos y RNDC', importance: 3 },
  { id: 'seguimiento', name: 'Seguimiento del viaje', description: 'Pedidos de ubicación durante un viaje', importance: 4 },
  { id: 'alertas', name: 'Alertas', description: 'Auxilio y alertas de seguridad', importance: 5 },
] as const;

export const pushDisponible = () => Capacitor.isNativePlatform();

let plugin: Promise<FirebaseMessagingPlugin> | null = null;
const firebase = () => {
  plugin ??= import('@capacitor-firebase/messaging').then((m) => m.FirebaseMessaging);
  return plugin;
};

export const permisoPush = async (): Promise<PermisoPush> => {
  if (!pushDisponible()) return 'no_disponible';
  try {
    const { receive } = await (await firebase()).checkPermissions();
    return receive === 'granted' ? 'granted' : receive === 'denied' ? 'denied' : 'prompt';
  } catch (err) {
    console.warn('[push] Firebase no responde', err);
    return 'no_disponible';
  }
};

/** Shows the system prompt (from the "Activar" button, never on launch) and registers the phone. */
export const activarPush = async (): Promise<PermisoPush> => {
  if (!pushDisponible()) return 'no_disponible';
  const { receive } = await (await firebase()).requestPermissions();
  if (receive !== 'granted') return receive === 'denied' ? 'denied' : 'prompt';
  await registrarDispositivo();
  return 'granted';
};

/** Registers this phone's token with the company backend (idempotent). */
export const registrarDispositivo = async (token?: string) => {
  if (!pushDisponible() || !useAuthStore.getState().token) return;
  const fcm = token ?? (await (await firebase()).getToken()).token;
  if (!fcm) return;
  await notificacionesService.registrarDispositivo({
    token: fcm,
    plataforma: Capacitor.getPlatform() === 'ios' ? 'ios' : 'android',
    appVersion: import.meta.env.VITE_APP_VERSION,
    descripcion: await descripcionDispositivo(),
  });
  await Preferences.set({ key: TOKEN_KEY, value: fcm });
  console.info('[push] teléfono registrado');
};

/**
 * Before logging out: removes the token from the backend while the session is still valid,
 * then from Firebase, so this phone stops getting that user's notifications. Never blocks
 * the logout: a token left behind is cleaned by the backend after 60 days unused.
 */
export const desregistrarDispositivo = async () => {
  if (!pushDisponible()) return;
  const { value } = await Preferences.get({ key: TOKEN_KEY });
  await Preferences.remove({ key: TOKEN_KEY });
  if (!value) return;
  await Promise.allSettled([notificacionesService.borrarDispositivo(value), firebase().then((f) => f.deleteToken())]);
};

export interface ListenersPush {
  /** Arrived with the app open: no system notification is shown */
  onRecibida: (titulo: string, cuerpo: string, data: DataPush) => void;
  /** The user tapped a notification */
  onAbierta: (data: DataPush) => void;
}

/** Channels and listeners; call once per launch. Returns a cleanup function. */
export const iniciarPush = async ({ onRecibida, onAbierta }: ListenersPush): Promise<() => void> => {
  if (!pushDisponible()) return () => {};
  const fm = await firebase();
  if (Capacitor.getPlatform() === 'android') {
    await Promise.allSettled(CANALES.map((c) => fm.createChannel({ ...c, visibility: 1, vibration: true })));
  }
  const handles = await Promise.all([
    fm.addListener('tokenReceived', ({ token }) => void registrarDispositivo(token).catch(() => undefined)),
    fm.addListener('notificationReceived', ({ notification }) =>
      onRecibida(notification.title ?? '', notification.body ?? '', (notification.data ?? {}) as DataPush)
    ),
    fm.addListener('notificationActionPerformed', ({ notification }) => onAbierta((notification.data ?? {}) as DataPush)),
  ]);
  return () => handles.forEach((h) => void h.remove());
};

/** User-initiated logout: unregisters the phone first (while the session is valid), then clears it. */
export const cerrarSesion = async () => {
  await desregistrarDispositivo().catch(() => undefined);
  useAuthStore.getState().logout();
};
