-- Add paidAt to orders for in-store payment tracking
ALTER TABLE `orders` ADD COLUMN `paidAt` DATETIME(3) NULL;
