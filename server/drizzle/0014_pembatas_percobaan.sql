CREATE TABLE "percobaan_akun" (
	"kunci" text PRIMARY KEY NOT NULL,
	"jumlah" integer NOT NULL,
	"sampai" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "percobaan_akun" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "percobaan_akun_sampai_idx" ON "percobaan_akun" USING btree ("sampai");