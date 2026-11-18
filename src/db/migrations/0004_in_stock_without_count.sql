ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "in_stock_without_count" boolean DEFAULT false NOT NULL;
