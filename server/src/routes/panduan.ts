import { asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Elysia, status, t } from "elysia";
import { auth } from "../auth";
import type { Db } from "../db";
import { wasteCategories, wasteGuideItems } from "../db/schema";

/**
 * `%` dan `_` punya arti khusus di LIKE. Tanpa dikawal, warga yang mengetik
 * "100%" mendapat seluruh daftar, dan "_" mencocokkan huruf apa pun.
 * Backslash adalah escape bawaan LIKE di Postgres.
 */
const kawalPola = (kata: string) => `%${kata.replace(/[\\%_]/g, "\\$&")}%`;

/* Tong yang sebuah benda sering DIKIRA tempatnya — kolom sendiri, jadi butuh
   waste_categories kedua. */
const dikira = alias(wasteCategories, "dikira");

/**
 * Benda panduan + slug tongnya.
 *
 * Satu query untuk daftar, detail, dan pencarian. Bentuk benda yang dibaca
 * layar sama di ketiganya — kartu hasil cari dan baris di halaman jenis
 * memang benda yang sama, dan dua perakit akan membuat keduanya menyebut hal
 * yang berbeda untuk benda yang sama.
 */
const pilihBenda = (db: Db, saring: SQL | undefined, ...urut: SQL[]) =>
  db
    .select({
      nama: wasteGuideItems.name,
      jenis: wasteCategories.slug,
      catatan: wasteGuideItems.note,
      sorot: wasteGuideItems.isHighlighted,
      mirip: dikira.slug,
    })
    .from(wasteGuideItems)
    .innerJoin(
      wasteCategories,
      eq(wasteGuideItems.categoryId, wasteCategories.id),
    )
    /* left: sebagian besar benda tidak pernah salah dikira. */
    .leftJoin(dikira, eq(wasteGuideItems.mistakenForId, dikira.id))
    .where(saring)
    .orderBy(
      ...urut,
      asc(wasteCategories.sortOrder),
      /* Yang disorot lebih dulu: itu contoh yang dicetak kartu jenis. */
      desc(wasteGuideItems.isHighlighted),
      asc(wasteGuideItems.name),
    );

type BarisBenda = Awaited<ReturnType<typeof pilihBenda>>[number];

/**
 * Benda seperti yang dicetak KARTU JENIS di halaman daftar: nama + apakah ia
 * contoh.
 *
 * Sengaja lebih kurus dari `bentukBenda`. Kartu jenis hanya mencetak nama dan
 * memisahkan contoh dari "n lainnya", jadi `catatan` dan `mirip` ikut
 * terkirim tanpa pernah terbaca — dan `jenis` jelas dari kelompok yang
 * menampungnya. Diukur: 3053 B → 1765 B untuk seluruh panduan, dan ini
 * halaman yang dibuka warga sambil berdiri di depan tong, kadang di sinyal
 * satu bar.
 *
 * Catatan benda dulu dipakai klien untuk merakit "tips hari ini"; sejak ada
 * /panduan/tips, rotasinya dihitung server dan klien tidak perlu lagi.
 */
const bentukRingkas = (b: BarisBenda) => ({ nama: b.nama, sorot: b.sorot });

const bentukBenda = (b: BarisBenda) => ({
  nama: b.nama,
  jenis: b.jenis,
  /* undefined, bukan null: bentuk `WasteItem` yang dibaca layar memakai field
     opsional, dan `catatan: null` tercetak sebagai baris penjelasan kosong. */
  catatan: b.catatan ?? undefined,
  sorot: b.sorot,
  mirip: b.mirip ?? undefined,
});

/**
 * Tanggal hari ini di Jakarta, ISO yyyy-mm-dd.
 *
 * +7 jam tetap, bukan Intl: Jakarta tidak pernah berpenghematan waktu siang,
 * jadi pergeserannya memang konstan. Zona mesin TIDAK dipakai — server yang
 * berjalan di UTC akan menyajikan tip kemarin sampai jam 7 pagi WIB, persis
 * jam warga membaca kartu "tips hari ini" sambil menyiapkan sampah.
 */
const hariIniJakarta = () =>
  new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);

const bentukJenis = (k: typeof wasteCategories.$inferSelect) => ({
  jenis: k.slug,
  name: k.name,
  description: k.description,
  handlingTip: k.handlingTip,
});

export const rutePanduan = (db: Db) =>
  new Elysia({ prefix: "/panduan" })
    .use(auth)

    /**
     * Seluruh panduan: tiap jenis beserta bendanya, urutan tetap.
     *
     * Dikirim utuh, tanpa halaman. Halaman panduan memerlukan semuanya
     * sekaligus — kartu tiap jenis mencetak contoh DAN jumlah "n lainnya",
     * dan "tips hari ini" dirakit dari cara menangani tiap jenis ditambah
     * catatan benda. Memotongnya justru membuat angka-angka itu salah.
     *
     * Jenis tanpa benda tetap ikut: kartunya masih menjawab "ini apa" dan
     * "diapakan", dan jenis yang hilang dari panduan akan ditanyakan warga
     * ke pengurus.
     *
     * Bendanya dikirim RINGKAS (nama + sorot) — lihat `bentukRingkas`.
     *
     * 4 jenis + 32 benda hari ini, 1765 B. Kalau daftarnya kelak ratusan
     * benda, yang ditambahkan adalah endpoint ini TANPA benda plus pemuatan
     * per jenis — bukan halaman, karena kartunya butuh hitungan utuh.
     *
     * ponytail: pencarian memakai `ilike '%kata%'`, yang tidak bisa memakai
     * indeks btree apa pun. Diukur pada 32 benda: 0,195 ms — indeks di sini
     * murni upacara. Pada ~5.000 benda baru jadi 9,8 ms. Kalau daftarnya
     * benar-benar sampai sana, yang dipasang GIN trigram:
     *
     *   create extension if not exists pg_trgm;
     *   create index waste_guide_items_cari_idx
     *     on waste_guide_items using gin (name gin_trgm_ops);
     *
     * BELUM dimasukkan migrasi karena PGlite tidak punya `pg_trgm`, jadi
     * migrasinya akan merusak `npm run db:check` — dan pemeriksaan yang
     * menjalankan migrasi yang BERBEDA dari produksi lebih mahal daripada
     * 9,8 ms yang belum pernah terjadi.
     */
    .get("/", async () => {
      const [jenis, benda] = await Promise.all([
        db.select().from(wasteCategories).orderBy(asc(wasteCategories.sortOrder)),
        pilihBenda(db, undefined),
      ]);

      return {
        data: jenis.map((k) => ({
          ...bentukJenis(k),
          benda: benda.filter((b) => b.jenis === k.slug).map(bentukRingkas),
        })),
      };
    })

    /**
     * Cari benda, bukan telusuri kategori.
     *
     * Warga membuka panduan sambil berdiri di depan tong dengan satu benda di
     * tangan — pertanyaannya selalu "yang ini masuk mana". Jadi yang dicari
     * adalah NAMA BENDA, dan nama kategori ikut dicocokkan karena warga yang
     * mengetik "plastik" sedang bertanya apa saja yang masuk plastik, bukan
     * mencari benda bernama plastik. Aturan yang sama ditegakkan di layar.
     *
     * Kata kosong → daftar kosong, bukan 422: kotak cari memanggil ini sambil
     * warga mengetik, dan galat saat kotaknya baru dikosongkan adalah galat
     * yang tidak menjelaskan apa pun.
     */
    .get(
      "/cari",
      async ({ query }) => {
        const kata = query.kata?.trim() ?? "";
        if (!kata) return { data: [] };

        const pola = kawalPola(kata);
        const baris = await pilihBenda(
          db,
          or(
            ilike(wasteGuideItems.name, pola),
            ilike(wasteCategories.name, pola),
          ),
          /* Yang NAMANYA cocok lebih dulu. Mengetik "kertas" memang
             memunculkan seisi tong kertas, tapi benda bernama "kertas" itu
             sendiri yang paling mungkin sedang dipegang warga. */
          sql`(${wasteGuideItems.name} ilike ${pola}) desc`,
        );

        return { data: baris.map(bentukBenda) };
      },
      {
        /* Batas panjang di gerbang: kotak cari tidak pernah butuh 60 huruf,
           dan pola LIKE sepanjang kilometer hanya membebani basis data. */
        query: t.Object({ kata: t.Optional(t.String({ maxLength: 60 })) }),
      },
    )

    /**
     * Tip pilah untuk satu hari.
     *
     * Dirakit dari dua sumber yang SUDAH ada: cara menangani tiap jenis, dan
     * catatan benda yang jawabannya bikin kaget. Bukan tabel tips terpisah —
     * daftar kedua akan segera bertentangan dengan panduan di halaman jenis,
     * dan warga yang menemukan dua nasihat berbeda berhenti mempercayai
     * keduanya.
     *
     * Berotasi menurut TANGGAL, bukan diundi, dan dirotasi di SERVER: satu
     * tip yang sama untuk semua warga sepanjang hari itu, jadi "tips hari
     * ini" bisa jadi bahan obrolan di grup RT. Kalau klien yang merakit
     * urutannya, dua HP bisa menampilkan tip berbeda di hari yang sama dan
     * gunanya hilang.
     *
     * Hari dihitung dari epoch UTC supaya pembagiannya jatuh persis di batas
     * hari, dan `tanggal` default-nya hari ini di Jakarta.
     *
     * ponytail: menambah benda bercatatan menggeser rotasi untuk semua orang
     * — tip besok bukan lagi tip yang tadinya akan muncul besok. Untuk tips
     * itu tidak apa-apa; kalau kelak harus benar-benar tetap, yang
     * ditambahkan kolom urutan sendiri, bukan diundi dari daftar.
     */
    .get(
      "/tips",
      async ({ query }) => {
        const tanggal = query.tanggal ?? hariIniJakarta();

        /* Pola sudah memastikan bentuknya yyyy-mm-dd, tapi "2026-13-45" juga
           lolos pola. Tanpa penjaga ini `Date.parse` jadi NaN dan indeksnya
           ikut NaN — jawabannya `undefined`, bukan galat. */
        const hari = Math.floor(Date.parse(tanggal) / 86_400_000);
        if (!Number.isFinite(hari)) {
          return status(422, { pesan: "Tanggal tidak sah." });
        }

        const [jenis, benda] = await Promise.all([
          db
            .select()
            .from(wasteCategories)
            .orderBy(asc(wasteCategories.sortOrder)),
          pilihBenda(db, undefined),
        ]);

        const tips = [
          ...jenis
            .filter((k) => k.handlingTip)
            .map((k) => ({ teks: k.handlingTip!, jenis: k.slug })),
          ...benda
            .filter((b) => b.catatan)
            /* Bendanya disebut supaya layar bisa menaruhnya di depan:
               "Styrofoam: terlihat seperti plastik…" langsung terbaca sebagai
               jawaban, sementara catatannya sendiri menggantung tanpa
               subjek. */
            .map((b) => ({ teks: b.catatan!, jenis: b.jenis, benda: b.nama })),
        ];

        /* Panduan belum di-seed. Gagal dengan arahan, bukan kartu kosong:
           ini keadaan server, dan warga tidak bisa memperbaikinya. */
        if (tips.length === 0) {
          return status(503, {
            pesan: "Panduan pilah belum siap. Hubungi pengurus RW dulu, ya.",
          });
        }

        return {
          data: tips[((hari % tips.length) + tips.length) % tips.length],
        };
      },
      {
        /*
          Pola eksplisit, BUKAN `format: "date"`.

          Format bawaannya memeriksa "bisa di-parse jadi Date", jadi
          "09-11-2026" ikut lolos — dan di endpoint ini tidak ada perbandingan
          tanggal yang kebetulan menolaknya seperti di /slot-waktu, sehingga
          warga akan dapat tip hari lain tanpa diberi tahu. yyyy-mm-dd juga
          satu-satunya bentuk yang `Date.parse` baca sebagai tengah malam UTC,
          yang dibutuhkan rotasinya agar jatuh persis di batas hari.
        */
        query: t.Object({
          tanggal: t.Optional(
            t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" }),
          ),
        }),
      },
    )

    /**
     * Satu jenis: isinya, plus benda yang sering DIKIRA masuk sini.
     *
     * `tertukar` ikut di jawaban yang sama karena itu pertanyaan kedua warga
     * di halaman ini, berurutan setelah "apa saja yang masuk sini" — dan
     * benda itu milik jenis LAIN, jadi layar tidak bisa merakitnya dari
     * daftar jenis ini saja.
     *
     * Slug tak dikenal → 404. Halaman jenis memakai slug dari URL, jadi
     * salah ketik harus berakhir di halaman tidak-ditemukan, bukan di kartu
     * kosong yang terlihat seperti panduan yang belum diisi.
     */
    .get(
      "/:jenis",
      async ({ params }) => {
        const [k] = await db
          .select()
          .from(wasteCategories)
          .where(eq(wasteCategories.slug, params.jenis));
        if (!k) return status(404, { pesan: "Jenis sampah tidak dikenal." });

        const [benda, tertukar] = await Promise.all([
          pilihBenda(db, eq(wasteGuideItems.categoryId, k.id)),
          pilihBenda(db, eq(wasteGuideItems.mistakenForId, k.id)),
        ]);

        return {
          data: {
            ...bentukJenis(k),
            benda: benda.map(bentukBenda),
            tertukar: tertukar.map(bentukBenda),
          },
        };
      },
      /* Slug, bukan uuid: URL-nya /panduan/plastik — alamat yang bisa
         disebutkan warga satu ke warga lain. */
      { params: t.Object({ jenis: t.String({ maxLength: 40 }) }) },
    );
