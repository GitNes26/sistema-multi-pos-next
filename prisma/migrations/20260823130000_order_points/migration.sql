-- Add points redemption to orders
ALTER TABLE `orders` ADD COLUMN `pointsRedeemed` DECIMAL(12, 2) NULL DEFAULT 0;
ALTER TABLE `orders` ADD COLUMN `pointsValue` DECIMAL(12, 2) NULL DEFAULT 0;
