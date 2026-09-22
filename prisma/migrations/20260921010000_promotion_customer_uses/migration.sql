CREATE TABLE `promotion_customer_uses` (
  `promotionId` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `usesCount` INTEGER NOT NULL DEFAULT 0,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`promotionId`, `customerId`),
  INDEX `promotion_customer_uses_organizationId_customerId_idx` (`organizationId`, `customerId`),
  CONSTRAINT `promotion_customer_uses_promotionId_fkey` FOREIGN KEY (`promotionId`) REFERENCES `promotions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `promotion_customer_uses_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `promotion_customer_uses_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `orders`
  ADD COLUMN `promotionId` VARCHAR(191) NULL,
  ADD INDEX `orders_promotionId_idx` (`promotionId`),
  ADD CONSTRAINT `orders_promotionId_fkey` FOREIGN KEY (`promotionId`) REFERENCES `promotions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
