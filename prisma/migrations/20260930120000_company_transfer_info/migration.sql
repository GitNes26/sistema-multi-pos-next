-- AlterTable
ALTER TABLE `company_profiles` ADD COLUMN `transferEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `transferBank` VARCHAR(191) NULL,
    ADD COLUMN `transferHolder` VARCHAR(191) NULL,
    ADD COLUMN `transferClabe` VARCHAR(191) NULL,
    ADD COLUMN `transferAccount` VARCHAR(191) NULL,
    ADD COLUMN `transferCard` VARCHAR(191) NULL,
    ADD COLUMN `transferNote` VARCHAR(300) NULL;
