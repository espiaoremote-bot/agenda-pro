// Anúncio intersticial (tela cheia) exibido após o cliente fazer agendamento,
// apenas para usuários do plano free (com anúncios).
import { useEffect } from "react";

export default function AdInterstitial({ onFechar }) {
  const client = import.meta.env.VITE_ADSENSE_CLIENT;
  const slot = import.meta.env.VITE_ADSENSE_SLOT;

  useEffect(() => {
    if (!client || !slot) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.warn("AdSense intersticial indisponível:", e);
    }
  }, [client, slot]);

  return (
    <div className="ad-interstitial">
      <div className="ad-interstitial__overlay" onClick={onFechar} />
      <div className="ad-interstitial__card">
        <button className="ad-interstitial__fechar" onClick={onFechar}>
          ✕
        </button>
        {!client || !slot ? (
          <div className="ad-interstitial__placeholder">
            <small>Anúncio (configure VITE_ADSENSE_CLIENT/SLOT)</small>
          </div>
        ) : (
          <div className="ad-interstitial__ads">
            <ins
              className="adsbygoogle"
              style={{ display: "block" }}
              data-ad-client={client}
              data-ad-slot={slot}
              data-ad-format="auto"
              data-full-width-responsive="true"
            />
          </div>
        )}
        <button className="ad-interstitial__continuar" onClick={onFechar}>
          Continuar
        </button>
      </div>
    </div>
  );
}
