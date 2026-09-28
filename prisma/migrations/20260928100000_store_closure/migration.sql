-- AlterTable
ALTER TABLE `organizations` ADD COLUMN `closedAt` DATETIME(3) NULL,
    ADD COLUMN `closedManually` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `closedReason` VARCHAR(200) NULL,
    ADD COLUMN `closedUntil` DATETIME(3) NULL;

