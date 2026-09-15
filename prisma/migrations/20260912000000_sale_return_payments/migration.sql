-- Registra cómo se ejecutó un reembolso para poder conciliar caja y conservar
-- referencias de tarjeta/proveedor. Las devoluciones históricas permanecen sin
-- movimientos y deben completarse explícitamente antes de considerarse pagadas.
CREATE TABLE `sale_return_payments` (
  `id` VARCHAR(191) NOT NULL,
  `returnId` VARCHAR(191) NOT NULL,
  `method` ENUM('cash', 'card', 'wallet', 'other', 'points', 'credit') NOT NULL,
  `amount` DECIMAL(12, 2) NOT NULL,
  `reference` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `sale_return_payments_returnId_idx` (`returnId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `sale_return_payments_returnId_fkey`
    FOREIGN KEY (`returnId`) REFERENCES `sale_returns` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
