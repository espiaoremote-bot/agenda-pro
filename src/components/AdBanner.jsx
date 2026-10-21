import {
  ADSENSE_CLIENT,
  ADSENSE_SLOT,
  ehWeb,
  useAdsense,
} from "../lib/adsense";

// Banner de anúncio (Google AdSense) exibido apenas para usuários do plano free.
//
// O AdSense só pode rodar em páginas web. Dentro do app nativo (Capacitor)
// não renderizamos nada, para não deixar uma caixa vazia na tela.
export default function AdBanner({ className = "", slot = ADSENSE_SLOT }) {
  useAdsense([ADSENSE_CLIENT, slot]);

  if (!ehWeb()) return null;

  return (
    <div className={`ad-banner ${className}`}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
