ALTER TABLE "addresses" ADD COLUMN "latitude" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "longitude" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_titik_wajar" CHECK (("addresses"."latitude" is null and "addresses"."longitude" is null)
          or ("addresses"."latitude" is not null and "addresses"."longitude" is not null
              and "addresses"."latitude" between -90 and 90
              and "addresses"."longitude" between -180 and 180));