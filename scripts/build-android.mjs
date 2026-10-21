// Remove o APK de dentro de dist/ antes do `cap sync`.
//
// Por que: o `vite build` copia a pasta public/ (que contem agenda-pro.apk)
// para dist/. O `cap sync` entao copia dist/ para os assets do Android.
// Sem esta limpeza, o APK anterior ficaria EMBUTIDO dentro do APK novo,
// fazendo o tamanho crescer a cada build (6 MB -> 11 MB -> 22 MB).
//
// O app nao precisa do APK nos seus assets: o botao de download aponta
// para a URL publica na web.
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const dist = join(process.cwd(), "dist");
const assetsAndroid = join(
  process.cwd(),
  "android",
  "app",
  "src",
  "main",
  "assets",
  "public"
);

for (const arquivo of ["agenda-pro.apk"]) {
  const caminho = join(dist, arquivo);
  if (existsSync(caminho)) {
    rmSync(caminho);
    console.log(`[build-android] removido dist/${arquivo} (evita APK dentro do APK)`);
  }

  // O `cap sync` nao apaga arquivos que sumiram do dist/, entao o APK
  // antigo continuaria nos assets e seria reembutido no APK seguinte.
  const caminhoAssets = join(assetsAndroid, arquivo);
  if (existsSync(caminhoAssets)) {
    rmSync(caminhoAssets);
    console.log(
      `[build-android] removido android/assets/public/${arquivo} (residuo de build anterior)`
    );
  }
}
