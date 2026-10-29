CREATE TABLE "recurring_schedule_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_id" uuid NOT NULL,
	"category_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"address_id" uuid NOT NULL,
	"time_slot_id" uuid NOT NULL,
	"days" smallint[] NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"is_paused" boolean DEFAULT false NOT NULL,
	"paused_until" date,
	"reminder_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_schedules_hari_sah" CHECK ("recurring_schedules"."days" <@ array[0,1,2,3,4,5,6]::smallint[]
          and cardinality("recurring_schedules"."days") between 1 and 7),
	CONSTRAINT "recurring_schedules_periode_urut" CHECK ("recurring_schedules"."end_date" is null or "recurring_schedules"."end_date" >= "recurring_schedules"."start_date"),
	CONSTRAINT "recurring_schedules_jeda_konsisten" CHECK ("recurring_schedules"."paused_until" is null or "recurring_schedules"."is_paused")
);
--> statement-breakpoint
ALTER TABLE "pickups" ADD COLUMN "recurring_schedule_id" uuid;--> statement-breakpoint
ALTER TABLE "recurring_schedule_items" ADD CONSTRAINT "recurring_schedule_items_schedule_id_recurring_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."recurring_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_schedule_items" ADD CONSTRAINT "recurring_schedule_items_category_id_waste_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."waste_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_schedules" ADD CONSTRAINT "recurring_schedules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_schedules" ADD CONSTRAINT "recurring_schedules_address_id_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."addresses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_schedules" ADD CONSTRAINT "recurring_schedules_time_slot_id_time_slots_id_fk" FOREIGN KEY ("time_slot_id") REFERENCES "public"."time_slots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recurring_schedule_items_unik_idx" ON "recurring_schedule_items" USING btree ("schedule_id","category_id");--> statement-breakpoint
CREATE INDEX "recurring_schedules_user_idx" ON "recurring_schedules" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recurring_schedules_alamat_slot_idx" ON "recurring_schedules" USING btree ("address_id","time_slot_id");--> statement-breakpoint
CREATE INDEX "recurring_schedules_aktif_idx" ON "recurring_schedules" USING btree ("start_date") WHERE not "recurring_schedules"."is_paused";--> statement-breakpoint
ALTER TABLE "pickups" ADD CONSTRAINT "pickups_recurring_schedule_id_recurring_schedules_id_fk" FOREIGN KEY ("recurring_schedule_id") REFERENCES "public"."recurring_schedules"("id") ON DELETE set null ON UPDATE no action;