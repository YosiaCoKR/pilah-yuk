CREATE TABLE "waste_guide_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"note" text,
	"is_highlighted" boolean DEFAULT false NOT NULL,
	"mistaken_for_id" uuid,
	CONSTRAINT "waste_guide_items_dikira_beda" CHECK ("waste_guide_items"."mistaken_for_id" is null or "waste_guide_items"."mistaken_for_id" <> "waste_guide_items"."category_id")
);
--> statement-breakpoint
ALTER TABLE "waste_guide_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "waste_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "waste_categories" ADD COLUMN "sort_order" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "waste_guide_items" ADD CONSTRAINT "waste_guide_items_category_id_waste_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."waste_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waste_guide_items" ADD CONSTRAINT "waste_guide_items_mistaken_for_id_waste_categories_id_fk" FOREIGN KEY ("mistaken_for_id") REFERENCES "public"."waste_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "waste_guide_items_nama_idx" ON "waste_guide_items" USING btree ("name");--> statement-breakpoint
CREATE INDEX "waste_guide_items_kategori_idx" ON "waste_guide_items" USING btree ("category_id","is_highlighted");--> statement-breakpoint
CREATE INDEX "waste_guide_items_dikira_idx" ON "waste_guide_items" USING btree ("mistaken_for_id");--> statement-breakpoint
CREATE INDEX "waste_categories_urut_idx" ON "waste_categories" USING btree ("sort_order");--> statement-breakpoint
CREATE POLICY "waste_categories_baca_semua" ON "waste_categories" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "waste_guide_items_baca_semua" ON "waste_guide_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);