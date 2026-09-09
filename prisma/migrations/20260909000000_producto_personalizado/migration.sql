-- Producto Personalizado (food_service): variantes + tópicos configurables.
-- 1) Amplía el enum productType.
-- 2) Los productos que ya tienen opciones (tópicos) pasan a tipo custom: solo
--    los productos custom exponen el constructor en POS/portal.
ALTER TABLE `products`
  MODIFY `productType` ENUM('standard', 'bulk', 'custom') NOT NULL DEFAULT 'standard';

UPDATE `products`
SET `productType` = 'custom'
WHERE `id` IN (
  SELECT DISTINCT `productId` FROM `product_options`
);