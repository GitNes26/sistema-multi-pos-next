ALTER TABLE `delivery_policies`
  ADD COLUMN `deliveryFeeType` VARCHAR(16) NOT NULL DEFAULT 'fixed',
  ADD COLUMN `deliveryFeePerKm` DECIMAL(12,2) NULL DEFAULT 0;

ALTER TABLE `branch_delivery_policies`
  ADD COLUMN `deliveryFeeType` VARCHAR(16) NOT NULL DEFAULT 'fixed',
  ADD COLUMN `deliveryFeePerKm` DECIMAL(12,2) NULL DEFAULT 0;
