-- FASE 16 — Configuración de pasarelas de pago por organización.

-- AlterTable (nullable temporal para backfill)
ALTER TABLE `organizations` ADD COLUMN `paymentGateway` JSON NULL;

-- Backfill
UPDATE `organizations` SET `paymentGateway` = JSON_OBJECT() WHERE `paymentGateway` IS NULL;

-- Hacerla NOT NULL
ALTER TABLE `organizations` MODIFY `paymentGateway` JSON NOT NULL;
