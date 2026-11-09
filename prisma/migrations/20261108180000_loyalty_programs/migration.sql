-- Programas de fidelidad: tarjeta de visitas y paquetes prepagados (créditos canjeables en una venta).
CREATE TABLE `loyalty_programs` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `presetKey` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `visitsRequired` INTEGER NULL,
    `packUses` INTEGER NULL,
    `packProductId` VARCHAR(191) NULL,
    `targetProductIds` JSON NOT NULL,
    `discountPercent` INTEGER NOT NULL DEFAULT 100,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `loyalty_programs_organizationId_isActive_idx`(`organizationId`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `loyalty_cards` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `programId` VARCHAR(191) NOT NULL,
    `visits` INTEGER NOT NULL DEFAULT 0,
    `credits` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `loyalty_cards_organizationId_customerId_idx`(`organizationId`, `customerId`),
    UNIQUE INDEX `loyalty_cards_customerId_programId_key`(`customerId`, `programId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `loyalty_movements` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `cardId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `delta` INTEGER NOT NULL,
    `saleId` VARCHAR(191) NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `loyalty_movements_cardId_createdAt_idx`(`cardId`, `createdAt`),
    INDEX `loyalty_movements_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `loyalty_programs` ADD CONSTRAINT `loyalty_programs_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `loyalty_cards` ADD CONSTRAINT `loyalty_cards_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `loyalty_cards` ADD CONSTRAINT `loyalty_cards_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `loyalty_cards` ADD CONSTRAINT `loyalty_cards_programId_fkey` FOREIGN KEY (`programId`) REFERENCES `loyalty_programs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `loyalty_movements` ADD CONSTRAINT `loyalty_movements_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `loyalty_cards`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
