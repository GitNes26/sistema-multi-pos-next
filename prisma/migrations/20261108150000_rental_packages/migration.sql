-- Paquetes de renta (combos): los articulos se guardan a precio de lista y el paquete descuenta la diferencia.
ALTER TABLE `reservations` ADD COLUMN `packageDiscount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `packageNote` VARCHAR(191) NULL;
