-- La cita que origina una orden de servicio («Llegó» → orden): una orden por cita.
ALTER TABLE `service_orders` ADD COLUMN `appointmentId` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `service_orders_appointmentId_key` ON `service_orders`(`appointmentId`);
ALTER TABLE `service_orders` ADD CONSTRAINT `service_orders_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `appointments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
