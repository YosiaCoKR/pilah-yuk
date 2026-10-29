CREATE TYPE "public"."status_keanggotaan" AS ENUM('aktif', 'menunggu');--> statement-breakpoint
CREATE TABLE "channel_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "status_keanggotaan" DEFAULT 'menunggu' NOT NULL,
	"is_pengurus" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channel_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rw_channels" ADD COLUMN "kelurahan" text;--> statement-breakpoint
ALTER TABLE "rw_channels" ADD COLUMN "latitude" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "rw_channels" ADD COLUMN "longitude" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "channel_members" ADD CONSTRAINT "channel_members_channel_id_rw_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."rw_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_members" ADD CONSTRAINT "channel_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "channel_members_unik_idx" ON "channel_members" USING btree ("channel_id","user_id");--> statement-breakpoint
CREATE INDEX "channel_members_channel_status_idx" ON "channel_members" USING btree ("channel_id","status");--> statement-breakpoint
CREATE INDEX "channel_members_user_idx" ON "channel_members" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "rw_channels" ADD CONSTRAINT "rw_channels_titik_wajar" CHECK (("rw_channels"."latitude" is null and "rw_channels"."longitude" is null)
          or ("rw_channels"."latitude" is not null and "rw_channels"."longitude" is not null
              and "rw_channels"."latitude" between -90 and 90
              and "rw_channels"."longitude" between -180 and 180));--> statement-breakpoint
-- Apakah pemanggil anggota aktif channel ini?
--
-- SECURITY DEFINER dengan sengaja: kebijakan RLS di channel_members perlu
-- membaca channel_members, dan kebijakan yang menanyai tabelnya sendiri
-- ditolak Postgres sebagai rekursi. Fungsi ini melihat tabelnya di luar
-- kebijakan itu, lalu hanya mengembalikan boolean — tidak ada baris tetangga
-- yang ikut keluar.
--
-- `search_path = ''` + nama lengkap: tanpa itu, siapa pun yang bisa membuat
-- tabel di schema yang lebih dulu dicari bisa menyelipkan `channel_members`
-- tiruan, dan fungsi ini akan menjawab dari tabel palsu dengan hak pemiliknya.
CREATE OR REPLACE FUNCTION public.ikut_channel(ch uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.channel_members m
    WHERE m.channel_id = ch
      AND m.user_id = auth.uid()
      AND m.status = 'aktif'
  )
$$;--> statement-breakpoint
CREATE POLICY "channel_members_baca_sesama_anggota" ON "channel_members" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("channel_members"."user_id" = (select auth.uid())
        or ikut_channel("channel_members"."channel_id"));