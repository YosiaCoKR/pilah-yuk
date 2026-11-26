import { kirim } from "./kirim";
import type { Address } from "./types";

/**
 * Aksi profil & alamat ke API. Aturan "tepat satu alamat utama" dijaga
 * server (PATCH/POST /api/alamat), jadi layar cukup membaca ulang.
 */

export type IsiAlamat = Pick<
  Address,
  "label" | "fullAddress" | "landmark" | "isDefault"
>;

/** `id` kosong = alamat baru. */
export const simpanAlamat = (isi: IsiAlamat, id?: string) =>
  kirim<Address>(
    id ? "PATCH" : "POST",
    id ? `/api/alamat/${id}` : "/api/alamat",
    {
      label: isi.label,
      fullAddress: isi.fullAddress,
      landmark: isi.landmark || undefined,
      isDefault: isi.isDefault,
    },
  );

export const hapusAlamat = (id: string) => kirim("DELETE", `/api/alamat/${id}`);

/** Hanya nama: nomor HP & email identitas akun, diganti lewat verifikasi. */
export const ubahNama = (fullName: string) =>
  kirim("PATCH", "/api/profil", { fullName });
