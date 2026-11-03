CREATE TYPE "public"."metode_bayar" AS ENUM('qris', 'ewallet', 'va_bank');--> statement-breakpoint
CREATE TYPE "public"."status_pembayaran" AS ENUM('pending', 'paid', 'failed', 'expired');--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"user_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"method" "metode_bayar" NOT NULL,
	"channel" text,
	"provider_ref" text,
	"status" "status_pembayaran" DEFAULT 'pending' NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"paid_at" timestamp with time zone,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_jumlah_wajar" CHECK ("payments"."amount" >= 0),
	CONSTRAINT "payments_periode_urut" CHECK ("payments"."period_end" >= "payments"."period_start"),
	CONSTRAINT "payments_lunas_bertanggal" CHECK (("payments"."status" = 'paid') = ("payments"."paid_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_code_idx" ON "payments" USING btree ("code");--> statement-breakpoint
CREATE INDEX "payments_user_dibuat_idx" ON "payments" USING btree ("user_id","created_at" desc);--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_ref_idx" ON "payments" USING btree ("provider_ref") WHERE "payments"."provider_ref" is not null;--> statement-breakpoint
CREATE POLICY "payments_baca_milik_sendiri" ON "payments" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("payments"."user_id" = (select auth.uid()));