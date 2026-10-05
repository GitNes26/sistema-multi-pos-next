-- Devoluciones: bonificación a crédito, cliente asignado a la devolución y monto abonado.
ALTER TABLE `sale_returns`
    MODIFY `returnType` ENUM('exchange', 'refund', 'coupon', 'points', 'credit') NOT NULL,
    ADD COLUMN `customerId` VARCHAR(191) NULL,
    ADD COLUMN `creditApplied` DECIMAL(12, 2) NULL;
