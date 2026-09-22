-- Permite guardar productos a granel por producto y unidad, conservando
-- los registros existentes basados en variantes.
ALTER TABLE `shopping_list_items`
  MODIFY `variantId` VARCHAR(191) NULL,
  ADD COLUMN `productId` VARCHAR(191) NULL,
  ADD COLUMN `unitId` VARCHAR(191) NULL;

CREATE INDEX `shopping_list_items_productId_idx` ON `shopping_list_items`(`productId`);

ALTER TABLE `shopping_list_items`
  ADD CONSTRAINT `shopping_list_items_productId_fkey`
  FOREIGN KEY (`productId`) REFERENCES `products`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
