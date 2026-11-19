-- An old catalog form default wrote product_type = 'FINISHED_GOODS'; the schema's real
-- value is 'FINISHED_GARMENT'. Normalise existing rows so every finished style is sellable.
UPDATE "products" SET "product_type" = 'FINISHED_GARMENT' WHERE "product_type" = 'FINISHED_GOODS';
