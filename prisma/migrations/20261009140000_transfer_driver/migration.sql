-- Traslados: chofer asignado (trabajador o nombre) y enlace público para compartir ubicación.
ALTER TABLE `transfers`
    ADD COLUMN `driverEmployeeId` VARCHAR(191) NULL,
    ADD COLUMN `driverAssignedAt` DATETIME(3) NULL,
    ADD COLUMN `driverAcceptedAt` DATETIME(3) NULL,
    ADD COLUMN `trackToken` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `transfers_trackToken_key` ON `transfers`(`trackToken`);
CREATE INDEX `transfers_driverEmployeeId_idx` ON `transfers`(`driverEmployeeId`);
