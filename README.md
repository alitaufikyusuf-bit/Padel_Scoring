# MN Padel Club — PWA Turnamen Padel (Next.js)

Bagan, jadwal, klasemen, dan papan skor turnamen padel untuk MN Padel Club.
Bisa dipasang di HP seperti aplikasi biasa dan tetap jalan penuh tanpa internet.

Ini hasil **slicing ulang** dari aplikasi vanilla `v5.0` (satu berkas
`index.html` 455 KB) ke Next.js App Router + TypeScript, dengan arsitektur
Feature-Sliced Design dan tema Tailwind neo-brutalism.

---

## Jalankan

```bash
npm install
npm run dev
```

| Perintah | Gunanya |
|---|---|
| `npm run dev` | server pengembangan |
| `npm run build` | build produksi |
| `npm run start` | jalankan hasil build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | uji logika inti (lihat **Pengujian**) |

Butuh Node 20+. Skrip uji memakai kemampuan Node menjalankan TypeScript
langsung, jadi paling nyaman di Node 22+.

---

## Deploy ke Vercel

Proyeknya sudah siap: `vercel.json` ada, dan tidak ada satu pun
ketergantungan pada Netlify.

Satu hal yang **wajib** disetel, kalau tidak sinkronisasi antar HP akan
tampak "hilang sendiri":

### Penyimpanan ruang

Versi Netlify memakai Netlify Blobs. Vercel tidak punya itu, jadi
`/api/bagan` memakai **Vercel KV / Upstash Redis lewat REST**. Setel dua
variabel lingkungan di proyek Vercel:

```
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```

(`UPSTASH_REDIS_REST_URL` dan `UPSTASH_REDIS_REST_TOKEN` juga diterima.)

Cara paling cepat: di dashboard Vercel → **Storage** → tambah **Upstash for
Redis**, sambungkan ke proyek ini, dan variabelnya terisi sendiri.

**Kalau keduanya tidak ada**, `/api/bagan` jatuh ke penyimpanan di memori
proses. Itu cukup untuk `npm run dev` di satu mesin, tapi **tidak layak
produksi**: tiap fungsi serverless punya prosesnya sendiri dan bisa dimatikan
kapan saja, jadi ruang yang tersimpan di memori akan tampak hilang secara
acak. Tidak ada SDK tambahan yang dipasang — panggilannya `fetch` biasa, jadi
bundelnya tidak bertambah berat.

---

## Arsitektur — Feature-Sliced Design

```
app/                    lapisan "app" FSD = App Router Next.js
  layout.tsx            provider, huruf, gaya global, metadata PWA
  providers.tsx         boot bahasa/tema, pemulihan sesi, service worker
  globals.css           tema neo-brutalism (Tailwind v4, CSS-first)
  bagan|klasemen|atur|live/page.tsx
  join/[room]/page.tsx  tautan undangan
  api/bagan/            sinkronisasi ruang (route handler + lapisan simpanan)

src/
  views/                komposisi per halaman  (lapisan "pages" FSD)
    shell/              bilah atas + host papan skor + layar pembuka
    bagan/ klasemen/ atur/ live/ join/
  widgets/              blok besar mandiri
    app-bar/ schedule-board/ standings-table/ roster-card/
    live-board/ settings-panel/ tournament-list/ rules-sheet/
  features/             satu tindakan pengguna, punya state sendiri
    scoreboard/ sync-room/ confirm/
  entities/             model domain + logika murni
    tournament/         akar agregat: store, daftar, nilai turunan
    schedule/           pair.ts · solo.ts · mexicano.ts
    match/ score/ standings/ knockout/ draw-code/
  shared/               tidak tahu apa pun soal domain
    config/ lib/ types/ ui/ i18n/ fonts/
```

**Kenapa tidak ada `src/app/`.** FSD menaruh lapisan tertinggi di `app`, dan
Next.js memakai nama yang sama untuk router — Next menolak berjalan kalau
`app/` dan `src/app/` ada bersamaan. Di sini root layout Next **memang**
lapisan app FSD: dia yang memasang provider, huruf, dan gaya global. Membuat
`src/app-providers/` hanya menghasilkan satu lapisan tipuan.

**Kenapa `views/`, bukan `pages/`.** Nama `pages` masih punya arti khusus di
Next.js (Pages Router), jadi lapisan itu diberi nama lain. Perannya sama.

Aturan ketergantungan FSD dipatuhi: lapisan hanya boleh mengimpor dari
lapisan di bawahnya. `entities` tidak pernah mengimpor `features`, `shared`
tidak pernah mengimpor apa pun dari domain.

---

## Apa yang dipindahkan apa adanya, dan apa yang tidak

Ini bagian terpenting untuk dibaca sebelum mengubah apa pun.

### Dipindahkan apa adanya (algoritmanya identik, hanya diberi tipe)

| Berkas | Isi |
|---|---|
| `entities/schedule/pair.ts` | `buildSlots`, `circleSlots`, `restStats`, `makeStandard`, `makeRandom` |
| `entities/schedule/solo.ts` | `attemptSolo`, `soloScore` (bobot 5000/400/60/1), `makeSolo`, `soloStats` |
| `entities/schedule/mexicano.ts` | `mexBlocks` (pemrograman dinamis blok tier v4.1), `mexPairUp` |
| `entities/score/index.ts` | mesin skor tenis berbasis riwayat reli |
| `entities/standings/index.ts` | `computeTable`, `soloTable` beserta seluruh urutan pembeda |
| `entities/knockout/index.ts` | `seedList`, `koPair`, `koLayout`, podium |
| `entities/draw-code/index.ts` | kode bagan `v9`, naik-versi dari v7/v8 |
| `app/api/bagan/route.ts` | seluruh kontrak API, termasuk aturan penggabungan skor |

Angka-angka ajaib di dalamnya adalah **kontrak**, bukan selera: mengubah bobot
`soloScore` mengubah bagan yang dihasilkan, dan mengubah susunan ruas kode
bagan membuat kode yang sudah tersimpan di HP orang jadi salah baca.

### Tidak bisa dipindahkan apa adanya

Sekitar 90 fungsi `render*` / `paint*` / `refresh*` di versi vanilla menulis
`innerHTML` langsung. Itu imperatif; React deklaratif. **Perilakunya** sama
persis, tapi kodenya jadi komponen — dan tidak ada cara mempertahankan
bentuknya tanpa membuat React bekerja melawan dirinya sendiri.

Satu akibat sampingannya justru perbaikan: di versi vanilla, `TARGET`,
`WIN_PTS`, tabel klasemen, dan pasangan knockout semuanya variabel global yang
harus diperbarui manual, dan tiap jalur yang lupa memperbaruinya melahirkan
bug "angka tidak ikut berubah". Di sini semuanya **dihitung ulang saat render**
(`entities/tournament/derived.ts`), jadi kelas bug itu hilang secara
struktural.

### Yang berubah teknologinya

- **Netlify Blobs → Vercel KV lewat REST.** Bentuk permintaan dan balasannya
  sama persis, termasuk kunci galat berbahasa Indonesia (`ruang-tidak-ada`,
  `kunci-salah`) karena sisi klien mencocokkannya.
- **CSS vanilla → Tailwind v4 + neo-brutalism.** Palet lamanya tidak dipetakan
  satu-satu; yang dipertahankan adalah **peran** tiap token (permukaan, tinta,
  garis, aksen, sorot, bahaya), sehingga komponen bisa dipindahkan mekanis.
- **Sesi ikut tersimpan.** Turnamen yang terakhir dibuka dipulihkan saat
  aplikasi dibuka lagi. Versi vanilla satu halaman dan tidak pernah
  bernavigasi, jadi ia tidak butuh ini; di sini tab adalah rute sungguhan.

---

## Tema neo-brutalism

Ada di `app/globals.css`. Cirinya: garis 3px hitam, bayangan padat tanpa blur,
warna datar yang berani, tipografi gempal, dan tombol yang benar-benar
**bergeser** saat ditekan.

Dua hal yang wajib dijaga kalau temanya disetel lagi:

1. **Kontras.** Tinta di atas permukaan minimal 7:1 — papan skor harus terbaca
   dari pinggir lapangan di bawah matahari.
2. **Warna bukan satu-satunya penanda.** Keadaan slot (main sekarang /
   berikutnya / selesai) dan tiga teratas klasemen selalu punya label atau
   medali, bukan cuma rona.

Token peran didefinisikan di `:root` **tanpa syarat**, lalu ditimpa untuk mode
gelap di `@media (prefers-color-scheme: dark)` dan `:root[data-theme="dark"]`.
Tidak boleh ada warna yang definisi satu-satunya berada di dalam blok media.

Mode gelap dipasang lewat skrip kecil di `<head>` **sebelum** halaman digambar
(`THEME_BOOT_SCRIPT` di `providers.tsx`) — tanpa itu, perangkat bertema gelap
akan melihat kilatan terang selama satu frame, dan di lapangan pada malam hari
itu menyilaukan.

---

## Dua bahasa

Dua mekanisme hidup berdampingan, dan itu **disengaja**:

- `t("kunci")` — label antarmuka, kunci pendek, diperiksa typecheck.
  Ada di `shared/i18n/static.ts` (162 entri, disalin program dari v5.0).
- `tx("teks Indonesia")` — pesan yang disusun saat berjalan, teks Indonesia
  jadi kuncinya sendiri. Ada di `shared/i18n/dynamic.ts` (580 entri).

Yang kedua tidak diseragamkan jadi kunci pendek karena ada lebih dari 400
pesan yang menempelkan angka dan nama ke potongan teks. Menamai ulang semuanya
berarti menyentuh 400 titik pemanggilan, dan tiap salah pasang menghasilkan
pesan keliru yang **tidak akan tertangkap typecheck**. Dengan teks Indonesia
sebagai kunci, seluruh string bisa disalin apa adanya.

Konsekuensinya harus diingat: tidak boleh ada dua kunci dengan teks Indonesia
sama tapi terjemahan berbeda. Kalau butuh itu, putuskan bentuknya di kode,
jangan dengan membuat kunci sintetis — kunci sintetis akan bocor ke layar saat
bahasanya Indonesia.

String yang **baru** di versi Next.js ini masuk ke `shared/i18n/extra.ts`,
supaya `dynamic.ts` tetap bisa dibandingkan dengan aslinya.

---

## Pengujian

```bash
npm run test
```

Dua berkas, keduanya menguji **janji**, bukan detail implementasi — yang
dilanggar tanpa gejala sampai klasemen akhir keluar.

`scripts/uji-logika.ts`:

- bagan Fix Partner adalah round robin **lengkap** untuk 3–12 tim × 1–4
  lapangan × baku/acak, tanpa pasangan terulang dan tanpa tim main dua kali
  di slot yang sama
- skor ikut **pertemuan**, bukan posisi, saat bagan diacak — termasuk dibalik
  kalau sisinya tertukar
- kode `v9` bolak-balik tanpa kehilangan apa pun, dan mengkodekan ulang
  menghasilkan string yang identik
- kode `v7` dan `v8` lama masih terbaca; kode ngawur dan bagan tidak lengkap
  ditolak dengan kunci galat yang benar
- mesin tenis menutup game tepat sesuai aturan deuce (golden point: reli
  bergantian selesai di reli ke-7; advantage: reli bergantian tidak pernah
  menutup game)
- klasemen: total poin cetak = total skor yang masuk, selisih berjumlah nol
- bagan Individu 8 pemain / 2 lapangan / 7 ronde memakai **seluruh 28
  pasangan tepat sekali**

`scripts/uji-mexicano.ts` membuktikan janji v4.1:

- contoh nyata dari catatan v4.1 (9 pemain, klasemen P2·P9·P3·P5·P6·P7·P8·P1·P4)
  menghasilkan **P7, P8, P1, P4** — empat terbawah, se-tier
- simulasi 9/12/16/20/24 pemain: rentang peringkat tiap lapangan selalu **3**,
  selisih porsi main **0–2**
- kursi tidak terisi ditolak, bukan dipaksakan

Skrip uji dijalankan Node langsung; alias `@/` dipetakan oleh hook kecil di
`scripts/alias-loader.mjs` karena Node tidak membaca `paths` dari tsconfig.

---

## Yang perlu diketahui sebelum mengubah kode

**Nomor peserta 1-based.** Bawaan dari versi vanilla, dan sengaja tidak
diubah: kode bagan yang tersimpan di HP orang menyimpan angka itu apa adanya.

**Selektor Zustand tidak boleh mengembalikan objek baru.** Zustand v5
membandingkan hasil selektor dengan kesamaan identitas, jadi selektor yang
membuat objek atau array baru tiap panggilan akan menggambar ulang komponen
tanpa henti sampai perambannya menyerah. Bug ini betulan terjadi saat porting
(`useRules` awalnya `useTournament((s) => rulesOf(s))`). Pola yang benar:
langganan bidang mentahnya, bentuk objeknya di luar selektor.

**Papan skor berjalan dikirim terpisah dari bagan.** Tiap pencatat hanya
menyentuh slot lapangannya sendiri, dan versi bagan **tidak** dinaikkan tiap
reli — kalau tidak, penonton memuat ulang seluruh bagan puluhan kali per menit
dan pencatat lain terganggu saat sedang mengetik.

**Posisi skor yang kosong tidak boleh menghapus skor di server.** Dua pencatat
mengirim seluruh kode bagan, masing-masing hanya tahu skor yang dilihatnya
sendiri. Aturan penggabungan di `app/api/bagan/route.ts` yang menjaga ini;
untuk benar-benar menimpa seluruhnya ada `full: true`.

**Mexicano: hanya ronde 1 yang boleh disusun di muka.** Sisanya menyusul satu
per satu dari klasemen saat itu. Menyusun semuanya di depan akan menghapus
sifat Mexicano-nya.

---

## Yang tidak ada di versi ini

**LIGA MN** (liga musiman dengan klasemen akumulatif, arsip musim, dan
pemerataan lintas musim) ada di cabang `v3.5`–`v3.9` yang **tidak** pernah
bergabung ke jalur `v4.x`/`v5.0`. Riwayat versi v5.0 melompat dari `3.4` ke
`4.0`. Karena slicing ini bertolak dari v5.0, LIGA MN tidak ikut. Arsitektur
FSD justru mempermudah menambahkannya nanti: lapisan musim jadi satu entitas
baru plus satu feature, tanpa menyentuh yang sudah ada.

Belum ikut juga: papan tonton khusus tablet 1024px dan TV 1400px+, serta
terjemahan Inggris untuk lembar Aturan & Catatan Teknis (isinya masih
Indonesia di kedua bahasa).
