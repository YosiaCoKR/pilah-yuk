/** Jalankan: npm run test:langganan */
import assert from "node:assert/strict";
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
  lulus("kuota habis → bolehPesan false, alasan menyebut kuota");

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

/* --- tanpa identitas --- */
{
  const { panggil, klien } = await skenario();
  const r = await panggil("GET", "/api/langganan/saya");
  assert.equal(r.status, 401);
  lulus("GET /langganan/saya tanpa identitas → 401");
  await klien.close();
}

console.log("\nSemua pemeriksaan API langganan lulus.");
