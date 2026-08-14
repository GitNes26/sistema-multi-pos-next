-- AlterTable
ALTER TABLE `employees` ADD COLUMN `locationId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
