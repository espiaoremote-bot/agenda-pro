// Stub do intersticial de anuncio usado EXCLUSIVAMENTE no build do app Android.
//
// O componente real renderiza a tag <ins class="adsbygoogle"> e carrega o
// adsbygoogle.js. No APK isso e proibido pela politica do Google AdSense,
// entao aqui nao renderizamos nada (nenhuma string do AdSense no bundle).
export default function AdInterstitial() {
  return null;
}
