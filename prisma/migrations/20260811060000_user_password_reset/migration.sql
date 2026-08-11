-- AlterTable
ALTER TABLE `users` ADD COLUMN `passwordResetToken` VARCHAR(191) NULL;
ALTER TABLE `users` ADD COLUMN `passwordResetExpires` DATETIME(3) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `users_passwordResetToken_key` ON `users`(`passwordResetToken`);