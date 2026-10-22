import { Capacitor } from "@capacitor/core";
import { AdMob, BannerAdSize, BannerAdPosition } from "@capacitor-community/admob";
import { ADMOB_SLOT } from "../lib/admob";

const DEFAULT_BANNER_ID = ADMOB_SLOT || "ca-app-pub-3940256099942544/6300978111";

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

export default function AdMobBanner({ className = "", slot }) {
  const adId = slot || DEFAULT_BANNER_ID;

  if (Capacitor.isNativePlatform()) {
    garantirInit().then(() => {
      AdMob.showBanner({
        adId,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        margin: 0,
      }).catch((e) => console.warn("AdMob showBanner falhou:", e));
    });
    return null;
  }

  return (
    <div className={`ad-mob-banner ${className}`} data-ad-slot={adId} />
  );
}
