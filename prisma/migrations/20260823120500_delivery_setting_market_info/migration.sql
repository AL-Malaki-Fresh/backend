-- Adds the "Market Information" fields the dashboard's Settings page has
-- always had inputs for (name/email/phone/country/city) but never actually
-- persisted, since there was nowhere on the backend to store them.
ALTER TABLE "delivery_settings" ADD COLUMN "business_name" VARCHAR(150);
ALTER TABLE "delivery_settings" ADD COLUMN "business_email" VARCHAR(255);
ALTER TABLE "delivery_settings" ADD COLUMN "business_phone" VARCHAR(30);
ALTER TABLE "delivery_settings" ADD COLUMN "country" VARCHAR(100);
ALTER TABLE "delivery_settings" ADD COLUMN "city" VARCHAR(100);
