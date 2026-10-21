// Anúncio intersticial (tela cheia) exibido após o cliente fazer agendamento,
// apenas para usuários do plano free (com anúncios).
import { useEffect, useRef } from "react";
import {
  ADSENSE_CLIENT,
  ADSENSE_SLOT_INTERSTITIAL,
  ehWeb,
  useAdsense,
} from "../lib/adsense";

export default function AdInterstitial({ onFechar, slot = ADSENSE_SLOT_INTERSTITIAL }) {
  useAdsense([ADSENSE_CLIENT, slot]);

  // O AdSense só pode rodar em páginas web. Dentro do app nativo não
  // mostramos o overlay, senão o cliente ficaria preso numa tela vazia.
  const web = ehWeb();

  // Segurança: se o AdSense não responder (site ainda não aprovado / bloqueio
  // de rede), o cliente não pode ficar preso num overlay vazio. Depois de
  // 12s sem nenhum anúncio renderizado, o overlay se fecha sozinho.
  const refAnuncios = useRef(null);
  const refFechar = useRef(null);

  // Mantém a referência do callback atualizada, mas sem escrever em refs
  // durante a renderização (o ESLint regra `react-hooks/refs` proibe isso).
  useEffect(() => {
    refFechar.current = onFechar;
  }, [onFechar]);

  useEffect(() => {
    // No app nativo não há anúncio para exibir: fecha imediatamente.
    if (!web) {
      refFechar.current?.();
      return;
    }

    const timer = setTimeout(() => {
      // O AdSense renderiza o anúncio dentro de um iframe. Sem iframe,
      // significa que o slot não serviu nada (site não aprovado, etc.).
      const anuncio = refAnuncios.current?.querySelector("iframe");
      if (!anuncio) refFechar.current?.();
    }, 12000);
    return () => clearTimeout(timer);
  }, [web]);

  if (!web) return null;

  return (
    <div className="ad-interstitial">
      <div className="ad-interstitial__overlay" onClick={onFechar} />
      <div className="ad-interstitial__card">
        <button className="ad-interstitial__fechar" onClick={onFechar}>
          ✕
        </button>
        <div className="ad-interstitial__ads" ref={refAnuncios}>
          <ins
            className="adsbygoogle"
            style={{ display: "block" }}
            data-ad-client={ADSENSE_CLIENT}
            data-ad-slot={slot}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>
        <button className="ad-interstitial__continuar" onClick={onFechar}>
          Continuar
        </button>
      </div>
    </div>
  );
}
