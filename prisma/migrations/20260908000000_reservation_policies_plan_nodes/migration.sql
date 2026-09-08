-- Políticas de reservación de mesas (por organización) y nodos fijos del
-- plano de la sala (entradas/salidas/baños/cocina) dibujables en el editor.
CREATE TABLE `plan_nodes` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `locationId` VARCHAR(191) NULL,
    `roomId` VARCHAR(191) NULL,
    `kind` ENUM('entrance', 'exit', 'restroom', 'kitchen', 'bar_station', 'cashier', 'other') NOT NULL DEFAULT 'other',
    `label` VARCHAR(191) NULL,
    `posX` INTEGER NOT NULL,
    `posY` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `plan_nodes_organizationId_idx`(`organizationId`),
    UNIQUE INDEX `plan_nodes_id_key`(`id`),
    CONSTRAINT `plan_nodes_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `plan_nodes_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `plan_nodes_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `table_rooms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `reservation_policies` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `minNoticeMinutes` INTEGER NOT NULL DEFAULT 60,
    `maxAdvanceDays` INTEGER NOT NULL DEFAULT 60,
    `maxGuests` INTEGER NOT NULL DEFAULT 20,
    `maxReservationsPerDay` INTEGER NULL,
    `durationMinutes` INTEGER NOT NULL DEFAULT 120,
    `slotMinutes` INTEGER NOT NULL DEFAULT 30,
    `requireConfirmation` BOOLEAN NOT NULL DEFAULT false,
    `notesText` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `reservation_policies_organizationId_key`(`organizationId`),
    UNIQUE INDEX `reservation_policies_id_key`(`id`),
    CONSTRAINT `reservation_policies_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
