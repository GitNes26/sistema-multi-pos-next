-- El personal de la cita es opcional: sin preferencia del cliente queda «por asignar» y lo asigna el negocio.
ALTER TABLE `appointments` DROP FOREIGN KEY `appointments_employeeId_fkey`;
ALTER TABLE `appointments` MODIFY `employeeId` VARCHAR(191) NULL;
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
