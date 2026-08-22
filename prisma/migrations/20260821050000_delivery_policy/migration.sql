-- AlterEnum: MySQL enum — redefinir el tipo completo
ALTER TABLE `orders` MODIFY COLUMN `status` ENUM('pending','confirmed','preparing','ready','in_transit','delivered','cancelled') NOT NULL DEFAULT 'pending';

-- AlterTable: Add deliveryFee to orders
ALTER TABLE `orders` ADD COLUMN `deliveryFee` DECIMAL(12, 2) DEFAULT 0;

-- CreateTable: DeliveryPolicy
CREATE TABLE `delivery_policies` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `pickupEnabled` BOOLEAN NOT NULL DEFAULT true,
    `pickupMinAmount` DECIMAL(12, 2),
    `pickupFee` DECIMAL(12, 2) DEFAULT 0,
    `pickupFeeEnabled` BOOLEAN NOT NULL DEFAULT false,
    `pickupScheduleJson` TEXT,
    `deliveryEnabled` BOOLEAN NOT NULL DEFAULT false,
    `deliveryMinAmount` DECIMAL(12, 2),
    `deliveryFee` DECIMAL(12, 2) DEFAULT 0,
    `deliveryFeeEnabled` BOOLEAN NOT NULL DEFAULT false,
    `deliveryScheduleJson` TEXT,
    `deliveryRadiusKm` DECIMAL(5, 2),
    `deliveryEstimatedMins` INTEGER,
    `createdAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` TIMESTAMP(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `delivery_policies_organizationId_key` ON `delivery_policies`(`organizationId`);

-- AddForeignKey
ALTER TABLE `delivery_policies` ADD CONSTRAINT `delivery_policies_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
