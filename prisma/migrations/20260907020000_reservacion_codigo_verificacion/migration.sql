-- AlterTable
ALTER TABLE `table_reservations` ADD COLUMN `verifyCode` VARCHAR(191) NULL, ADD COLUMN `verifyCodeExpiresAt` DATETIME(3) NULL;
