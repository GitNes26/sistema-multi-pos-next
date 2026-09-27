-- DropForeignKey
ALTER TABLE `transfers` DROP FOREIGN KEY `transfers_fromLocationId_fkey`;

-- DropForeignKey
ALTER TABLE `transfers` DROP FOREIGN KEY `transfers_toLocationId_fkey`;

-- DropIndex
DROP INDEX `transfers_fromLocationId_fkey` ON `transfers`;

-- DropIndex
DROP INDEX `transfers_toLocationId_fkey` ON `transfers`;

-- AlterTable
ALTER TABLE `transfer_items` ADD COLUMN `inventoryId` VARCHAR(191) NULL,
    ADD COLUMN `receiveNote` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `transfers` ADD COLUMN `dispatchedAt` DATETIME(3) NULL,
    ADD COLUMN `dispatchedById` VARCHAR(191) NULL,
    ADD COLUMN `driverName` VARCHAR(191) NULL,
    ADD COLUMN `expectedAt` DATETIME(3) NULL,
    ADD COLUMN `fromLocationType` ENUM('location', 'cedis') NOT NULL DEFAULT 'location',
    ADD COLUMN `hasDiscrepancy` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `lastLat` DECIMAL(10, 8) NULL,
    ADD COLUMN `lastLng` DECIMAL(11, 8) NULL,
    ADD COLUMN `lastLocationAt` DATETIME(3) NULL,
    ADD COLUMN `number` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `receiveNotes` TEXT NULL,
    ADD COLUMN `receivedAt` DATETIME(3) NULL,
    ADD COLUMN `receivedById` VARCHAR(191) NULL,
    ADD COLUMN `requestedById` VARCHAR(191) NULL,
    ADD COLUMN `toLocationType` ENUM('location', 'cedis') NOT NULL DEFAULT 'location',
    ADD COLUMN `vehicle` VARCHAR(191) NULL,
    MODIFY `status` ENUM('pending', 'preparing', 'in_transit', 'received', 'cancelled') NOT NULL DEFAULT 'pending',
    MODIFY `notes` TEXT NULL;

-- CreateTable
CREATE TABLE `transfer_track_points` (
    `id` VARCHAR(191) NOT NULL,
    `transferId` VARCHAR(191) NOT NULL,
    `lat` DECIMAL(10, 8) NOT NULL,
    `lng` DECIMAL(11, 8) NOT NULL,
    `accuracy` DOUBLE NULL,
    `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `transfer_track_points_transferId_recordedAt_idx`(`transferId`, `recordedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `transfers_organizationId_number_idx` ON `transfers`(`organizationId`, `number`);

-- AddForeignKey
ALTER TABLE `transfer_track_points` ADD CONSTRAINT `transfer_track_points_transferId_fkey` FOREIGN KEY (`transferId`) REFERENCES `transfers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

