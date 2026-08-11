-- DropForeignKey
ALTER TABLE `role_permissions` DROP FOREIGN KEY `role_permissions_organizationId_fkey`;

-- DropForeignKey
ALTER TABLE `roles` DROP FOREIGN KEY `roles_organizationId_fkey`;

-- DropIndex
DROP INDEX `roles_organizationId_fkey` ON `roles`;

-- AlterTable
ALTER TABLE `role_permissions` MODIFY `organizationId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `roles` MODIFY `organizationId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `roles` ADD CONSTRAINT `roles_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
