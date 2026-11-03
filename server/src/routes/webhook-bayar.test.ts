/**
 * Webhook pembayaran: pintu tempat "lunas" diputuskan.
 *
 * Yang dijaga di sini, berurutan sesuai akibatnya kalau jebol:
 * - tanda tangan palsu → siapa pun berlangganan gratis;
 * - notifikasi yang dikirim ulang → periode bertambah dua kali dari satu bayar;
 * - ganti paket → dua baris aktif, atau paket lama tidak pernah turun.
 *
 * Jalankan: npm run test:webhook
 */
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { tandaTangan } from "../pembayaran";
import { KUNCI_UJI, berlangganan, lulus, siapkan, tanggalISO } from "../test/bantu";

const WARGA = "11111111-1111-1111-1111-111111111111";

async function skenario(opsi: Parameters<typeof berlangganan>[3] = {}) {
  const alat = await siapkan();
  await alat.db
    .insert(alat.schema.users)
    .values({ id: WARGA, fullName: "Bu Rina", phone: "0811" });
  const { paket } = await berlangganan(alat.db, alat.schema, WARGA, opsi);
  return { ...alat, paket };
}

/** Notifikasi Midtrans yang tanda tangannya sah. */
const notifikasi = (
  orderId: string,
  amount: number,
  transactionStatus: string,
  tambahan: Record<string, string> = {},
) => {
  const gross = `${amount}.00`;
  return {
    order_id: orderId,
    status_code: "200",
    gross_amount: gross,
    signature_key: tandaTangan(orderId, "200", gross, KUNCI_UJI),
    transaction_status: transactionStatus,
    transaction_id: "MT-NOTIF-1",
    ...tambahan,
  };
};

const buatTagihan = async (
  panggil: Awaited<ReturnType<typeof siapkan>>["panggil"],
  planId: string,
) =>
  (
    await panggil("POST", "/api/langganan/bayar", {
      sebagai: WARGA,
      body: { planId, method: "qris" },
    })
  ).body.data;

/* --- tanda tangan --- */
{
  const { panggil, klien, paket } = await skenario({ status: "kedaluwarsa" });
  const tagihan = await buatTagihan(panggil, paket.id);

  /* Satu baris curl tanpa tanda tangan yang benar = langganan gratis. */
  let r = await panggil("POST", "/api/webhook/midtrans", {
    body: {
      order_id: tagihan.code,
      status_code: "200",
      gross_amount: `${tagihan.amount}.00`,
      signature_key: "palsu",
      transaction_status: "settlement",
    },
  });
  assert.equal(r.status, 401, "tanda tangan palsu harus ditolak");
  lulus("tanda tangan palsu → 401");

  /* Nominal diubah sedikit: tanda tangannya ikut berubah, jadi tidak cocok. */
  r = await panggil("POST", "/api/webhook/midtrans", {
    body: { ...notifikasi(tagihan.code, tagihan.amount, "settlement"), gross_amount: "1000.00" },
  });
  assert.equal(r.status, 401, "nominal yang diubah membatalkan tanda tangan");
  lulus("nominal diubah → tanda tangan tidak lagi cocok → 401");

  r = await panggil("POST", "/api/webhook/midtrans", {
    body: notifikasi("PY-INV-0000", tagihan.amount, "settlement"),
  });
  assert.equal(r.status, 404, "order_id tak dikenal jangan ditelan jadi sukses");
  lulus("order_id tak dikenal → 404");
  await klien.close();
}

/* --- langganan pertama / ganti paket jadi aktif --- */
{
  const { panggil, klien, db, schema, paket } = await skenario({
    status: "kedaluwarsa",
  });
  const tagihan = await buatTagihan(panggil, paket.id);

  let r = await panggil("POST", "/api/webhook/midtrans", {
    body: notifikasi(tagihan.code, tagihan.amount, "settlement"),
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.status, "paid");

  const [lunas] = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.code, tagihan.code));
  assert.equal(lunas.status, "paid");
  assert.ok(lunas.paidAt, "lunas harus bertanggal — struk tanpa tanggal bayar");
  lulus("settlement → tagihan lunas & bertanggal");

  r = await panggil("GET", "/api/langganan/saya", { sebagai: WARGA });
  assert.equal(r.body.data.status, "aktif", "langganan harus hidup sendiri");
  assert.equal(r.body.data.bolehPesan, true);
  assert.equal(r.body.data.endDate, tagihan.periodEnd);
  lulus("langganan jadi aktif otomatis, gerbang pesan terbuka");

  /* Midtrans PASTI mengirim ulang. Diproses dua kali = periode dua kali. */
  const sebelum = r.body.data.endDate;
  const ulang = await panggil("POST", "/api/webhook/midtrans", {
    body: notifikasi(tagihan.code, tagihan.amount, "settlement"),
  });
  assert.equal(ulang.status, 200, "kiriman ulang dijawab tenang, bukan galat");
  r = await panggil("GET", "/api/langganan/saya", { sebagai: WARGA });
  assert.equal(
    r.body.data.endDate,
    sebelum,
    "periode tidak boleh bertambah dua kali dari satu pembayaran",
  );
  assert.equal(
    (await db.select().from(schema.payments)).filter((t) => t.status === "paid")
      .length,
    1,
  );
  lulus("notifikasi dikirim ulang → tidak diproses dua kali");
  await klien.close();
}

/* --- perpanjang paket yang sama --- */
{
  const { panggil, klien, paket } = await skenario({
    status: "aktif",
    mulai: tanggalISO(-10),
    sampai: tanggalISO(20),
  });
  const tagihan = await buatTagihan(panggil, paket.id);
  assert.equal(tagihan.perpanjangan, true);

  await panggil("POST", "/api/webhook/midtrans", {
    body: notifikasi(tagihan.code, tagihan.amount, "settlement"),
  });
  const r = await panggil("GET", "/api/langganan/saya", { sebagai: WARGA });
  assert.equal(r.body.data.status, "aktif");
  assert.equal(
    r.body.data.endDate,
    tanggalISO(50),
    "perpanjangan menyambung dari tanggal berakhir, bukan dari hari ini",
  );
  lulus("perpanjangan lunas → tanggal berakhir bergeser, sisa hari utuh");
  await klien.close();
}

/* --- ganti paket: yang lama harus turun --- */
{
  const { panggil, klien, db, schema } = await skenario({
    status: "aktif",
    mulai: tanggalISO(-10),
    sampai: tanggalISO(20),
  });
  const [paketLain] = await db
    .insert(schema.subscriptionPlans)
    .values({
      name: "Bulanan Rumah Besar",
      billingCycle: "bulanan",
      price: 80_000,
      pickupQuota: 16,
    })
    .returning();

  const tagihan = await buatTagihan(panggil, paketLain.id);
  await panggil("POST", "/api/webhook/midtrans", {
    body: notifikasi(tagihan.code, tagihan.amount, "settlement"),
  });

  const baris = await db.select().from(schema.subscriptions);
  assert.equal(
    baris.filter((l) => l.status === "aktif").length,
    1,
    "tepat satu langganan aktif — index-nya akan menolak dua",
  );
  const [aktif] = baris.filter((l) => l.status === "aktif");
  assert.equal(aktif.planId, paketLain.id, "yang aktif harus paket baru");
  assert.equal(
    baris.filter((l) => l.status === "kedaluwarsa").length,
    1,
    "paket lama harus diturunkan, bukan dibiarkan aktif",
  );
  const r = await panggil("GET", "/api/langganan/saya", { sebagai: WARGA });
  assert.equal(r.body.data.planName, "Bulanan Rumah Besar");
  assert.equal(r.body.data.pickupQuota, 16);
  lulus("ganti paket lunas → paket baru aktif, paket lama turun");
  await klien.close();
}

/* --- gagal, kedaluwarsa, pending, dan penipuan --- */
{
  const { panggil, klien, db, schema, paket } = await skenario({
    status: "kedaluwarsa",
  });

  for (const [status, jadi, cocok] of [
    ["deny", "failed", /[Ss]aldo/],
    ["expire", "expired", /habis/],
  ] as const) {
    const tagihan = await buatTagihan(panggil, paket.id);
    const r = await panggil("POST", "/api/webhook/midtrans", {
      body: notifikasi(tagihan.code, tagihan.amount, status, {
        status_message: "Saldo tidak cukup.",
      }),
    });
    assert.equal(r.status, 200);
    const [baris] = await db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.code, tagihan.code));
    assert.equal(baris.status, jadi);
    assert.match(baris.failureReason!, cocok);
    assert.equal(baris.paidAt, null, "yang gagal tidak boleh bertanggal bayar");
  }
  /* Langganannya tetap menunggu bayar: warga bisa mencoba lagi tanpa
     kehilangan pilihan paketnya. */
  let r = await panggil("GET", "/api/langganan/saya", { sebagai: WARGA });
  assert.equal(r.body.data.bolehPesan, false);
  lulus("deny → failed, expire → expired, sebabnya tersimpan");

  /* capture tanpa fraud_status accept = jalur kartu yang ditolak FDS. */
  const kartu = await buatTagihan(panggil, paket.id);
  await panggil("POST", "/api/webhook/midtrans", {
    body: notifikasi(kartu.code, kartu.amount, "capture", {
      fraud_status: "deny",
    }),
  });
  const [barisKartu] = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.code, kartu.code));
  assert.equal(barisKartu.status, "failed", "capture + fraud deny bukan lunas");
  lulus("capture dengan fraud_status deny → gagal, bukan lunas");

  /* pending tidak menggerakkan apa pun. */
  const nunggu = await buatTagihan(panggil, paket.id);
  await panggil("POST", "/api/webhook/midtrans", {
    body: notifikasi(nunggu.code, nunggu.amount, "pending"),
  });
  const [barisNunggu] = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.code, nunggu.code));
  assert.equal(barisNunggu.status, "pending");
  r = await panggil("GET", "/api/langganan/saya", { sebagai: WARGA });
  assert.notEqual(r.body.data.status, "aktif");
  lulus("pending → tidak ada yang bergerak");
  await klien.close();
}

/* --- tagihan yang sudah ditinggalkan tidak boleh mengaktifkan apa pun ----- */

/*
  Eksploit yang pernah lolos di sini, berurutan:

  1. warga pilih paket murah  → tagihan A, QR-nya hidup di Midtrans;
  2. warga ganti ke paket mahal → A ditandai expired, baris langganan DITIMPA
     jadi paket mahal, tagihan B terbit;
  3. warga memindai QR A yang masih hidup dan membayar Rp45.000;
  4. webhook dulu hanya menolak tagihan yang sudah `paid`, jadi A lolos dan
     MENGAKTIFKAN baris langganan — yang isinya paket mahal.

  Hasilnya: bayar Rp45.000, dapat 16 jemput. Dua hal yang menahannya sekarang,
  dan dua-duanya diperiksa di bawah: tagihan lama dimatikan di penyedia, dan
  hanya tagihan `pending` yang boleh mengaktifkan langganan.
*/
{
  const { panggil, klien, db, schema, gateway, paket: murah } =
    await skenario({ status: "kedaluwarsa", kuota: 4 });
  const [mahal] = await db
    .insert(schema.subscriptionPlans)
    .values({
      name: "Bulanan Rumah Besar",
      billingCycle: "bulanan",
      price: 80_000,
      pickupQuota: 16,
    })
    .returning();

  const A = await buatTagihan(panggil, murah.id);
  const B = await buatTagihan(panggil, mahal.id);
  assert.notEqual(A.amount, B.amount);

  /* Lapis pertama: QR A dimatikan di penyedia, bukan cuma di basis data. */
  assert.ok(
    (gateway as unknown as { dimatikan: string[] }).dimatikan.includes(A.code),
    "tagihan yang ditinggalkan harus dibatalkan di penyedia juga",
  );
  lulus("ganti paket → tagihan lama dimatikan di penyedia");

  /* Lapis kedua: seandainya QR A tetap terbayar. */
  const r = await panggil("POST", "/api/webhook/midtrans", {
    body: notifikasi(A.code, A.amount, "settlement"),
  });
  assert.equal(r.status, 200, "dijawab tenang supaya Midtrans berhenti mengulang");
  assert.equal(r.body.data.perluDitinjau, true, "uang masuk harus ditandai");

  const saya = (await panggil("GET", "/api/langganan/saya", { sebagai: WARGA }))
    .body.data;
  assert.notEqual(saya.status, "aktif", "tagihan mati tidak mengaktifkan apa pun");
  assert.equal(saya.bolehPesan, false, "dan tidak membuka gerbang pesan");

  const [barisA] = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.code, A.code));
  assert.equal(barisA.status, "expired", "tidak boleh berubah jadi paid");
  assert.equal(barisA.paidAt, null);
  assert.match(
    barisA.failureReason!,
    /pengembalian dana/i,
    "uangnya nyata — harus ada jejak yang bisa dicari pengurus",
  );
  lulus("bayar tagihan yang ditinggalkan → nol langganan, ditandai perlu refund");

  /* Dan yang benar tetap jalan: bayar B memberi paket B, bukan paket lain. */
  await panggil("POST", "/api/webhook/midtrans", {
    body: notifikasi(B.code, B.amount, "settlement"),
  });
  const setelah = (
    await panggil("GET", "/api/langganan/saya", { sebagai: WARGA })
  ).body.data;
  assert.equal(setelah.status, "aktif");
  assert.equal(setelah.planName, "Bulanan Rumah Besar");
  assert.equal(setelah.price, 80_000, "paket yang aktif harus yang dibayar");
  lulus("bayar tagihan yang benar → paket itu yang aktif");
  await klien.close();
}

/* Paket yang diaktifkan diambil dari TAGIHAN, bukan dari baris langganan yang
   bisa sudah ditimpa pilihan lain. */
{
  const { panggil, klien, db, schema, paket: murah } = await skenario({
    status: "kedaluwarsa",
    kuota: 4,
  });
  const [mahal] = await db
    .insert(schema.subscriptionPlans)
    .values({
      name: "Bulanan Warung",
      billingCycle: "bulanan",
      price: 90_000,
      pickupQuota: 20,
    })
    .returning();

  const A = await buatTagihan(panggil, murah.id);
  /* Baris langganan ditimpa jadi paket mahal, tapi tagihan A tetap mencatat
     paket murah. Lalu A dipaksa kembali `pending` — meniru pembatalan di
     penyedia yang gagal, jalur paling berbahaya yang tersisa. */
  await buatTagihan(panggil, mahal.id);
  await db
    .update(schema.payments)
    .set({ status: "pending" })
    .where(eq(schema.payments.code, A.code));

  await panggil("POST", "/api/webhook/midtrans", {
    body: notifikasi(A.code, A.amount, "settlement"),
  });
  const saya = (await panggil("GET", "/api/langganan/saya", { sebagai: WARGA }))
    .body.data;
  assert.equal(saya.status, "aktif");
  assert.equal(
    saya.price,
    A.amount,
    `bayar Rp${A.amount} harus dapat paket Rp${A.amount}, bukan paket lain`,
  );
  assert.equal(saya.pickupQuota, 4, "kuota ikut paket yang dibayar");
  lulus("paket yang aktif diambil dari tagihan, bukan dari baris yang ditimpa");
  await klien.close();
}

console.log("\nSemua pemeriksaan webhook pembayaran lulus.");
