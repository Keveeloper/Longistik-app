import { Preferences } from '@capacitor/preferences';
import type { StateStorage } from 'zustand/middleware';

/**
 * Zustand persist adapter backed by Capacitor Preferences.
 * Native storage on Android/iOS (survives WebView cache clears),
 * falls back to localStorage in the browser.
 */
export const preferencesStorage: StateStorage = {
  getItem: async (name) => (await Preferences.get({ key: name })).value,
  setItem: async (name, value) => {
    await Preferences.set({ key: name, value });
  },
  removeItem: async (name) => {
    await Preferences.remove({ key: name });
  },
};
