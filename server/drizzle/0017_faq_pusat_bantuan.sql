CREATE TABLE "faqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic" text NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "faqs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "faqs_question_idx" ON "faqs" USING btree ("question");--> statement-breakpoint
CREATE INDEX "faqs_urut_idx" ON "faqs" USING btree ("sort_order");--> statement-breakpoint
CREATE POLICY "faqs_baca_semua" ON "faqs" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);