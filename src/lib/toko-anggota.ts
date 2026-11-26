import { kirim } from "./kirim";

/** Permintaan gabung diterima pengurus. */
export const setujuiAnggota = (channelId: string, id: string) =>
  kirim("PUT", `/api/channel/${channelId}/anggota/${id}/setujui`);

/** Permintaan ditolak, atau anggota dikeluarkan. */
export const hapusAnggota = (channelId: string, id: string) =>
  kirim("DELETE", `/api/channel/${channelId}/anggota/${id}`);
