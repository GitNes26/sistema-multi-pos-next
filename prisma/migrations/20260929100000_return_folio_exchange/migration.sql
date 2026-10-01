-- AlterTable
-- MySQL exige que la columna AUTO_INCREMENT sea llave en la misma sentencia.
ALTER TABLE `sale_returns` ADD COLUMN `exchangeItems` JSON NULL,
    ADD COLUMN `returnNumber` BIGINT NOT NULL AUTO_INCREMENT,
    ADD UNIQUE INDEX `sale_returns_returnNumber_key`(`returnNumber`);
