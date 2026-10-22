// Build completo do APK Android.
//
// Por que este script existe (além de limpar o APK aninhado):
//
// 1) Politica do Google AdSense: o codigo do AdSense nao pode ser
//    distribuido dentro de um aplicativo de software. O build do APK roda
//    com BUILD_TARGET=android, o que faz o Vite trocar o modulo de anuncios
//    pelo stub (src/lib/adsense.stub.js). O bundle do APK fica sem nenhum
//    `ca-pub-...`, `adsbygoogle` ou `googlesyndication`.
//
// 2) O `vite build` copia a pasta public/ (que contem agenda-pro.apk)
//    para dist/. O `cap sync` entao copia dist/ para os assets do Android.
//    Sem esta limpeza, o APK anterior ficaria EMBUTIDO dentro do APK novo,
//    fazendo o tamanho crescer a cada build (6 MB -> 11 MB -> 22 MB).
//
// O app nao precisa do APK nos seus assets: o botao de download aponta
// para a URL publica na web.
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

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

// 1) Compila a SPA com o stub de anuncios (sem AdSense no APK).
console.log("[build-android] compilando a SPA com BUILD_TARGET=android...");
const build = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["vite", "build"],
  {
    stdio: "inherit",
    env: { ...process.env, BUILD_TARGET: "android" }
    shell: process.platform === "win32",
  }
);
if (build.status !== 0) {
  console.error("[build-android] falha no vite build");
  process.exit(build.status ?? 1);
}

// 2) Remove o APK de dentro de dist/ antes do `cap sync`.
//
// O `ads.txt` tambem sai: ele referencia o publisher ID do AdSense e nao
// tem utilidade dentro do aplicativo (so a web precisa dele).
for (const arquivo of ["agenda-pro.apk", "ads.txt"]) {
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

