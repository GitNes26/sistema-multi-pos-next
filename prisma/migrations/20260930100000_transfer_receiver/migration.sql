-- AlterTable
ALTER TABLE `transfers` ADD COLUMN `receivedByEmployeeId` VARCHAR(191) NULL,
    ADD COLUMN `receivedByName` VARCHAR(191) NULL;
