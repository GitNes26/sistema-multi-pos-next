ALTER TABLE `product_options`
  ADD COLUMN `kind` ENUM('variant', 'topic') NOT NULL DEFAULT 'variant';

UPDATE `product_options` po
INNER JOIN `products` p ON p.`id` = po.`productId`
SET po.`kind` = 'topic'
WHERE p.`productType` = 'custom';

ALTER TABLE `tables`
  ADD COLUMN `rotation` INTEGER NOT NULL DEFAULT 0;

ALTER TABLE `plan_nodes`
  ADD COLUMN `rotation` INTEGER NOT NULL DEFAULT 0;
