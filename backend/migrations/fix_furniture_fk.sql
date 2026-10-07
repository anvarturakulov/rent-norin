ALTER TABLE furniture_orders DROP CONSTRAINT IF EXISTS "furniture_orders_enterpriseId_fkey";
ALTER TABLE furniture_orders ALTER COLUMN "enterpriseId" DROP NOT NULL;
