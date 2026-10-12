-- Traslados: el chofer confirma su llegada al destino (habilita la recepcion).
ALTER TABLE `transfers` ADD COLUMN `driverArrivedAt` DATETIME(3) NULL;
