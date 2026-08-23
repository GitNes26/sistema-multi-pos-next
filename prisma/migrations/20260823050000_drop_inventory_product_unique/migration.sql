-- Create a simple index for the FK constraint before dropping the unique index
CREATE INDEX `inventory_productId_idx` ON `inventory`(`productId`);

-- Now drop the unique index that prevented multiple variants per product
DROP INDEX `inventory_productId_locationId_locationType_key` ON `inventory`;
