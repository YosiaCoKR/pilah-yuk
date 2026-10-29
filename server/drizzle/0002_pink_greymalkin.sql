ALTER TABLE "pickup_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pickups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "pickup_items_ikut_induk" ON "pickup_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from "pickups" p
        where p.id = "pickup_items"."pickup_id" and p.user_id = (select auth.uid())
      ));--> statement-breakpoint
CREATE POLICY "pickups_baca_milik_sendiri" ON "pickups" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("pickups"."user_id" = (select auth.uid()));