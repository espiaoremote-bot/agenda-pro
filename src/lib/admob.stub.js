// Stub do modulo AdMob usado EXCLUSIVAMENTE no build do app Android.
// Diferente do AdSense, o AdMob e permitido e recomendado para apps nativos.
// Este arquivo define constantes que serao substituidas pelas IDs reais
// passadas via variaveis de ambiente no scripts/build-android.mjs.

// IDs serao preenchidas pelo build-android.mjs com os valores reais da conta AdMob.
// Em produção, estas serao substituidas pelos valores reais.
export const ADMOB_CLIENT =
  process.env.ADMOB_CLIENT || ""; // ex: "ca-app-pub-3940256099942544/1136891413"
export const ADMOB_SLOT =
  process.env.ADMOB_SLOT || ""; // ex: "3370583413"
export const ADMOB_SLOT_INTERSTITIAL =
  process.env.ADMOB_SLOT_INTERSTITIAL || ""; // ex: "3370583414"

// No app Android, o AdMob e permitido. Este modulo so serve como ponto de importacao.
export function ehWeb() {
  return false;
}

export function exibirAnuncio() {
  return true; // AdMob pode ser exibido no app
}

export function useAdsense() {
  // No-op para AdMob - chamado pelos componentes originais mas nao usado
}