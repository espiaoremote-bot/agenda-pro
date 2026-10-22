// Modulo AdMob para web (no app nativo, o stub substitui).
// Constantes dos ad unit IDs. Substituir pelos IDs reais da conta AdMob.
export const ADMOB_CLIENT = import.meta.env.VITE_ADMOB_CLIENT || "";
export const ADMOB_SLOT = import.meta.env.VITE_ADMOB_SLOT || "";
export const ADMOB_SLOT_INTERSTITIAL = import.meta.env.VITE_ADMOB_SLOT_INTERSTITIAL || ADMOB_SLOT;
export const ADMOB_SLOT_CLIENT_MEIO = import.meta.env.VITE_ADMOB_SLOT_CLIENT_MEIO || ADMOB_SLOT;

export function ehWeb() {
  try {
    const { Capacitor } = require("@capacitor/core");
    return !Capacitor.isNativePlatform();
  } catch {
    return true;
  }
}

export function useAdsense() {}
