CREATE TABLE "channel_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"author_id" uuid,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_posts_judul_terisi" CHECK (length(btrim("channel_posts"."title")) > 0),
	CONSTRAINT "channel_posts_isi_terisi" CHECK (length(btrim("channel_posts"."content")) > 0)
);
--> statement-breakpoint
ALTER TABLE "channel_posts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "channel_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"time_slot_id" uuid NOT NULL,
	"days" smallint[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_schedules_hari_sah" CHECK ("channel_schedules"."days" <@ array[0,1,2,3,4,5,6]::smallint[]
          and cardinality("channel_schedules"."days") between 1 and 7)
);
--> statement-breakpoint
ALTER TABLE "channel_schedules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "channel_members" ADD COLUMN "jabatan" text;--> statement-breakpoint
ALTER TABLE "channel_posts" ADD CONSTRAINT "channel_posts_channel_id_rw_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."rw_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_posts" ADD CONSTRAINT "channel_posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_schedules" ADD CONSTRAINT "channel_schedules_channel_id_rw_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."rw_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_schedules" ADD CONSTRAINT "channel_schedules_time_slot_id_time_slots_id_fk" FOREIGN KEY ("time_slot_id") REFERENCES "public"."time_slots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "channel_posts_channel_dibuat_idx" ON "channel_posts" USING btree ("channel_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "channel_schedules_unik_idx" ON "channel_schedules" USING btree ("channel_id","time_slot_id");--> statement-breakpoint
ALTER TABLE "rw_channels" DROP COLUMN "schedule_info";--> statement-breakpoint
CREATE POLICY "channel_posts_baca_anggota" ON "channel_posts" AS PERMISSIVE FOR SELECT TO "authenticated" USING (ikut_channel("channel_posts"."channel_id"));--> statement-breakpoint
CREATE POLICY "channel_schedules_baca_semua" ON "channel_schedules" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);