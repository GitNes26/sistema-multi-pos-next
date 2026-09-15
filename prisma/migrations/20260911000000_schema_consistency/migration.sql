-- Synchronize schema additions that were present in schema.prisma but missing
-- from the migration history. All changes are additive or preserve existing
-- values and are safe for fresh and already migrated databases.
ALTER TABLE `credit_policies` ADD COLUMN `creditEarnsPoints` BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE `order_items`
  MODIFY `productType` ENUM('standard', 'bulk', 'custom') NOT NULL;

ALTER TABLE `sale_items`
  MODIFY `productType` ENUM('standard', 'bulk', 'custom') NOT NULL;

ALTER TABLE `products` ADD COLUMN `isNew` BOOLEAN NOT NULL DEFAULT false;

-- These tables had a unique id index rather than the primary key declared by
-- Prisma. Preserve the same identifier while making the schema authoritative.
ALTER TABLE `plan_nodes` ADD PRIMARY KEY (`id`);
ALTER TABLE `plan_nodes` DROP INDEX `plan_nodes_id_key`;

ALTER TABLE `reservation_policies` ADD PRIMARY KEY (`id`);
ALTER TABLE `reservation_policies` DROP INDEX `reservation_policies_id_key`;
