import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const raizSrc = path.resolve(fileURLToPath(new URL('./src', import.meta.url)))
const adsenseStub = path.join(raizSrc, 'lib', 'adsense.stub.js')
const adBannerStub = path.join(raizSrc, 'components', 'AdBanner.stub.jsx')
const adInterstitialStub = path.join(
  raizSrc,
  'components',
  'AdInterstitial.stub.jsx'
)

// Politica do Google AdSense: o codigo do AdSense nao pode ser distribuido
// dentro de um aplicativo de software. No build do Android (BUILD_TARGET=android)
// trocamos os modulos de anuncios pelos stubs, que nao contem nenhuma string do
// AdSense. O bundle do APK fica entao livre de `ca-pub-...`, `adsbygoogle`
// e `googlesyndication`.
//
// O alias e feito por um plugin (e nao por `resolve.alias`) porque os imports
// chegam em caminhos relativos diferentes ("../lib/adsense", "./lib/adsense").
const MAPA_STUBS = new Map([
  [/^(\.\.\/|\.\/)?lib[\\/]adsense$/, adsenseStub],
  [/^(\.\.\/|\.\/)?components[\\/]AdBanner$/, adBannerStub],
  [/^(\.\.\/|\.\/)?components[\\/]AdInterstitial$/, adInterstitialStub],
])

function adsenseStubPlugin() {
  return {
    name: 'agenda-pro:adsense-stub',
    apply: 'build',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer) return null
      for (const [padrao, destino] of MAPA_STUBS) {
        if (!padrao.test(source)) continue
        // Nunca aplica sobre o proprio stub (evita loop).
        if (path.resolve(path.dirname(importer), source) === destino) return null
        return destino
      }
      return null
    },
  }
}

// https://vite.dev/config/
export default defineConfig(() => {
  const buildAndroid = process.env.BUILD_TARGET === 'android'

  return {
    plugins: [react(), ...(buildAndroid ? [adsenseStubPlugin()] : [])],
  }
})
