import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { AdMob } from "@capacitor-community/admob";
import { ADMOB_SLOT_INTERSTITIAL } from "../lib/admob";

const DEFAULT_INTERSTITIAL_ID = ADMOB_SLOT_INTERSTITIAL || "ca-app-pub-3940256099942544/1033173712";

let inicializado = false;

async function garantirInit() {
  if (inicializado) return;
  if (!Capacitor.isNativePlatform()) return;
  try {
    await AdMob.initialize({
      requestTrackingAuthorization: true,
      testingDevices: [],
      initializeForTesting: false,
    });
    inicializado = true;
  } catch (e) {
    console.warn("AdMob init falhou:", e);
  }
}

export default function AdMobInterstitial({ onFechar, slot }) {
  const adId = slot || DEFAULT_INTERSTITIAL_ID;

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      onFechar?.();
      return;
    }
    let cancelado = false;
    garantirInit().then(async () => {
      if (cancelado) return;
      try {
        await AdMob.prepareInterstitial({ adId });
        await AdMob.showInterstitial();
      } catch (e) {
        console.warn("AdMob interstitial falhou:", e);
      } finally {
        if (!cancelado) onFechar?.();
      }
    });
    return () => {
      cancelado = true;
    };
  }, [adId, onFechar]);

  return null;
}
