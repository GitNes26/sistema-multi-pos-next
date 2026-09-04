-- DropForeignKey
ALTER TABLE `customer_addresses` DROP FOREIGN KEY `customer_addresses_customerId_fkey`;

-- DropIndex
DROP INDEX `customer_addresses_customerId_fkey` ON `customer_addresses`;

-- AlterTable
ALTER TABLE `cash_sessions` ADD COLUMN `systemCash` DECIMAL(12, 2) NULL;

-- AlterTable
ALTER TABLE `employees` ADD COLUMN `paymentFrequency` VARCHAR(191) NOT NULL DEFAULT 'biweekly',
    ADD COLUMN `salaryAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `salaryType` VARCHAR(191) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE `memberships` ADD COLUMN `roleId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `order_items` ADD COLUMN `extraPrice` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `itemStatus` ENUM('pending', 'preparing', 'ready', 'served') NOT NULL DEFAULT 'pending',
    ADD COLUMN `selectedOptions` JSON NULL;

-- AlterTable
ALTER TABLE `orders` ADD COLUMN `tableId` VARCHAR(191) NULL,
    MODIFY `paymentMethod` ENUM('cash', 'card', 'wallet', 'other', 'points', 'credit') NULL;

-- AlterTable
ALTER TABLE `organizations` ADD COLUMN `businessMode` ENUM('retail', 'food_service', 'services', 'rental', 'hybrid') NOT NULL DEFAULT 'retail';

-- AlterTable
ALTER TABLE `product_option_values` ADD COLUMN `extraPrice` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `imageUrl` VARCHAR(191) NULL,
    ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `product_options` ADD COLUMN `maxSelect` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `minSelect` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `required` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `promotions` ADD COLUMN `descriptionFinal` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `publications` ADD COLUMN `metadata` JSON NULL;

-- AlterTable
ALTER TABLE `sale_items` ADD COLUMN `extraPrice` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `notes` VARCHAR(191) NULL,
    ADD COLUMN `selectedOptions` JSON NULL;

-- AlterTable
ALTER TABLE `sale_payments` MODIFY `method` ENUM('cash', 'card', 'wallet', 'other', 'points', 'credit') NOT NULL;

-- AlterTable
ALTER TABLE `sales` MODIFY `tip` DECIMAL(12, 2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `branch_delivery_policies` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `pickupEnabled` BOOLEAN NOT NULL DEFAULT true,
    `pickupMinAmount` DECIMAL(12, 2) NULL,
    `pickupFee` DECIMAL(12, 2) NULL DEFAULT 0,
    `pickupFeeEnabled` BOOLEAN NOT NULL DEFAULT false,
    `pickupScheduleJson` TEXT NULL,
    `deliveryEnabled` BOOLEAN NOT NULL DEFAULT false,
    `deliveryMinAmount` DECIMAL(12, 2) NULL,
    `deliveryFee` DECIMAL(12, 2) NULL DEFAULT 0,
    `deliveryFeeEnabled` BOOLEAN NOT NULL DEFAULT false,
    `deliveryScheduleJson` TEXT NULL,
    `deliveryRadiusKm` DECIMAL(5, 2) NULL,
    `deliveryEstimatedMins` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `branch_delivery_policies_branchId_key`(`branchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `credit_policies` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `creditEnabled` BOOLEAN NOT NULL DEFAULT false,
    `defaultLimit` DECIMAL(12, 2) NULL,
    `maxDaysToPay` INTEGER NOT NULL DEFAULT 30,
    `requireApproval` BOOLEAN NOT NULL DEFAULT true,
    `allowPartialPayments` BOOLEAN NOT NULL DEFAULT true,
    `interestRate` DECIMAL(5, 4) NULL,
    `notifyBeforeDays` INTEGER NOT NULL DEFAULT 3,

    UNIQUE INDEX `credit_policies_organizationId_key`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_credits` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `creditLimit` DECIMAL(12, 2) NULL,
    `currentBalance` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `customer_credits_customerId_key`(`customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `credit_transactions` (
    `id` VARCHAR(191) NOT NULL,
    `creditId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `balanceAfter` DECIMAL(12, 2) NOT NULL,
    `description` VARCHAR(191) NULL,
    `referenceType` VARCHAR(191) NULL,
    `referenceId` VARCHAR(191) NULL,
    `dueDate` DATETIME(3) NULL,
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_combos` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `imageUrl` VARCHAR(191) NULL,
    `comboPrice` DECIMAL(12, 2) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `combo_items` (
    `id` VARCHAR(191) NOT NULL,
    `comboId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `variantId` VARCHAR(191) NULL,
    `quantity` DECIMAL(12, 3) NOT NULL DEFAULT 1,
    `extraPrice` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `position` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tables` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `locationId` VARCHAR(191) NULL,
    `number` INTEGER NOT NULL,
    `name` VARCHAR(191) NULL,
    `capacity` INTEGER NOT NULL DEFAULT 4,
    `status` ENUM('free', 'occupied', 'reserved', 'cleaning') NOT NULL DEFAULT 'free',
    `qrToken` VARCHAR(191) NULL,
    `posX` INTEGER NULL,
    `posY` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tables_qrToken_key`(`qrToken`),
    UNIQUE INDEX `tables_organizationId_number_key`(`organizationId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `table_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `tableId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endedAt` DATETIME(3) NULL,
    `notes` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sale_returns` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `saleId` VARCHAR(191) NOT NULL,
    `locationId` VARCHAR(191) NOT NULL,
    `cashSessionId` VARCHAR(191) NULL,
    `employeeId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NULL,
    `returnType` ENUM('exchange', 'refund', 'coupon', 'points') NOT NULL,
    `status` ENUM('pending', 'approved', 'completed', 'rejected') NOT NULL DEFAULT 'pending',
    `reason` VARCHAR(191) NULL,
    `subtotal` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `tax` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `notes` VARCHAR(191) NULL,
    `exchangeSaleId` VARCHAR(191) NULL,
    `couponCode` VARCHAR(191) NULL,
    `couponAmount` DECIMAL(12, 2) NULL,
    `couponExpiresAt` DATETIME(3) NULL,
    `pointsAwarded` DECIMAL(12, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `sale_returns_organizationId_idx`(`organizationId`),
    INDEX `sale_returns_saleId_idx`(`saleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sale_return_items` (
    `id` VARCHAR(191) NOT NULL,
    `returnId` VARCHAR(191) NOT NULL,
    `saleItemId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NULL,
    `variantId` VARCHAR(191) NULL,
    `productName` VARCHAR(191) NOT NULL,
    `variantName` VARCHAR(191) NULL,
    `quantity` DECIMAL(12, 3) NOT NULL,
    `unitPrice` DECIMAL(12, 2) NOT NULL,
    `lineTotal` DECIMAL(12, 2) NOT NULL,
    `reason` VARCHAR(191) NULL,
    `restockable` BOOLEAN NOT NULL DEFAULT true,

    INDEX `sale_return_items_returnId_idx`(`returnId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `push_subscriptions` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `endpoint` VARCHAR(512) NOT NULL,
    `p256dh` VARCHAR(255) NOT NULL,
    `auth` VARCHAR(255) NOT NULL,
    `userAgent` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `push_subscriptions_userId_endpoint_key`(`userId`, `endpoint`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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

    INDEX `daily_sales_summaries_organizationId_date_idx`(`organizationId`, `date`),
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

    INDEX `product_pairs_organizationId_coOccurrences_idx`(`organizationId`, `coOccurrences` DESC),
    UNIQUE INDEX `product_pairs_organizationId_productIdA_productIdB_key`(`organizationId`, `productIdA`, `productIdB`),
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

    INDEX `inventory_snapshots_organizationId_date_idx`(`organizationId`, `date`),
    UNIQUE INDEX `inventory_snapshots_organizationId_locationId_productId_vari_key`(`organizationId`, `locationId`, `productId`, `variantId`, `date`),
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

    INDEX `employee_commissions_organizationId_period_idx`(`organizationId`, `period`),
    UNIQUE INDEX `employee_commissions_organizationId_employeeId_saleId_key`(`organizationId`, `employeeId`, `saleId`),
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
ALTER TABLE `memberships` ADD CONSTRAINT `memberships_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `branch_delivery_policies` ADD CONSTRAINT `branch_delivery_policies_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `locations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `credit_policies` ADD CONSTRAINT `credit_policies_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_credits` ADD CONSTRAINT `customer_credits_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_credits` ADD CONSTRAINT `customer_credits_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `credit_transactions` ADD CONSTRAINT `credit_transactions_creditId_fkey` FOREIGN KEY (`creditId`) REFERENCES `customer_credits`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `credit_transactions` ADD CONSTRAINT `credit_transactions_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `credit_transactions` ADD CONSTRAINT `credit_transactions_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_addresses` ADD CONSTRAINT `customer_addresses_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_combos` ADD CONSTRAINT `product_combos_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `combo_items` ADD CONSTRAINT `combo_items_comboId_fkey` FOREIGN KEY (`comboId`) REFERENCES `product_combos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `combo_items` ADD CONSTRAINT `combo_items_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `combo_items` ADD CONSTRAINT `combo_items_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `product_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_tableId_fkey` FOREIGN KEY (`tableId`) REFERENCES `tables`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tables` ADD CONSTRAINT `tables_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tables` ADD CONSTRAINT `tables_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `table_sessions` ADD CONSTRAINT `table_sessions_tableId_fkey` FOREIGN KEY (`tableId`) REFERENCES `tables`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `table_sessions` ADD CONSTRAINT `table_sessions_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_returns` ADD CONSTRAINT `sale_returns_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_returns` ADD CONSTRAINT `sale_returns_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_returns` ADD CONSTRAINT `sale_returns_cashSessionId_fkey` FOREIGN KEY (`cashSessionId`) REFERENCES `cash_sessions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_returns` ADD CONSTRAINT `sale_returns_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_returns` ADD CONSTRAINT `sale_returns_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_return_items` ADD CONSTRAINT `sale_return_items_returnId_fkey` FOREIGN KEY (`returnId`) REFERENCES `sale_returns`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `push_subscriptions` ADD CONSTRAINT `push_subscriptions_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `push_subscriptions` ADD CONSTRAINT `push_subscriptions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

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

