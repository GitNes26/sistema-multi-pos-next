-- AlterTable: Add GPS coordinates to customers
ALTER TABLE `customers` ADD COLUMN `latitude` DECIMAL(10, 8) NULL;
ALTER TABLE `customers` ADD COLUMN `longitude` DECIMAL(11, 8) NULL;
