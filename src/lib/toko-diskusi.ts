import { kirim } from "./kirim";

/** Utas baru di papan diskusi channel. */
export const kirimUtas = (channelId: string, isi: string) =>
  kirim("POST", `/api/channel/${channelId}/diskusi`, { isi });

/** Balasan menempel di akhir utasnya. */
export const kirimBalasan = (utasId: string, isi: string) =>
  kirim("POST", `/api/channel/diskusi/${utasId}/balasan`, { isi });
