-- AlterTable
ALTER TABLE `inventory_revision_items` ADD COLUMN `productId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `inventory_revision_items` ADD CONSTRAINT `inventory_revision_items_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
