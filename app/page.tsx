import { redirect } from "next/navigation";

/* Akar dialihkan ke /bagan. Shell yang memutuskan apakah yang tampil layar
   pembuka (daftar turnamen) atau bagan - lihat views/shell. Dengan begitu
   membuka alamat mana pun tetap melewati pemilihan turnamen. */
export default function Root() {
  redirect("/bagan");
}
