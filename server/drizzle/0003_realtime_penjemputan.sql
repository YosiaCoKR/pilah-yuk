-- Siarkan perubahan status penjemputan lewat Supabase Realtime.
--
-- Tidak ada server WebSocket maupun endpoint polling yang ditulis sendiri:
-- Realtime membaca WAL Postgres, jadi satu UPDATE status dari aplikasi petugas
-- langsung sampai ke layar warga. Yang perlu dilakukan di sini hanya memasukkan
-- tabelnya ke publikasi yang dibaca Realtime.
--
-- REPLICA IDENTITY FULL wajib: tanpanya WAL hanya memuat kunci primer pada
-- UPDATE, sehingga (a) Realtime tidak bisa menguji kebijakan RLS atas baris itu
-- dan membuang kejadiannya, dan (b) saringan `id=eq.<pickup>` yang dipakai layar
-- warga tidak pernah cocok. Akibatnya status diam saja — gejala yang persis
-- sama dengan "Realtime tidak jalan".
ALTER TABLE "pickups" REPLICA IDENTITY FULL;--> statement-breakpoint
-- Dipagari: publikasi `supabase_realtime` adalah milik Supabase (tidak ada di
-- Postgres kosong), dan tabelnya bisa sudah terdaftar lewat dasbor. Dua-duanya
-- tidak boleh menggagalkan migrasi.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public' AND tablename = 'pickups'
    )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "public"."pickups";
  END IF;
END $$;
