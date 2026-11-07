-- Fase 0 de verticales (autolavado/barbería): vehículos del cliente, lugares de atención, política y historial de citas.

-- AlterTable
ALTER TABLE `appointments` ADD COLUMN `assetId` VARCHAR(191) NULL,
    ADD COLUMN `checkedInAt` DATETIME(3) NULL,
    ADD COLUMN `rescheduleCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `stationId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `customer_assets` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'vehicle',
    `label` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NULL,
    `brand` VARCHAR(191) NULL,
    `model` VARCHAR(191) NULL,
    `color` VARCHAR(191) NULL,
    `size` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `attributes` JSON NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `customer_assets_organizationId_customerId_idx`(`organizationId`, `customerId`),
    INDEX `customer_assets_organizationId_reference_idx`(`organizationId`, `reference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_stations` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `locationId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'bay',
    `defaultEmployeeId` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `service_stations_organizationId_locationId_isActive_idx`(`organizationId`, `locationId`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `appointment_policies` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `enforceBusinessHours` BOOLEAN NOT NULL DEFAULT true,
    `minNoticeMinutes` INTEGER NOT NULL DEFAULT 30,
    `maxAdvanceDays` INTEGER NOT NULL DEFAULT 60,
    `rescheduleMinNoticeMinutes` INTEGER NOT NULL DEFAULT 120,
    `maxReschedules` INTEGER NULL DEFAULT 2,
    `toleranceMinutes` INTEGER NOT NULL DEFAULT 15,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `appointment_policies_organizationId_key`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `appointment_events` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `appointmentId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `fromStartsAt` DATETIME(3) NULL,
    `toStartsAt` DATETIME(3) NULL,
    `fromStatus` VARCHAR(191) NULL,
    `toStatus` VARCHAR(191) NULL,
    `actorUserId` VARCHAR(191) NULL,
    `reason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `appointment_events_appointmentId_createdAt_idx`(`appointmentId`, `createdAt`),
    INDEX `appointment_events_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `appointments_organizationId_status_startsAt_idx` ON `appointments`(`organizationId`, `status`, `startsAt`);

-- CreateIndex
CREATE INDEX `appointments_stationId_startsAt_idx` ON `appointments`(`stationId`, `startsAt`);

-- AddForeignKey
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_stationId_fkey` FOREIGN KEY (`stationId`) REFERENCES `service_stations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `customer_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_assets` ADD CONSTRAINT `customer_assets_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_assets` ADD CONSTRAINT `customer_assets_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_stations` ADD CONSTRAINT `service_stations_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_stations` ADD CONSTRAINT `service_stations_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_stations` ADD CONSTRAINT `service_stations_defaultEmployeeId_fkey` FOREIGN KEY (`defaultEmployeeId`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointment_policies` ADD CONSTRAINT `appointment_policies_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointment_events` ADD CONSTRAINT `appointment_events_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointment_events` ADD CONSTRAINT `appointment_events_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `appointments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointment_events` ADD CONSTRAINT `appointment_events_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
