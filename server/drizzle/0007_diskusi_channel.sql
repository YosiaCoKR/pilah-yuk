CREATE TABLE "channel_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"author_id" uuid,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_replies_isi_terisi" CHECK (length(btrim("channel_replies"."content")) > 0)
);
--> statement-breakpoint
ALTER TABLE "channel_replies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "channel_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"author_id" uuid,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_threads_isi_terisi" CHECK (length(btrim("channel_threads"."content")) > 0)
);
--> statement-breakpoint
ALTER TABLE "channel_threads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "channel_replies" ADD CONSTRAINT "channel_replies_thread_id_channel_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."channel_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_replies" ADD CONSTRAINT "channel_replies_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_threads" ADD CONSTRAINT "channel_threads_channel_id_rw_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."rw_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_threads" ADD CONSTRAINT "channel_threads_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "channel_replies_utas_dibuat_idx" ON "channel_replies" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "channel_threads_channel_dibuat_idx" ON "channel_threads" USING btree ("channel_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE POLICY "channel_replies_ikut_utas" ON "channel_replies" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from "channel_threads" u
        where u.id = "channel_replies"."thread_id" and ikut_channel(u.channel_id)
      ));--> statement-breakpoint
CREATE POLICY "channel_threads_baca_anggota" ON "channel_threads" AS PERMISSIVE FOR SELECT TO "authenticated" USING (ikut_channel("channel_threads"."channel_id"));