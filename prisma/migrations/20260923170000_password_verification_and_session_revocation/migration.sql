ALTER TABLE `users`
  ADD COLUMN `passwordChangeCodeHash` VARCHAR(191) NULL,
  ADD COLUMN `passwordChangeCodeExpires` DATETIME(3) NULL,
  ADD COLUMN `authVersion` INTEGER NOT NULL DEFAULT 0;
