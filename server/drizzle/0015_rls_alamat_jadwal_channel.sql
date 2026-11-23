ALTER TABLE "addresses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "recurring_schedule_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "recurring_schedules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rw_channels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "time_slots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "addresses_baca_milik_sendiri" ON "addresses" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("addresses"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "recurring_schedule_items_ikut_induk" ON "recurring_schedule_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from "recurring_schedules" s
        where s.id = "recurring_schedule_items"."schedule_id" and s.user_id = (select auth.uid())
      ));--> statement-breakpoint
CREATE POLICY "recurring_schedules_baca_milik_sendiri" ON "recurring_schedules" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("recurring_schedules"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "rw_channels_baca_semua" ON "rw_channels" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "time_slots_baca_semua" ON "time_slots" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);