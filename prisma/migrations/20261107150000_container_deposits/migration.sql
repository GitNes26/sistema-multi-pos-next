-- Importe de envases / garantía por producto, cobro con la venta y libro de movimientos.
ALTER TABLE `products` ADD COLUMN `depositAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE `sales` ADD COLUMN `depositCharged` DECIMAL(12, 2) NOT NULL DEFAULT 0;

CREATE TABLE `deposit_entries` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `locationId` VARCHAR(191) NOT NULL,
  `kind` VARCHAR(10) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `productName` VARCHAR(191) NOT NULL,
  `quantity` INTEGER NOT NULL,
  `unitAmount` DECIMAL(12, 2) NOT NULL,
  `amount` DECIMAL(12, 2) NOT NULL,
  `saleId` VARCHAR(191) NULL,
  `cashSessionId` VARCHAR(191) NULL,
  `customerId` VARCHAR(191) NULL,
  `userId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `deposit_entries_organizationId_locationId_createdAt_idx`(`organizationId`, `locationId`, `createdAt`),
  INDEX `deposit_entries_organizationId_productId_kind_idx`(`organizationId`, `productId`, `kind`),
  INDEX `deposit_entries_cashSessionId_kind_idx`(`cashSessionId`, `kind`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `deposit_entries` ADD CONSTRAINT `deposit_entries_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
