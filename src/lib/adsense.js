import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

// Configuracao do Google AdSense.
//
// As variaveis de ambiente (VITE_ADSENSE_CLIENT / VITE_ADSENSE_SLOT) tem
// prioridade, mas mantemos os valores padrao como fallback para que o build
// nunca fique sem anuncios (por exemplo, quando a Vercel compila sem as
// variaveis configuradas).
//
// IMPORTANTE (politica do AdSense): o codigo do AdSense so pode ser
// implementado em paginas web. Distribuir o script adsbygoogle dentro de um
// aplicativo de software e violacao de politica. Por isso o script NAO fica
// no index.html (que e empacotado no APK do Capacitor) e sim e injetado em
// runtime por este modulo, e apenas quando o app roda no navegador.

export const ADSENSE_CLIENT =
  import.meta.env.VITE_ADSENSE_CLIENT || "ca-pub-6965683162396153";

export const ADSENSE_SLOT =
  import.meta.env.VITE_ADSENSE_SLOT || "9291009494";

// Slots especificos. Cada bloco de anuncio usa um slot proprio para que o
// AdSense nao perca a veiculacao por repeticao do mesmo slot na mesma tela.
//
// - ADSENSE_SLOT              : banner generico (fallback)
// - ADSENSE_SLOT_INTERSTITIAL : tela cheia apos o agendamento
// - ADSENSE_SLOT_CLIENT       : banner no rodape do perfil do cliente
// - ADSENSE_SLOT_CLIENT_MEIO  : banner no meio do perfil do cliente
// - ADSENSE_SLOT_PROFISSIONAL  : banner na area do profissional
//
// Para usar slots realmente distintos, crie os slots no painel do AdSense e
// defina as variaveis de ambiente abaixo na Vercel. Enquanto isso, o valor
// padrao garante que o anuncio continue funcionando.
export const ADSENSE_SLOT_INTERSTITIAL =
  import.meta.env.VITE_ADSENSE_SLOT_INTERSTITIAL || ADSENSE_SLOT;

export const ADSENSE_SLOT_CLIENT =
  import.meta.env.VITE_ADSENSE_SLOT_CLIENT || ADSENSE_SLOT;

export const ADSENSE_SLOT_CLIENT_MEIO =
  import.meta.env.VITE_ADSENSE_SLOT_CLIENT_MEIO || ADSENSE_SLOT;

export const ADSENSE_SLOT_PROFISSIONAL =
  import.meta.env.VITE_ADSENSE_SLOT_PROFISSIONAL || ADSENSE_SLOT;

const SCRIPT_ID = "adsbygoogle-script";
const SCRIPT_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;

// O codigo do AdSense so pode rodar em paginas web. Dentro do app nativo
// (Capacitor) ele nao deve nem ser carregado.
export function ehWeb() {
  try {
    return !Capacitor.isNativePlatform();
  } catch {
    return true;
  }
}

// Garante que o script do AdSense esteja na pagina. Se ainda nao carregou,
// guarda os pushes em uma fila e reaplica quando o script ficar pronto.
function garantirScript() {
  if (typeof document === "undefined") return;
  if (!ehWeb()) return;

  // Se o script ja estiver na pagina (com o id ou com a URL do
  // googlesyndication), nao carregamos de novo.
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
  if (!ehWeb()) return false;

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
    if (!ehWeb()) return;

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
