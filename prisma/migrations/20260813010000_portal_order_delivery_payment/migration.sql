-- FASE 13.6 — Dirección de entrega (con GPS) y método de pago en pedidos del portal.

-- AlterTable
ALTER TABLE `orders` ADD COLUMN `address` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `orders` ADD COLUMN `latitude` DECIMAL(10, 8) NULL;

-- AlterTable
ALTER TABLE `orders` ADD COLUMN `longitude` DECIMAL(11, 8) NULL;

-- AlterTable
ALTER TABLE `orders` ADD COLUMN `paymentMethod` ENUM('cash', 'card', 'wallet', 'other', 'points') NULL;

-- AlterTable
ALTER TABLE `orders` ADD COLUMN `paymentReference` VARCHAR(191) NULL;
