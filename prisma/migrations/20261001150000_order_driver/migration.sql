-- AlterTable
ALTER TABLE `orders` ADD COLUMN `driverEmployeeId` VARCHAR(191) NULL,
    ADD COLUMN `driverAssignedAt` DATETIME(3) NULL,
    ADD COLUMN `driverAcceptedAt` DATETIME(3) NULL;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_driverEmployeeId_fkey` FOREIGN KEY (`driverEmployeeId`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
