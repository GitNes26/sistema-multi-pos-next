-- Rentas: depósito en garantía, entrega/devolución, cargos y política por empresa.
ALTER TABLE `reservations`
  ADD COLUMN `depositAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `depositNote` VARCHAR(191) NULL,
  ADD COLUMN `deliveredAt` DATETIME(3) NULL,
  ADD COLUMN `returnedAt` DATETIME(3) NULL,
  ADD COLUMN `lateFee` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `damageFee` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `penaltyNotes` VARCHAR(191) NULL,
  ADD COLUMN `depositRefund` DECIMAL(12, 2) NULL,
  ADD COLUMN `balanceDue` DECIMAL(12, 2) NULL;

CREATE TABLE `rental_policies` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `defaultDeposit` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `lateFeePerDay` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `graceMinutes` INTEGER NOT NULL DEFAULT 60,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `rental_policies_organizationId_key`(`organizationId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `rental_policies` ADD CONSTRAINT `rental_policies_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
