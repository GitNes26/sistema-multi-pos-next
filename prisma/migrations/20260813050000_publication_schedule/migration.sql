-- FASE 18 — Fechas de inicio/fin de publicación.

-- AlterTable
ALTER TABLE `publications` ADD COLUMN `startsAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `publications` ADD COLUMN `endsAt` DATETIME(3) NULL;
