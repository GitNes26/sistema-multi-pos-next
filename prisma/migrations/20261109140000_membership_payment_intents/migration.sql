-- Cobro de membresias por la pasarela de pagos en linea de la empresa: un enlace de pago por periodo.
CREATE TABLE `membership_payment_intents` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `programId` VARCHAR(191) NOT NULL,
    `cardId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `externalId` VARCHAR(191) NULL,
    `checkoutUrl` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `periodKey` VARCHAR(191) NOT NULL,
    `saleId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `paidAt` DATETIME(3) NULL,

    UNIQUE INDEX `membership_payment_intents_periodKey_key`(`periodKey`),
    INDEX `membership_payment_intents_organizationId_status_createdAt_idx`(`organizationId`, `status`, `createdAt`),
    INDEX `membership_payment_intents_cardId_status_idx`(`cardId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `membership_payment_intents` ADD CONSTRAINT `membership_payment_intents_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
