// Stub do modulo de anuncios usado EXCLUSIVAMENTE no build do app Android.
//
// Politica do Google AdSense: o codigo do AdSense (client ID, slots e o
// carregamento do adsbygoogle.js) NAO pode ser distribuido dentro de um
// aplicativo de software. O Vite faz alias deste arquivo no lugar de
// `src/lib/adsense.js` quando a variavel BUILD_TARGET=android.
//
// Como o stub nao contem nenhuma string do AdSense, o bundle final do APK
// fica limpo: nenhum `ca-pub-...`, nenhum `adsbygoogle`, nenhum
// `googlesyndication`.

export const ADSENSE_CLIENT = "";
export const ADSENSE_SLOT = "";
export const ADSENSE_SLOT_INTERSTITIAL = "";
export const ADSENSE_SLOT_CLIENT = "";
export const ADSENSE_SLOT_CLIENT_MEIO = "";
export const ADSENSE_SLOT_PROFISSIONAL = "";

// No app nativo nunca ha anuncio para exibir.
export function ehWeb() {
  return false;
}

export function exibirAnuncio() {
  return false;
}

export function useAdsense() {
  // No-op: no app Android nao existe script de anuncios.
}
