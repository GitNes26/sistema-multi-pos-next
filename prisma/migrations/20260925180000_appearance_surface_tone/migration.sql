-- Tono de superficies neutras (Apariencia): neutral | subtle | tinted
ALTER TABLE `app_settings` ADD COLUMN `surfaceTone` VARCHAR(191) NOT NULL DEFAULT 'subtle';
