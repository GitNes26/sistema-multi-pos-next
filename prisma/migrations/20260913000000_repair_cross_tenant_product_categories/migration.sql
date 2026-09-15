-- A product may only reference a category from its own organization.
-- Existing cross-tenant references are detached so the product remains usable
-- and appears under "Sin categoría" until it is assigned correctly.
UPDATE `products` AS `p`
LEFT JOIN `categories` AS `c` ON `c`.`id` = `p`.`categoryId`
SET `p`.`categoryId` = NULL
WHERE `p`.`categoryId` IS NOT NULL
  AND (`c`.`id` IS NULL OR `c`.`organizationId` <> `p`.`organizationId`);
