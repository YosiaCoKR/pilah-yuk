-- Profil baru dibuat saat nomor HP (atau email) TERVERIFIKASI, bukan saat
-- akun Auth dibuat.
--
-- Pendaftaran sekarang menunggu kode SMS. Kalau profil lahir saat INSERT,
-- orang yang mendaftar memakai nomor orang lain tetap meninggalkan profil —
-- dan pengingat jadwal ikut terkirim ke nomor yang bukan miliknya. Dengan
-- menunggu konfirmasi, hanya pemilik nomor yang pernah punya profil, dan
-- nama + peran yang dipakai adalah isian saat ia memverifikasi.
--
-- Fungsinya tetap `buat_profil_pengguna` (0012): ON CONFLICT DO NOTHING
-- membuat UPDATE berikutnya (ganti sandi, masuk ulang) tidak mengubah apa pun.
DROP TRIGGER IF EXISTS buat_profil_pengguna ON auth.users;--> statement-breakpoint
CREATE TRIGGER buat_profil_pengguna
  AFTER INSERT OR UPDATE OF phone_confirmed_at, email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (new.phone_confirmed_at IS NOT NULL OR new.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.buat_profil_pengguna();
