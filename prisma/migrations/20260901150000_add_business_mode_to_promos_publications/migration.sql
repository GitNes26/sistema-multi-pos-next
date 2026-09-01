-- AlterTable: Agregar businessMode a promotions y publications
ALTER TABLE `promotions` ADD COLUMN `businessMode` VARCHAR(191) NULL;
ALTER TABLE `publications` ADD COLUMN `businessMode` VARCHAR(191) NULL;
