ALTER TABLE `orders`
  ADD COLUMN `idempotencyKey` VARCHAR(64) NULL;

CREATE UNIQUE INDEX `orders_organizationId_customerId_idempotencyKey_key`
  ON `orders`(`organizationId`, `customerId`, `idempotencyKey`);
