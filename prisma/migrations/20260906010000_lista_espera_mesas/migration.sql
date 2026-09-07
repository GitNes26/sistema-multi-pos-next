-- CreateTable
CREATE TABLE `table_waitlist` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `locationId` VARCHAR(191) NULL,
    `customerId` VARCHAR(191) NULL,
    `guests` INTEGER NOT NULL DEFAULT 2,
    `status` ENUM('waiting', 'available', 'seated', 'cancelled') NOT NULL DEFAULT 'waiting',
    `availableAt` DATETIME(3) NULL,
    `availableTableId` VARCHAR(191) NULL,
    `seatedTableId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `table_waitlist_organizationId_status_idx`(`organizationId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `table_waitlist` ADD CONSTRAINT `table_waitlist_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `table_waitlist` ADD CONSTRAINT `table_waitlist_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `table_waitlist` ADD CONSTRAINT `table_waitlist_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `table_waitlist` ADD CONSTRAINT `table_waitlist_availableTableId_fkey` FOREIGN KEY (`availableTableId`) REFERENCES `tables`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `table_waitlist` ADD CONSTRAINT `table_waitlist_seatedTableId_fkey` FOREIGN KEY (`seatedTableId`) REFERENCES `tables`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;