CREATE TABLE "feedbacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"pickup_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedbacks_rating_1_5" CHECK ("feedbacks"."rating" between 1 and 5),
	CONSTRAINT "feedbacks_komentar_wajar" CHECK ("feedbacks"."comment" is null or char_length("feedbacks"."comment") <= 500)
);
--> statement-breakpoint
ALTER TABLE "feedbacks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_pickup_id_pickups_id_fk" FOREIGN KEY ("pickup_id") REFERENCES "public"."pickups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "feedbacks_satu_per_pickup_idx" ON "feedbacks" USING btree ("pickup_id");--> statement-breakpoint
CREATE INDEX "feedbacks_user_dibuat_idx" ON "feedbacks" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE POLICY "feedbacks_baca_milik_sendiri" ON "feedbacks" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("feedbacks"."user_id" = (select auth.uid()));