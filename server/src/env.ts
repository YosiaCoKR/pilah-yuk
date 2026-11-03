function wajib(nama: string): string {
  const nilai = process.env[nama];
  if (!nilai) {
    throw new Error(
      `Env ${nama} belum diisi. Salin server/.env.example ke server/.env lalu lengkapi.`,
    );
  }
  return nilai;
}

export const env = {
  get databaseUrl() {
    return wajib("DATABASE_URL");
  },
  port: Number(process.env.PORT ?? 3001),
  get midtransServerKey() {
    return wajib("MIDTRANS_SERVER_KEY");
  },
  /* Sandbox sampai disetel eksplisit: salah arah ke produksi berarti menagih
     uang sungguhan dari warga saat mencoba-coba. */
  midtransProduksi: process.env.MIDTRANS_PRODUKSI === "1",
};
