import { addressById, slotById } from "@/lib/mock";
import { tanggalPanjang } from "@/lib/tanggal";
import type { Pickup } from "@/lib/types";
import { AksiBerkas } from "../aksi-berkas";

const kg = (n: number) =>
  n.toLocaleString("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

/** Tanda terima sebagai teks biasa — bisa dibaca di mana saja, termasuk WA. */
function teksBukti(pickup: Pickup, namaKategori: string[]) {
  const alamat = addressById(pickup.addressId);
  const slot = slotById(pickup.timeSlotId);
  return [
    "TANDA TERIMA PENGANGKUTAN SAMPAH",
    "Pilah Yuk",
    "",
    `Kode       : ${pickup.code}`,
    `Tanggal    : ${tanggalPanjang(pickup.pickupDate)}`,
    `Jam        : ${slot?.range ?? "-"}`,
    `Alamat     : ${alamat?.label} — ${alamat?.fullAddress}`,
    `Channel    : ${alamat?.rwChannelName ?? "-"}`,
    `Petugas    : ${pickup.officerName ?? "-"}`,
    `Jenis      : ${namaKategori.join(", ")}`,
    `Berat total: ${kg(pickup.totalWeightKg ?? 0)} kg`,
    /* null, bukan "" — baris kosong di atas memang disengaja sebagai
       pemisah, jadi hanya baris opsional yang boleh hilang. */
    pickup.notes ? `Catatan    : ${pickup.notes}` : null,
    "",
    "Dokumen ini dibuat otomatis dari aplikasi Pilah Yuk.",
  ]
    .filter((b) => b !== null)
    .join("\n");
}

export function AksiBukti({ pickup }: { pickup: Pickup }) {
  const namaKategori = pickup.categories.map(
    (k) => k.charAt(0).toUpperCase() + k.slice(1),
  );
  return (
    <AksiBerkas
      judul={`Bukti pengangkutan ${pickup.code}`}
      namaBerkas={`bukti-${pickup.code}.txt`}
      teks={teksBukti(pickup, namaKategori)}
    />
  );
}
