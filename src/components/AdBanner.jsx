import {
  ADSENSE_CLIENT,
  ADSENSE_SLOT,
  useAdsense,
} from "../lib/adsense";

// Banner de anúncio (Google AdSense) exibido apenas para usuários do plano free.
export default function AdBanner({ className = "" }) {
  useAdsense([ADSENSE_CLIENT, ADSENSE_SLOT]);

  return (
    <div className={`ad-banner ${className}`}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={ADSENSE_SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
