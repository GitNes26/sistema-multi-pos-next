-- Bandera de servicio: distingue un servicio de un producto sencillo sin control de inventario.
-- Aditiva y con respaldo: lo que hoy se muestra como servicio (estandar sin inventario) sigue siendolo.
ALTER TABLE `products` ADD COLUMN `isService` BOOLEAN NOT NULL DEFAULT false;
UPDATE `products` SET `isService` = true WHERE `productType` = 'standard' AND `trackInventory` = false;
