CREATE TYPE "public"."peran_pengguna" AS ENUM('warga', 'pengurus');--> statement-breakpoint
CREATE TYPE "public"."siklus_tagihan" AS ENUM('mingguan', 'bulanan');--> statement-breakpoint
CREATE TYPE "public"."status_langganan" AS ENUM('aktif', 'kedaluwarsa', 'menunggu_bayar');--> statement-breakpoint
CREATE TYPE "public"."status_pickup" AS ENUM('menunggu', 'dijemput', 'selesai', 'batal');--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text NOT NULL,
	"full_address" text NOT NULL,
	"landmark" text,
	"rw_channel_id" uuid,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pickup_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pickup_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"estimated_weight_kg" numeric(6, 2)
);
--> statement-breakpoint
CREATE TABLE "pickups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"user_id" uuid NOT NULL,
	"address_id" uuid NOT NULL,
	"channel_id" uuid,
	"pickup_date" date NOT NULL,
	"time_slot_id" uuid NOT NULL,
	"status" "status_pickup" DEFAULT 'menunggu' NOT NULL,
	"total_weight_kg" numeric(6, 2),
	"officer_name" text,
	"proof_url" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pickups_berat_tidak_negatif" CHECK ("pickups"."total_weight_kg" is null or "pickups"."total_weight_kg" >= 0)
);
--> statement-breakpoint
CREATE TABLE "rw_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"rt_number" text,
	"rw_number" text,
	"area_code" text NOT NULL,
	"schedule_info" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"billing_cycle" "siklus_tagihan" NOT NULL,
	"price" integer NOT NULL,
	"pickup_quota" smallint NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "subscription_plans_harga_wajar" CHECK ("subscription_plans"."price" >= 0),
	CONSTRAINT "subscription_plans_kuota_positif" CHECK ("subscription_plans"."pickup_quota" > 0)
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"status" "status_langganan" DEFAULT 'menunggu_bayar' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"auto_renew" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_periode_urut" CHECK ("subscriptions"."end_date" >= "subscriptions"."start_date")
);
--> statement-breakpoint
CREATE TABLE "time_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"note" text,
	"capacity" smallint DEFAULT 20 NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"channel_id" uuid,
	CONSTRAINT "time_slots_kapasitas_positif" CHECK ("time_slots"."capacity" > 0),
	CONSTRAINT "time_slots_jam_urut" CHECK ("time_slots"."end_time" > "time_slots"."start_time")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"email" text,
	"role" "peran_pengguna" DEFAULT 'warga' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_punya_kontak" CHECK ("users"."phone" is not null or "users"."email" is not null)
);
--> statement-breakpoint
CREATE TABLE "waste_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"handling_tip" text
);
--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_rw_channel_id_rw_channels_id_fk" FOREIGN KEY ("rw_channel_id") REFERENCES "public"."rw_channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickup_items" ADD CONSTRAINT "pickup_items_pickup_id_pickups_id_fk" FOREIGN KEY ("pickup_id") REFERENCES "public"."pickups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickup_items" ADD CONSTRAINT "pickup_items_category_id_waste_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."waste_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickups" ADD CONSTRAINT "pickups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickups" ADD CONSTRAINT "pickups_address_id_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."addresses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickups" ADD CONSTRAINT "pickups_channel_id_rw_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."rw_channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickups" ADD CONSTRAINT "pickups_time_slot_id_time_slots_id_fk" FOREIGN KEY ("time_slot_id") REFERENCES "public"."time_slots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rw_channels" ADD CONSTRAINT "rw_channels_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_channel_id_rw_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."rw_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "addresses_user_id_idx" ON "addresses" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "addresses_satu_utama_idx" ON "addresses" USING btree ("user_id") WHERE "addresses"."is_default";--> statement-breakpoint
CREATE UNIQUE INDEX "pickup_items_unik_idx" ON "pickup_items" USING btree ("pickup_id","category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pickups_code_idx" ON "pickups" USING btree ("code");--> statement-breakpoint
CREATE INDEX "pickups_user_dibuat_idx" ON "pickups" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "pickups_channel_tanggal_idx" ON "pickups" USING btree ("channel_id","pickup_date");--> statement-breakpoint
CREATE INDEX "pickups_kuota_idx" ON "pickups" USING btree ("pickup_date","time_slot_id","channel_id");--> statement-breakpoint
CREATE INDEX "rw_channels_area_code_idx" ON "rw_channels" USING btree ("area_code");--> statement-breakpoint
CREATE INDEX "subscriptions_user_idx" ON "subscriptions" USING btree ("user_id","end_date" desc);--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_satu_aktif_idx" ON "subscriptions" USING btree ("user_id") WHERE "subscriptions"."status" = 'aktif';--> statement-breakpoint
CREATE INDEX "time_slots_channel_urut_idx" ON "time_slots" USING btree ("channel_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_idx" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "waste_categories_slug_idx" ON "waste_categories" USING btree ("slug");