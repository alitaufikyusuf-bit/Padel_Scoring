"use client";

/* ============================================================================
   ATURAN & CATATAN TEKNIS

   Lembar penjelasan panjang yang disembunyikan di balik satu tombol. Isinya
   sengaja dipisah dari tooltip: tooltip menjawab "apa ini", lembar ini
   menjawab "kenapa begini" - dan yang kedua tidak layak menempel di kartu.

   Angka di dalam teks mengikuti setelan yang sedang aktif, jadi contohnya
   selalu cocok dengan turnamen yang sedang dibuka.
   ========================================================================== */

import * as React from "react";

import { useT } from "@/shared/i18n";
import { Button, Card, Overlay, Sheet } from "@/shared/ui";
import { useTournament } from "@/entities/tournament/store";
import { useCourtInfo, useRules } from "@/entities/tournament/derived";
import { WIN_PTS } from "@/shared/config";

export function RulesSheet() {
  const { t } = useT();
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Card>
        <Button variant="ghost" onClick={() => setOpen(true)}>
          ⓘ {t("rulesBtn")}
        </Button>
      </Card>
      <Overlay open={open} onClose={() => setOpen(false)} label={t("cardRules")} full>
        <Sheet title={t("rulesHead")} kicker="MN Padel Club" onClose={() => setOpen(false)}>
          <Body />
        </Sheet>
      </Overlay>
    </>
  );
}

function Body() {
  const { tx } = useT();
  const s = useTournament();
  const rules = useRules();
  const ci = useCourtInfo();
  const solo = s.fmt === "solo";
  const count = solo ? s.np : s.n;

  const P: React.FC<{ h?: string; children: React.ReactNode }> = ({ h, children }) => (
    <p className="mb-3 text-[13.5px] leading-relaxed">
      {h && <b>{h} </b>}
      {children}
    </p>
  );

  return (
    <div>
      <h3 className="nb-title mb-2">{tx("Cara bermain satu pertandingan")}</h3>
      {s.scoreSys === "tennis" ? (
        <P>
          {tx("Tiap game dihitung 0-15-30-40. Laga selesai begitu satu sisi mengumpulkan ")}
          {s.gmTarget}
          {tx(" game. Angka yang tersimpan di bagan adalah jumlah game.")}{" "}
          {s.mexDeuce
            ? tx("Pada 40-40 dimainkan advantage: harus menang dua reli berturut-turut.")
            : tx("Pada 40-40 dipakai golden point, satu reli langsung menentukan game — ini yang lazim di padel sosial karena durasinya bisa ditebak.")}
        </P>
      ) : rules.mode === "sum" ? (
        <P>
          {tx("Setiap pertandingan berisi tepat ")}
          {rules.target}
          {tx(" poin yang dibagi di antara kedua tim — setiap reli menghasilkan satu poin untuk salah satu pihak, dan pertandingan berhenti begitu total kedua skor mencapai ")}
          {rules.target}
          {tx(". Karena itu hasil seri hanya mungkin kalau angkanya genap.")}
        </P>
      ) : (
        <P>
          {tx("Pertandingan berhenti begitu satu tim lebih dulu mencapai ")}
          {rules.target}
          {tx(" poin, dan yang kalah berhenti di angka berapa pun yang sudah dicapainya. Seri tidak mungkin terjadi.")}
        </P>
      )}

      <h3 className="nb-title mb-2 mt-4">{tx("Penentuan peringkat")}</h3>
      {solo ? (
        s.mexOn ? (
          <>
            <P h={tx("Urutan Mexicano.")}>
              {tx("Poin cetak dulu. Lalu yang lebih SEDIKIT mainnya diangkat — kalau tidak, orang yang baru main 2 kali selalu kalah peringkat dari yang sudah main 4 kali semata karena punya lebih banyak kesempatan mengumpulkan poin. Baru setelah itu selisih poin, dan terakhir nomor pendaftaran supaya hasilnya sama setiap kali dihitung ulang.")}
            </P>
            <P h={tx("Kenapa urutannya penting.")}>
              {tx("Urutan ini juga yang dipakai menyusun ronde berikutnya, jadi klasemen yang Anda lihat memang dasar penyusunannya — bukan tabel terpisah.")}
            </P>
          </>
        ) : (
          <P>
            {s.soloRank === "wins"
              ? tx("Juara adalah pemain dengan poin liga terbanyak (menang 10, kalah 0). Kalau ada yang sama, pembedanya total poin yang dicetak, lalu selisih poin.")
              : tx("Juara adalah pemain dengan poin terbanyak. Yang dihargai besarnya kontribusi, bukan jumlah kemenangan.")}
          </P>
        )
      ) : (
        <>
          <P h={tx("Poin Liga.")}>
            {tx("Tim yang menang mendapat ")}
            {WIN_PTS}
            {tx(" poin liga, yang kalah 0. Dengan ")}
            {count}
            {tx(" tim, poin liga maksimum adalah ")}
            {(count - 1) * WIN_PTS}
            {tx(" bila menang seluruh ")}
            {count - 1}
            {tx(" pertandingan.")}
          </P>
          <P h={tx("Poin Cetak — pembeda kalau ada yang sama.")}>
            {tx("Kalau poin liga identik, yang total cetaknya lebih besar naik ke atas — jadi kemenangan besar lebih bernilai daripada kemenangan tipis, dan kekalahan tipis pun tetap ada gunanya.")}
          </P>
          <P h={tx("Urutan lengkap.")}>
            {tx("Pertama poin liga, lalu poin cetak, lalu selisih poin cetak, dan terakhir hasil pertemuan langsung.")}
          </P>
        </>
      )}

      <h3 className="nb-title mb-2 mt-4">{tx("Lapangan dan waktu")}</h3>
      <P h={tx("Batas lapangan yang benar-benar terpakai.")}>
        {tx("Karena satu peserta tidak bisa main di dua tempat, jumlah pertandingan serentak ada batasnya. Dengan setelan sekarang, ")}
        {ci.eff}
        {tx(" lapangan yang efektif")}
        {ci.idle > 0 ? tx(" — menambah lapangan di atas angka itu hanya membuat lapangan tambahan menganggur.") : "."}
      </P>
      <P h={tx("Jeda istirahat.")}>
        {tx("Penyusun jadwal berusaha menyebar pertandingan tiap peserta supaya tidak main di dua slot berurutan. Semakin banyak lapangan dipakai, semakin sulit memberi jeda — dengan lapangan yang banyak dan peserta yang sedikit, hampir semua peserta otomatis main di setiap slot.")}
      </P>

      <h3 className="nb-title mb-2 mt-4">{tx("Sinkronisasi antar HP")}</h3>
      <P h={tx("Satu pencatat, sisanya menonton.")}>
        {tx("Penonton dikunci hanya-baca, jadi tidak ada risiko skor saling menimpa. Peran disimpan per turnamen, bukan satu nilai global — kalau Kamis lalu Anda mencatat dan Kamis ini menonton, keduanya diingat terpisah.")}
      </P>
      <P h={tx("Papan skor berjalan dikirim terpisah.")}>
        {tx("Tiap pencatat hanya menyentuh slot lapangannya sendiri, jadi tiga pencatat di tiga lapangan tidak saling menimpa. Versi bagan tidak dinaikkan tiap reli, supaya penonton tidak memuat ulang seluruh bagan puluhan kali per menit.")}
      </P>
      <P h={tx("Skor yang kosong tidak menghapus skor orang lain.")}>
        {tx("Dua pencatat mengirim seluruh kode bagan, masing-masing hanya tahu skor yang dilihatnya sendiri. Karena itu posisi yang kosong di kiriman tidak pernah menghapus skor yang sudah ada di ruang. Untuk benar-benar menimpa seluruhnya, ada tombol Kirim bagan ini ke ruang.")}
      </P>
      <P h={tx("Tanpa akun.")}>
        {tx("Riwayat turnamen hanya ada di perangkat masing-masing. Kalau HP pencatat rusak atau simpanannya dibersihkan, daftarnya hilang — tapi bagannya sendiri masih aman di ruang, dan bisa dipanggil kembali lewat Gabung dengan kode itu.")}
      </P>
    </div>
  );
}
