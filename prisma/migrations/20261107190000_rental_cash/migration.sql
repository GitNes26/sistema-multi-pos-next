-- Movimientos de efectivo del depósito de las rentas (entra, se regresa y saldo por cargos).
CREATE TABLE `rental_cash_entries` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `locationId` VARCHAR(191) NOT NULL,
  `reservationId` VARCHAR(191) NOT NULL,
  `kind` VARCHAR(14) NOT NULL,
  `amount` DECIMAL(12, 2) NOT NULL,
  `cashSessionId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `rental_cash_entries_cashSessionId_kind_idx`(`cashSessionId`, `kind`),
  INDEX `rental_cash_entries_reservationId_kind_idx`(`reservationId`, `kind`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `rental_cash_entries` ADD CONSTRAINT `rental_cash_entries_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
