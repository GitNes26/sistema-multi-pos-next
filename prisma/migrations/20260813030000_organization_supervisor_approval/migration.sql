-- FASE 15.7 — Configuración de aprobación de supervisor por organización.

-- AlterTable (nullable temporal para backfill)
ALTER TABLE `organizations` ADD COLUMN `supervisorApproval` JSON NULL;

-- Backfill: objeto vacío para filas existentes
UPDATE `organizations` SET `supervisorApproval` = JSON_OBJECT() WHERE `supervisorApproval` IS NULL;

-- Hacerla NOT NULL
ALTER TABLE `organizations` MODIFY `supervisorApproval` JSON NOT NULL;
