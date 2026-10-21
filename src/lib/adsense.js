import { useEffect } from "react";

// Configuracao do Google AdSense.
//
// As variaveis de ambiente (VITE_ADSENSE_CLIENT / VITE_ADSENSE_SLOT) tem
// prioridade, mas mantemos os valores padrao como fallback para que o build
// nunca fique sem anuncios (por exemplo, quando a Vercel compila sem as
// variaveis configuradas).

export const ADSENSE_CLIENT =
  import.meta.env.VITE_ADSENSE_CLIENT || "ca-pub-6965683162396153";

export const ADSENSE_SLOT =
  import.meta.env.VITE_ADSENSE_SLOT || "9291009494";

// Slot específico do anúncio intersticial. Por padrão usa o mesmo slot do
// banner, mas pode ser separado via VITE_ADSENSE_SLOT_INTERSTITIAL.
export const ADSENSE_SLOT_INTERSTITIAL =
  import.meta.env.VITE_ADSENSE_SLOT_INTERSTITIAL || ADSENSE_SLOT;

const SCRIPT_ID = "adsbygoogle-script";
const SCRIPT_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;

// Garante que o script do AdSense esteja na pagina. Se ainda nao carregou,
// guarda os pushes em uma fila e reaplica quando o script ficar pronto.
function garantirScript() {
  if (typeof document === "undefined") return;

  // O index.html ja carrega o script do AdSense. Se ele ja estiver na pagina
  // (com o id ou com a URL do googlesyndication), nao carregamos de novo.
  const jaExiste =
    document.getElementById(SCRIPT_ID) ||
    Array.from(document.getElementsByTagName("script")).some((s) =>
      (s.src || "").includes("googlesyndication.com/pagead/js/adsbygoogle.js")
    );

  if (jaExiste) return;

  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = SCRIPT_SRC;
  document.head.appendChild(script);
}

// Envia o pedido de exibicao ao AdSense. Retorna true se foi aceito.
export function exibirAnuncio() {
  if (typeof window === "undefined") return false;

  try {
   (window.adsbygoogle = window.adsbygoogle || []).push({});
    return true;
  } catch (e) {
    console.warn("AdSense indisponivel:", e);
    return false;
  }
}

// Hook que carrega o script e dispara o pedido de anuncio de forma segura.
export function useAdsense(dependencies = []) {
  useEffect(() => {
    garantirScript();

    // Se o script ja carregou, o push e imediato.
    if (exibirAnuncio()) return;

    // Caso contrario, espera o script carregar e tenta de novo.
    const interval = setInterval(() => {
      if (window.adsbygoogle && window.adsbygoogle.loaded) {
        clearInterval(interval);
        exibirAnuncio();
      }
    }, 300);

    // Limite de 10s para nao deixar o timer rodando para sempre.
    const timeout = setTimeout(() => clearInterval(interval), 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
}
