CREATE TABLE `credit_payment_intents` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `currency` VARCHAR(191) NOT NULL,
  `provider` VARCHAR(191) NOT NULL,
  `externalId` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `paidAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `credit_payment_intents_provider_externalId_key`(`provider`, `externalId`),
  INDEX `credit_payment_intents_organizationId_customerId_status_idx`(`organizationId`, `customerId`, `status`),
  CONSTRAINT `credit_payment_intents_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `credit_payment_intents_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `notifications`
  ADD COLUMN `recipientUserId` VARCHAR(191) NULL,
  ADD INDEX `notifications_organizationId_recipientUserId_createdAt_idx` (`organizationId`, `recipientUserId`, `createdAt`),
  ADD CONSTRAINT `notifications_recipientUserId_fkey` FOREIGN KEY (`recipientUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
