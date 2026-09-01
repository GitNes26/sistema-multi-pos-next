-- AlterTable: Agregar campo tip a orders y sales
ALTER TABLE `orders` ADD COLUMN `tip` DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE `sales` ADD COLUMN `tip` DECIMAL(12, 2) DEFAULT 0;
