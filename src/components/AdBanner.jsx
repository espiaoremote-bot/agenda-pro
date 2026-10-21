import { useEffect } from "react";

// Banner de anúncio (Google AdSense) exibido apenas para usuários do plano free.
// Configure o publisher id e o slot no .env (VITE_ADSENSE_CLIENT / VITE_ADSENSE_SLOT).
export default function AdBanner({ className = "" }) {
  const client = import.meta.env.VITE_ADSENSE_CLIENT;
  const slot = import.meta.env.VITE_ADSENSE_SLOT;

  useEffect(() => {
    if (!client || !slot) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.warn("AdSense indisponível:", e);
    }
  }, [client, slot]);

  if (!client || !slot) {
    return (
      <div className={`ad-banner ad-banner--placeholder ${className}`}>
        <small>Espaço de anúncio (configure VITE_ADSENSE_CLIENT/SLOT)</small>
      </div>
    );
  }

  return (
    <div className={`ad-banner ${className}`}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
