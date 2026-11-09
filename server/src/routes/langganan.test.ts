/** Jalankan: npm run test:langganan */
import assert from "node:assert/strict";
import { GalatBayar } from "../pembayaran";
import { berlangganan, lulus, siapkan, tanggalISO } from "../test/bantu";

const WARGA = "11111111-1111-1111-1111-111111111111";

/** Satu lingkungan bersih per skenario — status langganan beda-beda. */
async function skenario(opsi: Parameters<typeof berlangganan>[3] = {}) {
  const alat = await siapkan();
  const { db, schema } = alat;
  await db
    .insert(schema.users)
    .values({ id: WARGA, fullName: "Bu Rina", phone: "0811" });
  const [ch] = await db
    .insert(schema.rwChannels)
    .values({ name: "RW 05 Sukamaju", areaCode: "3573" })
    .returning();
  const [alamat] = await db
    .insert(schema.addresses)
    .values({
      userId: WARGA,
      label: "Rumah",
      fullAddress: "Jl. Kenanga No. 12",
      rwChannelId: ch.id,
      isDefault: true,
    })
    .returning();
  const [slot] = await db
    .insert(schema.timeSlots)
    .values({
      label: "06.00–08.00",
      startTime: "06:00:00",
      endTime: "08:00:00",
      capacity: 50,
    })
    .returning();
  await db
    .insert(schema.wasteCategories)
    .values({ slug: "organik", name: "Organik" });

  const langganan =
    opsi === null ? null : await berlangganan(db, schema, WARGA, opsi);

  return { ...alat, alamat, slot, langganan };
}

const pesan = (alamatId: string, slotId: string) => ({
  addressId: alamatId,
  jenis: ["organik"],
  tanggal: tanggalISO(1),
  timeSlotId: slotId,
});

/* --- belum punya langganan --- */
{
  const { panggil, klien, alamat, slot } = await skenario(null as never);
  let r = await panggil("GET", "/api/langganan/saya", { sebagai: WARGA });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.status, "belum_ada");
  assert.equal(r.body.data.bolehPesan, false);
  assert.equal(r.body.data.langgananAktif, false);
  lulus("belum punya langganan → status belum_ada, bolehPesan false");

  r = await panggil("POST", "/api/pesanan", {
    sebagai: WARGA,
    body: pesan(alamat.id, slot.id),
  });
  assert.equal(r.status, 402, "memesan tanpa langganan harus ditolak");
  lulus("pesan tanpa langganan → 402");
  await klien.close();
}

/* --- langganan aktif --- */
{
  const { panggil, klien, alamat, slot } = await skenario({ kuota: 8 });
  let r = await panggil("GET", "/api/langganan/saya", { sebagai: WARGA });
  assert.equal(r.body.data.status, "aktif");
  assert.equal(r.body.data.bolehPesan, true);
  assert.equal(r.body.data.langgananAktif, true);
  assert.equal(r.body.data.pickupQuota, 8);
  assert.equal(r.body.data.pickupUsed, 0);
  assert.equal(r.body.data.alasan, null);
  assert.equal(r.body.data.planName, "Bulanan Rumah Tangga");
  lulus("langganan aktif → bolehPesan true, kuota 8 terpakai 0");

  r = await panggil("POST", "/api/pesanan", {
    sebagai: WARGA,
    body: pesan(alamat.id, slot.id),
  });
  assert.equal(r.status, 201);
  r = await panggil("GET", "/api/langganan/saya", { sebagai: WARGA });
  assert.equal(r.body.data.pickupUsed, 1, "pesanan menambah pemakaian kuota");
  lulus("satu pesanan → pickupUsed naik jadi 1");
  await klien.close();
}

/* --- menunggu pembayaran --- */
{
  const { panggil, klien, alamat, slot } = await skenario({
    status: "menunggu_bayar",
  });
  let r = await panggil("GET", "/api/langganan/saya", { sebagai: WARGA });
  assert.equal(r.body.data.status, "menunggu_bayar");
  assert.equal(r.body.data.bolehPesan, false);
  assert.equal(r.body.data.langgananAktif, false);
  assert.match(r.body.data.alasan, /[Pp]embayaran/);
  lulus("menunggu_bayar → bolehPesan false, alasan menyebut pembayaran");

  r = await panggil("POST", "/api/pesanan", {
    sebagai: WARGA,
    body: pesan(alamat.id, slot.id),
  });
  assert.equal(r.status, 402);
  lulus("pesan saat menunggu bayar → 402");
  await klien.close();
}

/* --- baris masih 'aktif' tapi tanggalnya sudah lewat --- */
{
  const { panggil, klien, alamat, slot } = await skenario({
    status: "aktif",
    mulai: tanggalISO(-40),
    sampai: tanggalISO(-2),
  });
  let r = await panggil("GET", "/api/langganan/saya", { sebagai: WARGA });
  assert.equal(
    r.body.data.status,
    "kedaluwarsa",
    "tanggal yang menentukan, bukan kolom status",
  );
  assert.equal(r.body.data.bolehPesan, false);
  assert.equal(
    r.body.data.langgananAktif,
    false,
    "tanggal lewat = tidak berjalan, walau kuotanya belum tersentuh",
  );
  lulus("end_date lewat walau kolom masih 'aktif' → kedaluwarsa");

  r = await panggil("POST", "/api/pesanan", {
    sebagai: WARGA,
    body: pesan(alamat.id, slot.id),
  });
  assert.equal(r.status, 402);
  lulus("pesan saat kedaluwarsa → 402");
  await klien.close();
}

/* --- kuota habis --- */
{
  const { panggil, klien, alamat, slot } = await skenario({ kuota: 1 });
  let r = await panggil("POST", "/api/pesanan", {
    sebagai: WARGA,
    body: pesan(alamat.id, slot.id),
  });
  assert.equal(r.status, 201, "pesanan pertama memakai satu-satunya kuota");

  r = await panggil("GET", "/api/langganan/saya", { sebagai: WARGA });
  assert.equal(r.body.data.pickupUsed, 1);
  assert.equal(r.body.data.bolehPesan, false);
  assert.match(r.body.data.alasan, /[Kk]uota/);
  /* Paketnya MASIH berjalan — yang habis cuma kuota periode ini. Inilah satu
     keadaan yang membedakan kedua bendera, dan yang dipakai layar jadwal
     rutin: jadwalnya berlaku untuk periode berikutnya, jadi tidak ditahan. */
  assert.equal(r.body.data.langgananAktif, true);
  lulus("kuota habis → bolehPesan false tapi langgananAktif tetap true");

  r = await panggil("POST", "/api/pesanan", {
    sebagai: WARGA,
    body: { ...pesan(alamat.id, slot.id), tanggal: tanggalISO(2) },
  });
  assert.equal(r.status, 402, "kuota habis menutup pesanan berikutnya");
  lulus("pesan setelah kuota habis → 402");

  /* Pesanan batal harus mengembalikan kuota. */
  await klien.exec(`update pickups set status = 'batal'`);
  r = await panggil("GET", "/api/langganan/saya", { sebagai: WARGA });
  assert.equal(r.body.data.pickupUsed, 0);
  assert.equal(r.body.data.bolehPesan, true);
  lulus("pesanan dibatalkan → kuota kembali, bolehPesan true lagi");
  await klien.close();
}

/* --- daftar paket --- */
{
  const { panggil, klien, db, schema } = await skenario();
  /* Sengaja dimasukkan tidak urut harga, dan satu di antaranya sudah ditarik. */
  await db.insert(schema.subscriptionPlans).values([
    { name: "Bulanan Rumah Besar", billingCycle: "bulanan", price: 80_000, pickupQuota: 16, isActive: false },
    { name: "Mingguan Coba", billingCycle: "mingguan", price: 14_000, pickupQuota: 2 },
    { name: "Bulanan Hemat", billingCycle: "bulanan", price: 25_000, pickupQuota: 4 },
  ]);

  const r = await panggil("GET", "/api/langganan/paket", { sebagai: WARGA });
  assert.equal(r.status, 200);
  const harga = r.body.data.map((p: { price: number }) => p.price);
  assert.deepEqual(
    harga,
    [...harga].sort((a: number, b: number) => a - b),
    "paket harus urut dari termurah — layar membandingkan harga per jemput",
  );
  lulus("daftar paket urut dari termurah");

  /* Paket yang ditarik tetap terkirim: layarnya menyebut alasannya, dan warga
     yang masih memakai paket lama perlu melihat miliknya tercantum. */
  const ditarik = r.body.data.find(
    (p: { name: string }) => p.name === "Bulanan Rumah Besar",
  );
  assert.ok(ditarik, "paket yang ditarik tidak boleh hilang dari daftar");
  assert.equal(ditarik.isActive, false);
  lulus("paket yang ditarik ikut terkirim dengan isActive false");

  /* Bentuknya harus persis yang dibaca layar — tak ada kolom yang terlewat. */
  assert.deepEqual(
    Object.keys(r.body.data[0]).sort(),
    ["billingCycle", "id", "isActive", "name", "pickupQuota", "price"],
  );
  lulus("bentuk paket cocok dengan yang dibaca layar langganan");

  assert.equal(
    (await panggil("GET", "/api/langganan/paket")).status,
    401,
    "daftar paket tanpa identitas harus ditolak",
  );
  lulus("GET /langganan/paket tanpa identitas → 401");
  await klien.close();
}

/* --- buat tagihan --- */
{
  const { panggil, klien, db, schema, langganan, alamat, slot } =
    await skenario({ kuota: 8 });
  const paketLama = langganan!.paket;

  const [paketLain] = await db
    .insert(schema.subscriptionPlans)
    .values({
      name: "Bulanan Rumah Besar",
      billingCycle: "bulanan",
      price: 80_000,
      pickupQuota: 16,
    })
    .returning();
  const [paketDitarik] = await db
    .insert(schema.subscriptionPlans)
    .values({
      name: "Bulanan Warung",
      billingCycle: "bulanan",
      price: 90_000,
      pickupQuota: 20,
      isActive: false,
    })
    .returning();

  /* Nominal TIDAK boleh ikut dari pemanggil. Dikirim pun harus diabaikan —
     kalau tidak, satu baris curl cukup untuk membeli paket termahal seribu
     rupiah. */
  let r = await panggil("POST", "/api/langganan/bayar", {
    sebagai: WARGA,
    body: { planId: paketLain.id, method: "qris", amount: 1000, price: 1000 },
  });
  assert.equal(r.status, 201);
  assert.equal(
    r.body.data.amount,
    80_000,
    "nominal harus dibaca dari harga paket di basis data",
  );
  lulus("nominal dibaca dari basis data, bukan dari pemanggil");

  assert.match(r.body.data.code, /^PY-INV-\d{4}$/);
  assert.equal(r.body.data.status, "pending");
  assert.equal(r.body.data.perpanjangan, false, "ganti paket bukan perpanjangan");
  lulus("tagihan ganti paket: kode terbit, status pending");

  /* Ganti pikiran: tagihan lama ditutup, bukan dibiarkan hidup — kode QRIS
     dari pilihan yang ditinggalkan tidak boleh masih bisa dibayar. */
  const kodeLama = r.body.data.code;
  r = await panggil("POST", "/api/langganan/bayar", {
    sebagai: WARGA,
    body: { planId: paketLain.id, method: "va_bank", channel: "BCA" },
  });
  assert.equal(r.status, 201);
  assert.equal(r.body.data.channel, "BCA");
  const semua = await db.select().from(schema.payments);
  const lama = semua.find((t) => t.code === kodeLama)!;
  assert.equal(lama.status, "expired", "tagihan lama harus ditutup");
  assert.equal(
    semua.filter((t) => t.status === "pending").length,
    1,
    "hanya satu tagihan menggantung",
  );
  lulus("buat tagihan baru → tagihan lama jadi expired, sisa satu menggantung");

  /* Satu baris menunggu_bayar saja, walau tagihannya sudah dua kali dibuat. */
  const barisLangganan = await db.select().from(schema.subscriptions);
  assert.equal(
    barisLangganan.filter((l) => l.status === "menunggu_bayar").length,
    1,
    "ganti paket dua kali tetap satu baris menunggu bayar",
  );
  /* Langganan aktifnya TIDAK disentuh: warga tidak boleh kehilangan hak jemput
     di periode yang sudah dibayarnya hanya karena memilih paket lain. */
  assert.equal(
    barisLangganan.filter((l) => l.status === "aktif").length,
    1,
    "langganan berjalan tetap aktif selama tagihan baru belum dibayar",
  );
  lulus("ganti paket tidak mematikan langganan yang sedang berjalan");

  /* Dan yang sebenarnya dirasakan warga: hak jemputnya tidak hilang. Baris
     menunggu-bayar punya end_date paling belakang, jadi pemilih langganan yang
     cuma mengurutkan tanggal akan memungutnya dan menutup gerbang pesan. */
  r = await panggil("GET", "/api/langganan/saya", { sebagai: WARGA });
  assert.equal(r.body.data.status, "aktif", "yang dilaporkan harus yang berlaku");
  assert.equal(r.body.data.planName, "Bulanan Rumah Tangga");
  assert.equal(r.body.data.bolehPesan, true);
  r = await panggil("POST", "/api/pesanan", {
    sebagai: WARGA,
    body: pesan(alamat.id, slot.id),
  });
  assert.equal(r.status, 201, "masih boleh memesan walau ada tagihan menggantung");
  lulus("tagihan menggantung tidak menutup gerbang pesan");

  /* Perpanjang paket yang sama: periode disambung dari tanggal berakhir. */
  r = await panggil("POST", "/api/langganan/bayar", {
    sebagai: WARGA,
    body: { planId: paketLama.id, method: "qris" },
  });
  assert.equal(r.status, 201);
  assert.equal(r.body.data.perpanjangan, true);
  assert.equal(
    r.body.data.periodStart,
    tanggalISO(20),
    "periode baru disambung dari tanggal berakhir, bukan dari hari ini",
  );
  assert.equal(r.body.data.periodEnd, tanggalISO(50), "bulanan = 30 hari");
  lulus("perpanjang paket sama → periode disambung, sisa hari tidak hangus");

  /* Kanal: QRIS tanpa pilihan aplikasi, e-wallet & VA wajib dengan kanal. */
  assert.equal(
    (await panggil("POST", "/api/langganan/bayar", {
      sebagai: WARGA,
      body: { planId: paketLain.id, method: "qris", channel: "GoPay" },
    })).status,
    422,
  );
  assert.equal(
    (await panggil("POST", "/api/langganan/bayar", {
      sebagai: WARGA,
      body: { planId: paketLain.id, method: "ewallet" },
    })).status,
    422,
  );
  lulus("QRIS menolak kanal; e-wallet tanpa kanal ditolak");

  /* Paket yang ditarik tertutup untuk warga yang belum memakainya. */
  r = await panggil("POST", "/api/langganan/bayar", {
    sebagai: WARGA,
    body: { planId: paketDitarik.id, method: "qris" },
  });
  assert.equal(r.status, 409);
  assert.match(r.body.pesan, /tidak ditawarkan/);
  lulus("paket yang ditarik → 409 untuk warga yang belum memakainya");

  assert.equal(
    (await panggil("POST", "/api/langganan/bayar", {
      sebagai: WARGA,
      body: {
        planId: "99999999-9999-9999-9999-999999999999",
        method: "qris",
      },
    })).status,
    404,
  );
  assert.equal(
    (await panggil("POST", "/api/langganan/bayar", {
      body: { planId: paketLain.id, method: "qris" },
    })).status,
    401,
  );
  lulus("paket tak dikenal → 404; tanpa identitas → 401");
  await klien.close();
}

/* --- penyedia pembayaran --- */
{
  /* Tanpa kunci Midtrans, tidak ada tagihan yang dibuat. Gagal TERTUTUP:
     penyedia tiruan di produksi akan menandai lunas tanpa uang masuk. */
  const alat = await siapkan(null);
  await alat.db
    .insert(alat.schema.users)
    .values({ id: WARGA, fullName: "Bu Rina", phone: "0811" });
  const { paket } = await berlangganan(alat.db, alat.schema, WARGA, {
    status: "kedaluwarsa",
  });

  const r = await alat.panggil("POST", "/api/langganan/bayar", {
    sebagai: WARGA,
    body: { planId: paket.id, method: "qris" },
  });
  assert.equal(r.status, 503, "tanpa penyedia harus 503, bukan tagihan pending");
  assert.equal(
    (await alat.db.select().from(alat.schema.payments)).length,
    0,
    "tidak boleh meninggalkan tagihan yang tak pernah bisa dibayar",
  );
  lulus("tanpa kunci penyedia → 503 dan nol tagihan tertinggal");
  await alat.klien.close();
}

{
  /* Penyedia menolak: tagihan tercatat gagal DENGAN sebabnya — itu yang
     dibaca warga di layar riwayat dan dibawa ke pengurus RW. */
  const ditolak = {
    tagih: async () => {
      throw new GalatBayar("Saldo GoPay tidak cukup.");
    },
    batalkan: async () => true,
  };
  const alat = await siapkan(ditolak);
  await alat.db
    .insert(alat.schema.users)
    .values({ id: WARGA, fullName: "Bu Rina", phone: "0811" });
  const { paket } = await berlangganan(alat.db, alat.schema, WARGA, {
    status: "kedaluwarsa",
  });

  const r = await alat.panggil("POST", "/api/langganan/bayar", {
    sebagai: WARGA,
    body: { planId: paket.id, method: "ewallet", channel: "GoPay" },
  });
  assert.equal(r.status, 502, "penyedia bermasalah bukan salah warga");
  const [tagihan] = await alat.db.select().from(alat.schema.payments);
  assert.equal(tagihan.status, "failed");
  assert.equal(tagihan.failureReason, "Saldo GoPay tidak cukup.");
  assert.equal(tagihan.paidAt, null, "yang gagal tidak boleh bertanggal bayar");
  lulus("penyedia menolak → 502, tagihan failed menyimpan sebabnya");
  await alat.klien.close();
}

{
  /* Kanal yang tidak dilayani Core API ditolak SEBELUM menulis, jadi riwayat
     warga tidak dipenuhi tagihan gagal karena salah pilih. */
  const alat = await siapkan();
  await alat.db
    .insert(alat.schema.users)
    .values({ id: WARGA, fullName: "Bu Rina", phone: "0811" });
  const { paket } = await berlangganan(alat.db, alat.schema, WARGA, {
    status: "kedaluwarsa",
  });

  const r = await alat.panggil("POST", "/api/langganan/bayar", {
    sebagai: WARGA,
    body: { planId: paket.id, method: "ewallet", channel: "DANA" },
  });
  assert.equal(r.status, 422);
  assert.match(r.body.pesan, /QRIS/, "arahkan ke jalan yang bisa dipakai");
  assert.equal(
    (await alat.db.select().from(alat.schema.payments)).length,
    0,
    "salah pilih kanal tidak meninggalkan tagihan gagal",
  );
  lulus("kanal tak dilayani (DANA) → 422 sebelum menulis, nol tagihan");

  /* Yang dilayani: instruksi bayarnya ikut terkirim dan provider_ref tersimpan
     sebagai kunci idempoten webhook. */
  const ok = await alat.panggil("POST", "/api/langganan/bayar", {
    sebagai: WARGA,
    body: { planId: paket.id, method: "va_bank", channel: "BCA" },
  });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.data.vaNumber, "8277081234567890");
  assert.equal(ok.body.data.qrUrl, null);
  const [tagihan] = await alat.db.select().from(alat.schema.payments);
  assert.equal(tagihan.providerRef, `MT-${ok.body.data.code}`);
  lulus("kanal dilayani → instruksi bayar terkirim, provider_ref tersimpan");
  await alat.klien.close();
}

/* --- tanpa identitas --- */
{
  const { panggil, klien } = await skenario();
  const r = await panggil("GET", "/api/langganan/saya");
  assert.equal(r.status, 401);
  lulus("GET /langganan/saya tanpa identitas → 401");
  await klien.close();
}

/* --- status: periode berjalan dikirim utuh --- */
{
  const { panggil, klien } = await skenario({
    mulai: tanggalISO(-10),
    sampai: tanggalISO(20),
  });
  const r = await panggil("GET", "/api/langganan/saya", { sebagai: WARGA });
  assert.equal(r.status, 200);
  /* Layar status mencetak rentangnya, jadi dua-duanya harus ada — tanpa
     startDate layar cuma bisa menduga dari siklus paket. */
  assert.equal(r.body.data.startDate, tanggalISO(-10));
  assert.equal(r.body.data.endDate, tanggalISO(20));
  assert.equal(r.body.data.autoRenew, false);
  lulus("GET /langganan/saya mengirim startDate + endDate periode berjalan");
  await klien.close();
}

/* --- perpanjang otomatis --- */
{
  const alat = await skenario();
  const { panggil, klien, db, schema, langganan } = alat;

  let r = await panggil("PUT", "/api/langganan/perpanjang-otomatis", {
    sebagai: WARGA,
    body: { aktif: true },
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.autoRenew, true);
  /* Yang berubah harus baris langganan yang BERLAKU, bukan baris lain. */
  assert.equal(r.body.data.id, langganan!.langganan.id);

  r = await panggil("GET", "/api/langganan/saya", { sebagai: WARGA });
  assert.equal(r.body.data.autoRenew, true);
  lulus("PUT perpanjang-otomatis menyala → terbaca di status");

  r = await panggil("PUT", "/api/langganan/perpanjang-otomatis", {
    sebagai: WARGA,
    body: { aktif: false },
  });
  assert.equal(r.body.data.autoRenew, false);
  lulus("PUT perpanjang-otomatis mati lagi");

  /* Warga lain tidak boleh tersenggol. */
  const LAIN = "22222222-2222-2222-2222-222222222222";
  await db
    .insert(schema.users)
    .values({ id: LAIN, fullName: "Pak Budi", phone: "0812" });
  r = await panggil("PUT", "/api/langganan/perpanjang-otomatis", {
    sebagai: LAIN,
    body: { aktif: true },
  });
  assert.equal(r.status, 404);
  lulus("warga tanpa langganan → 404, bukan menyetel langganan orang lain");

  r = await panggil("PUT", "/api/langganan/perpanjang-otomatis", {
    body: { aktif: true },
  });
  assert.equal(r.status, 401);
  lulus("PUT perpanjang-otomatis tanpa identitas → 401");
  await klien.close();
}

/* --- perpanjang otomatis menempel ke langganan yang berlaku, bukan ke
       baris menunggu bayar yang periodenya berakhir paling belakang --- */
{
  const alat = await skenario();
  const { panggil, klien, db, schema, langganan } = alat;
  const [menunggu] = await db
    .insert(schema.subscriptions)
    .values({
      userId: WARGA,
      planId: langganan!.paket.id,
      status: "menunggu_bayar",
      startDate: tanggalISO(20),
      endDate: tanggalISO(50),
    })
    .returning();

  const r = await panggil("PUT", "/api/langganan/perpanjang-otomatis", {
    sebagai: WARGA,
    body: { aktif: true },
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.id, langganan!.langganan.id);
  assert.notEqual(r.body.data.id, menunggu.id);
  lulus("sakelar menempel ke langganan berlaku, bukan ke tagihan menggantung");
  await klien.close();
}

/* --- riwayat & detail pembayaran --- */
{
  const alat = await skenario();
  const { panggil, klien, db, schema, langganan } = alat;
  const umum = {
    userId: WARGA,
    subscriptionId: langganan!.langganan.id,
    planId: langganan!.paket.id,
    amount: 45000,
    periodStart: tanggalISO(-40),
    periodEnd: tanggalISO(-10),
  };

  const [lunasLama] = await db
    .insert(schema.payments)
    .values({
      ...umum,
      code: "PY-INV-1001",
      method: "qris",
      status: "paid",
      paidAt: new Date("2026-10-01T03:00:00Z"),
      createdAt: new Date("2026-10-01T02:00:00Z"),
    })
    .returning();
  const [gagal] = await db
    .insert(schema.payments)
    .values({
      ...umum,
      code: "PY-INV-1002",
      method: "ewallet",
      channel: "GoPay",
      status: "failed",
      failureReason: "Saldo GoPay tidak cukup.",
      createdAt: new Date("2026-10-15T02:00:00Z"),
    })
    .returning();
  const [lunasBaru] = await db
    .insert(schema.payments)
    .values({
      ...umum,
      code: "PY-INV-1003",
      method: "va_bank",
      channel: "BCA",
      status: "paid",
      paidAt: new Date("2026-11-01T03:00:00Z"),
      createdAt: new Date("2026-11-01T02:00:00Z"),
    })
    .returning();
  /* Dua yang TIDAK boleh muncul: satu masih dibayar, satu ditinggalkan. */
  const [menggantung] = await db
    .insert(schema.payments)
    .values({ ...umum, code: "PY-INV-1004", method: "qris", status: "pending" })
    .returning();
  await db.insert(schema.payments).values({
    ...umum,
    code: "PY-INV-1005",
    method: "qris",
    status: "expired",
  });

  let r = await panggil("GET", "/api/langganan/tagihan", { sebagai: WARGA });
  assert.equal(r.status, 200);
  assert.deepEqual(
    r.body.data.map((t: any) => t.code),
    ["PY-INV-1003", "PY-INV-1002", "PY-INV-1001"],
    "terbaru lebih dulu; pending & expired tidak ikut",
  );
  lulus("GET /langganan/tagihan: hanya lunas & gagal, terbaru lebih dulu");

  /* Kanal bayar dirangkai jadi satu kalimat seperti yang dibaca warga. */
  assert.deepEqual(
    r.body.data.map((t: any) => t.method),
    ["Transfer BCA", "GoPay", "QRIS"],
  );
  lulus("label kanal bayar: QRIS / GoPay / Transfer BCA");

  const [baru, tidakJadi] = r.body.data;
  assert.equal(baru.status, "lunas");
  assert.equal(baru.planName, "Bulanan Rumah Tangga");
  assert.equal(baru.amount, 45000);
  assert.equal(baru.failureReason, undefined);
  assert.equal(baru.paidAt, "2026-11-01T03:00:00.000Z");
  assert.equal(tidakJadi.status, "gagal");
  assert.equal(tidakJadi.failureReason, "Saldo GoPay tidak cukup.");
  /* Tagihan gagal tidak punya tanggal bayar; yang dicetak kapan percobaannya. */
  assert.equal(tidakJadi.paidAt, "2026-10-15T02:00:00.000Z");
  lulus("bentuk baris cocok dengan yang dibaca layar riwayat & kuitansi");

  r = await panggil("GET", `/api/langganan/tagihan/${lunasLama.id}`, {
    sebagai: WARGA,
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.code, "PY-INV-1001");
  assert.equal(r.body.data.method, "QRIS");
  assert.equal(r.body.data.periodStart, tanggalISO(-40));
  assert.equal(r.body.data.periodEnd, tanggalISO(-10));
  lulus("GET /langganan/tagihan/:id mengirim satu struk utuh");

  r = await panggil("GET", `/api/langganan/tagihan/${gagal.id}`, {
    sebagai: WARGA,
  });
  assert.equal(r.body.data.failureReason, "Saldo GoPay tidak cukup.");
  lulus("detail tagihan gagal menyebut sebabnya");

  /* Tagihan yang masih dibayar tidak punya struk. */
  r = await panggil("GET", `/api/langganan/tagihan/${menggantung.id}`, {
    sebagai: WARGA,
  });
  assert.equal(r.status, 404);
  lulus("tagihan pending → 404, bukan struk untuk uang yang belum masuk");

  /* Warga lain: 404, bukan 403 — keberadaannya pun tidak dibocorkan. */
  const LAIN = "33333333-3333-3333-3333-333333333333";
  await db
    .insert(schema.users)
    .values({ id: LAIN, fullName: "Pak Dadang", phone: "0813" });
  r = await panggil("GET", `/api/langganan/tagihan/${lunasBaru.id}`, {
    sebagai: LAIN,
  });
  assert.equal(r.status, 404);
  r = await panggil("GET", "/api/langganan/tagihan", { sebagai: LAIN });
  assert.deepEqual(r.body.data, []);
  lulus("tagihan warga lain → 404 dan tidak muncul di daftarnya");

  r = await panggil("GET", "/api/langganan/tagihan");
  assert.equal(r.status, 401);
  r = await panggil("GET", `/api/langganan/tagihan/${lunasBaru.id}`);
  assert.equal(r.status, 401);
  lulus("riwayat & detail tagihan tanpa identitas → 401");

  r = await panggil("GET", "/api/langganan/tagihan/bukan-uuid", {
    sebagai: WARGA,
  });
  assert.equal(r.status, 422);
  lulus("id bukan uuid → 422");
  await klien.close();
}

/* --- kuitansi bukti pembayaran --- */
{
  const alat = await skenario();
  const { klien, db, schema, app, langganan } = alat;
  const umum = {
    userId: WARGA,
    subscriptionId: langganan!.langganan.id,
    planId: langganan!.paket.id,
    amount: 45000,
    periodStart: "2026-10-02",
    periodEnd: "2026-11-01",
  };
  const [lunas] = await db
    .insert(schema.payments)
    .values({
      ...umum,
      code: "PY-INV-2001",
      method: "va_bank",
      channel: "BCA",
      status: "paid",
      paidAt: new Date("2026-10-02T03:00:00Z"),
    })
    .returning();
  const [gagal] = await db
    .insert(schema.payments)
    .values({
      ...umum,
      code: "PY-INV-2002",
      method: "ewallet",
      channel: "GoPay",
      status: "failed",
      failureReason: "Saldo GoPay tidak cukup.",
      createdAt: new Date("2026-10-03T03:00:00Z"),
    })
    .returning();
  const [menggantung] = await db
    .insert(schema.payments)
    .values({ ...umum, code: "PY-INV-2003", method: "qris", status: "pending" })
    .returning();

  /** Kuitansi itu berkas, bukan JSON — jadi dibaca mentah. */
  const unduh = (id: string, sebagai?: string) =>
    app.handle(
      new Request(`http://local/api/langganan/tagihan/${id}/kuitansi`, {
        headers: sebagai ? { "x-user-id": sebagai } : {},
      }),
    );

  let res = await unduh(lunas.id, WARGA);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type")!, /^text\/plain/);
  assert.equal(
    res.headers.get("content-disposition"),
    'attachment; filename="kuitansi-PY-INV-2001.txt"',
  );
  const teks = await res.text();
  assert.match(teks, /^KUITANSI LANGGANAN\nPilah Yuk\n\n/);
  assert.match(teks, /Kode {6}: PY-INV-2001/);
  assert.match(teks, /Paket {5}: Bulanan Rumah Tangga/);
  /* Nominal dari basis data, dirupiahkan di server — ini angka yang dicocokkan
     pengurus, jadi tidak boleh ikut keadaan layar. */
  assert.match(teks, /Jumlah {4}: Rp\s?45\.000/);
  assert.match(teks, /Cara bayar: Transfer BCA/);
  assert.match(teks, /Masa {6}: 2 Oktober 2026 sampai 1 November 2026/);
  assert.match(teks, /Status {4}: Lunas/);
  assert.doesNotMatch(teks, /Sebab/);
  lulus("kuitansi lunas: lampiran teks, angka & tanggal dari basis data");

  /* Zona Jakarta, bukan zona mesin server: 03:00 UTC = 10:00 WIB, tanggal
     tetap 2 Oktober walau servernya berjalan di UTC. */
  assert.match(teks, /Tanggal {3}: 2 Oktober 2026/);
  lulus("tanggal kuitansi dihitung di zona Jakarta");

  res = await unduh(gagal.id, WARGA);
  assert.equal(res.status, 200);
  const teksGagal = await res.text();
  assert.match(teksGagal, /Status {4}: Gagal/);
  assert.match(teksGagal, /Sebab {5}: Saldo GoPay tidak cukup\./);
  /* "Tanggal" pada tagihan gagal akan dibaca sebagai bukti sudah membayar. */
  assert.match(teksGagal, /Dicoba {4}: 3 Oktober 2026/);
  assert.doesNotMatch(teksGagal, /Tanggal/);
  lulus("kuitansi gagal menyebut sebab & kapan percobaannya, bukan 'Tanggal'");

  /* Belum dibayar → tidak ada kuitansi. */
  res = await unduh(menggantung.id, WARGA);
  assert.equal(res.status, 404);
  lulus("kuitansi tagihan pending → 404, bukan bukti uang yang belum masuk");

  const LAIN = "44444444-4444-4444-4444-444444444444";
  await db
    .insert(schema.users)
    .values({ id: LAIN, fullName: "Bu Siti", phone: "0814" });
  res = await unduh(lunas.id, LAIN);
  assert.equal(res.status, 404);
  res = await unduh(lunas.id);
  assert.equal(res.status, 401);
  lulus("kuitansi warga lain → 404; tanpa identitas → 401");
  await klien.close();
}

console.log("\nSemua pemeriksaan API langganan lulus.");
