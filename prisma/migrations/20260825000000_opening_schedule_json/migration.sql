-- AlterTable: Add openingScheduleJson to locations and cedis
ALTER TABLE `locations` ADD COLUMN `openingScheduleJson` TEXT NULL;
ALTER TABLE `cedis` ADD COLUMN `openingScheduleJson` TEXT NULL;
