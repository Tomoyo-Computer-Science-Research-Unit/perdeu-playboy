// Copia o snapshot de cada UF publicada (data/<uf>/, versionado) para public/data/<uf>/, de onde o
// site o busca com fetch; public/data não vai para o git. Cada UF fora do Rio ganha também um
// public/<uf>/status.json vazio; no servidor o build-site.sh escreve o de verdade e o rsync não o
// sobrescreve. Roda antes de `next dev` e `next build`.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const ufs = JSON.parse(readFileSync(join(root, "lib", "ufs.json"), "utf8")).filter((uf) => uf.published);
const dest = join(root, "public", "data");
rmSync(dest, { recursive: true, force: true });
for (const entry of readdirSync(join(root, "public"))) {
  if (/^[a-z]{2}$/.test(entry)) {
    rmSync(join(root, "public", entry), { recursive: true, force: true });
  }
}
const missing = [];
for (const uf of ufs) {
  const code = uf.code.toLowerCase();
  const src = join(root, "data", code);
  if (!existsSync(join(src, "static-data.generated.json"))) {
    missing.push(uf.code);
    continue;
  }
  cpSync(src, join(dest, code), { recursive: true });
  if (uf.code !== "RJ") {
    mkdirSync(join(root, "public", code), { recursive: true });
    cpSync(join(root, "public", "status.json"), join(root, "public", code, "status.json"));
  }
}
if (missing.length) {
  console.error(`stage-data: sem snapshot em data/ para ${missing.join(", ")}`);
  process.exit(1);
}
console.log(`stage-data: ${ufs.length} UFs em public/data`);
