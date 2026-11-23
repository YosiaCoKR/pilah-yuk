ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "users_baca_diri_sendiri" ON "users" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("users"."id" = (select auth.uid()));--> statement-breakpoint
-- Profil aplikasi lahir bersamaan dengan akun Supabase Auth.
--
-- Pendaftaran memanggil `auth.signUp` dengan metadata { full_name, role };
-- trigger ini menyalinnya ke `public.users` dalam transaksi yang sama, jadi
-- tidak pernah ada akun yang bisa masuk tapi tak punya profil (yang membuat
-- semua route menjawab "pengguna tidak ditemukan").
--
-- - SECURITY DEFINER + search_path kosong: dijalankan oleh pemilik fungsi,
--   bukan oleh peran yang sedang mendaftar, dan tidak bisa dibajak lewat
--   objek bernama sama di skema lain. Karena itu semua nama ditulis lengkap.
-- - Peran selain 'pengurus' jatuh ke 'warga'. Meng-cast metadata mentah ke
--   enum akan menggagalkan PENDAFTARANNYA kalau klien mengirim nilai aneh.
-- - Nomor HP disimpan Supabase sebagai 62xxx; aplikasi memakai 08xx (sama
--   dengan `normalkanHp` di frontend), supaya pencarian nomor tidak meleset.
-- - ponytail: tanpa FK ke auth.users — menghapus akun Auth tidak ikut
--   menghapus profil. Tambahkan FK + ON DELETE CASCADE saat fitur hapus akun
--   dibuat (perlu menyemai auth.users di semua pemeriksaan).
CREATE OR REPLACE FUNCTION public.buat_profil_pengguna()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  hp text := nullif(regexp_replace(coalesce(new.phone, ''), '[^0-9]', '', 'g'), '');
BEGIN
  IF hp LIKE '62%' THEN
    hp := '0' || substr(hp, 3);
  END IF;

  INSERT INTO public.users (id, full_name, phone, email, role)
  VALUES (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Warga'),
    hp,
    nullif(new.email, ''),
    CASE WHEN new.raw_user_meta_data ->> 'role' = 'pengurus'
      THEN 'pengurus'::public.peran_pengguna
      ELSE 'warga'::public.peran_pengguna
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS buat_profil_pengguna ON auth.users;--> statement-breakpoint
CREATE TRIGGER buat_profil_pengguna
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.buat_profil_pengguna();
