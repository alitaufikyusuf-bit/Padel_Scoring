/* Peta alias "@/..." -> "<root>/src/..." untuk skrip uji yang dijalankan Node
   langsung. Next.js membaca alias itu dari tsconfig; Node tidak.

   Modul di proyek ini ditulis tanpa ekstensi (gaya bundler), sementara Node
   menuntutnya — jadi hook ini juga menebak ".ts", "/index.ts", dan seterusnya.
   Hanya dipakai skrip uji; tidak pernah masuk bundel aplikasi. */
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve as join } from "node:path";

let ROOT = process.cwd();

export function initialize(data) {
  if (data && data.root) ROOT = data.root;
}

export function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const rest = specifier.slice(2);
    const guesses = rest.endsWith(".ts")
      ? [rest]
      : [rest + ".ts", rest + "/index.ts", rest + ".tsx", rest + "/index.tsx"];
    for (const g of guesses) {
      const p = join(ROOT, "src", g);
      if (existsSync(p)) {
        return next(pathToFileURL(p).href, context);
      }
    }
  }
  return next(specifier, context);
}
