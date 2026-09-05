/* Mendaftarkan hook resolve alias. Dipakai lewat:
     node --import ./scripts/register-alias.mjs scripts/uji-logika.ts
   Hook resolve berjalan di thread terpisah, jadi akar proyek dikirim lewat
   data — process.cwd() di thread itu belum tentu sama. */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./alias-loader.mjs", import.meta.url, {
  data: { root: process.cwd() },
});
