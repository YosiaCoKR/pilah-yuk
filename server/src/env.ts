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
};
