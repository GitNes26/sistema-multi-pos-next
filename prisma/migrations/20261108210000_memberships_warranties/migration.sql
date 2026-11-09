-- Membresías (periodo, vencimiento, condiciones) sobre los programas de fidelidad y garantías de servicio.
ALTER TABLE `loyalty_programs` ADD COLUMN `periodDays` INTEGER NULL,
    ADD COLUMN `rollover` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `reminderDays` INTEGER NOT NULL DEFAULT 3,
    ADD COLUMN `terms` TEXT NULL;

ALTER TABLE `loyalty_cards` ADD COLUMN `startedAt` DATETIME(3) NULL,
    ADD COLUMN `expiresAt` DATETIME(3) NULL,
    ADD COLUMN `reminderSentAt` DATETIME(3) NULL;

CREATE TABLE `warranty_rules` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `presetKey` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `appliesToProductIds` JSON NOT NULL,
    `coversProductIds` JSON NOT NULL,
    `windowHours` INTEGER NOT NULL DEFAULT 24,
    `sameDayOnly` BOOLEAN NOT NULL DEFAULT false,
    `discountPercent` INTEGER NOT NULL DEFAULT 100,
    `legend` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `warranty_rules_organizationId_isActive_idx`(`organizationId`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `warranty_claims` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `ruleId` VARCHAR(191) NOT NULL,
    `saleId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'requested',
    `reason` VARCHAR(191) NULL,
    `usedSaleId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolvedAt` DATETIME(3) NULL,

    INDEX `warranty_claims_organizationId_status_createdAt_idx`(`organizationId`, `status`, `createdAt`),
    INDEX `warranty_claims_organizationId_customerId_idx`(`organizationId`, `customerId`),
    UNIQUE INDEX `warranty_claims_saleId_ruleId_key`(`saleId`, `ruleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `warranty_rules` ADD CONSTRAINT `warranty_rules_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `warranty_claims` ADD CONSTRAINT `warranty_claims_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `warranty_claims` ADD CONSTRAINT `warranty_claims_ruleId_fkey` FOREIGN KEY (`ruleId`) REFERENCES `warranty_rules`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
