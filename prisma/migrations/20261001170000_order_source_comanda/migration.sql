-- AlterTable
ALTER TABLE `orders` ADD COLUMN `source` VARCHAR(12) NOT NULL DEFAULT 'portal',
    ADD COLUMN `serviceType` VARCHAR(12) NULL,
    ADD COLUMN `kitchenDoneAt` DATETIME(3) NULL;

-- Las órdenes de mesa existentes son comandas del POS.
UPDATE `orders` SET `source` = 'pos', `serviceType` = 'dine_in' WHERE `tableId` IS NOT NULL;

-- CreateIndex
CREATE INDEX `orders_organizationId_source_status_idx` ON `orders`(`organizationId`, `source`, `status`);
