-- Cobro de membresias: manual hoy; automatico preparado y bloqueado (lo desbloquea el superAdmin por empresa).
ALTER TABLE `organizations` ADD COLUMN `membershipAutoBilling` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `loyalty_programs` ADD COLUMN `autoBilling` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `loyalty_cards` ADD COLUMN `cancelledAt` DATETIME(3) NULL,
    ADD COLUMN `autoRenew` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `paymentMethodId` VARCHAR(191) NULL,
    ADD COLUMN `nextChargeAt` DATETIME(3) NULL,
    ADD COLUMN `billingStatus` VARCHAR(191) NULL,
    ADD COLUMN `lastBillingError` VARCHAR(191) NULL;
CREATE INDEX `loyalty_cards_autoRenew_nextChargeAt_idx` ON `loyalty_cards`(`autoRenew`, `nextChargeAt`);
