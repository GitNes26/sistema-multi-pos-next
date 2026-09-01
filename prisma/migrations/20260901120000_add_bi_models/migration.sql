-- CreateEnum
CREATE TYPE `TransferStatus` AS ENUM ('pending', 'in_transit', 'received', 'cancelled');

-- CreateEnum
CREATE TYPE `CommissionStatus` AS ENUM ('pending', 'approved', 'paid');

-- CreateEnum
CREATE TYPE `CustomerSegmentType` AS ENUM ('vip', 'regular', 'at_risk', 'dormant', 'new', 'coupon_hunter');

-- CreateTable
CREATE TABLE `daily_sales_summaries` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `locationId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `salesCount` INTEGER NOT NULL DEFAULT 0,
    `grossSales` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `returnsTotal` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `netSales` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `discountTotal` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `taxTotal` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `tipTotal` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `posSales` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `portalSales` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `pickupSales` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `deliverySales` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `cashPayments` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `cardPayments` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `creditPayments` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `onlinePayments` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `ticketAverage` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `totalItems` INTEGER NOT NULL DEFAULT 0,
    `upt` DECIMAL(8, 2) NOT NULL DEFAULT 0,
    `pointsEarned` INTEGER NOT NULL DEFAULT 0,
    `pointsRedeemed` INTEGER NOT NULL DEFAULT 0,
    `pointsRedemptionValue` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `uniqueCustomers` INTEGER NOT NULL DEFAULT 0,
    `newCustomers` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `daily_sales_summaries_orgId_date_idx`(`organizationId`, `date`),
    UNIQUE INDEX `daily_sales_summaries_organizationId_locationId_date_key`(`organizationId`, `locationId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hourly_sales_snapshots` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `locationId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `hour` INTEGER NOT NULL,
    `salesCount` INTEGER NOT NULL DEFAULT 0,
    `netSales` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `totalItems` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `hourly_sales_snapshots_organizationId_locationId_date_hour_key`(`organizationId`, `locationId`, `date`, `hour`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_pairs` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `productIdA` VARCHAR(191) NOT NULL,
    `productIdB` VARCHAR(191) NOT NULL,
    `coOccurrences` INTEGER NOT NULL DEFAULT 0,
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `product_pairs_organizationId_productIdA_productIdB_key`(`organizationId`, `productIdA`, `productIdB`),
    INDEX `product_pairs_orgId_cooccurrences_idx`(`organizationId`, `coOccurrences` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_snapshots` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `locationId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `variantId` VARCHAR(191) NULL,
    `date` DATE NOT NULL,
    `quantityAtCost` DECIMAL(14, 4) NOT NULL DEFAULT 0,
    `valueAtCost` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `valueAtRetail` DECIMAL(14, 2) NOT NULL DEFAULT 0,

    INDEX `inventory_snapshots_orgId_date_idx`(`organizationId`, `date`),
    UNIQUE INDEX `inventory_snapshots_organizationId_locationId_productId_variantId_key`(`organizationId`, `locationId`, `productId`, `variantId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transfers` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `fromLocationId` VARCHAR(191) NOT NULL,
    `toLocationId` VARCHAR(191) NOT NULL,
    `status` ENUM('pending', 'in_transit', 'received', 'cancelled') NOT NULL DEFAULT 'pending',
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,

    INDEX `transfers_organizationId_status_idx`(`organizationId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transfer_items` (
    `id` VARCHAR(191) NOT NULL,
    `transferId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `variantId` VARCHAR(191) NULL,
    `quantity` DECIMAL(14, 4) NOT NULL,
    `receivedQty` DECIMAL(14, 4) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_commissions` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `saleId` VARCHAR(191) NULL,
    `period` DATE NOT NULL,
    `baseSalary` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `commissionRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `commissionAmt` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `salesTotal` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `status` ENUM('pending', 'approved', 'paid') NOT NULL DEFAULT 'pending',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `employee_commissions_organizationId_employeeId_saleId_key`(`organizationId`, `employeeId`, `saleId`),
    INDEX `employee_commissions_orgId_period_idx`(`organizationId`, `period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_segments` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `segment` ENUM('vip', 'regular', 'at_risk', 'dormant', 'new', 'coupon_hunter') NOT NULL,
    `score` INTEGER NOT NULL DEFAULT 0,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NULL,

    UNIQUE INDEX `customer_segments_organizationId_customerId_segment_key`(`organizationId`, `customerId`, `segment`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `daily_sales_summaries` ADD CONSTRAINT `daily_sales_summaries_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_sales_summaries` ADD CONSTRAINT `daily_sales_summaries_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hourly_sales_snapshots` ADD CONSTRAINT `hourly_sales_snapshots_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hourly_sales_snapshots` ADD CONSTRAINT `hourly_sales_snapshots_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_pairs` ADD CONSTRAINT `product_pairs_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_pairs` ADD CONSTRAINT `product_pairs_productIdA_fkey` FOREIGN KEY (`productIdA`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_pairs` ADD CONSTRAINT `product_pairs_productIdB_fkey` FOREIGN KEY (`productIdB`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_snapshots` ADD CONSTRAINT `inventory_snapshots_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_snapshots` ADD CONSTRAINT `inventory_snapshots_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_snapshots` ADD CONSTRAINT `inventory_snapshots_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transfers` ADD CONSTRAINT `transfers_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transfers` ADD CONSTRAINT `transfers_fromLocationId_fkey` FOREIGN KEY (`fromLocationId`) REFERENCES `locations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transfers` ADD CONSTRAINT `transfers_toLocationId_fkey` FOREIGN KEY (`toLocationId`) REFERENCES `locations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transfer_items` ADD CONSTRAINT `transfer_items_transferId_fkey` FOREIGN KEY (`transferId`) REFERENCES `transfers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transfer_items` ADD CONSTRAINT `transfer_items_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_commissions` ADD CONSTRAINT `employee_commissions_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_commissions` ADD CONSTRAINT `employee_commissions_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_commissions` ADD CONSTRAINT `employee_commissions_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_segments` ADD CONSTRAINT `customer_segments_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_segments` ADD CONSTRAINT `customer_segments_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
