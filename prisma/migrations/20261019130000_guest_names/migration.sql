-- «Pedir para varias personas»: a quién pertenece cada renglón de pedido y de venta.
ALTER TABLE `order_items` ADD COLUMN `guestName` VARCHAR(191) NULL;
ALTER TABLE `sale_items` ADD COLUMN `guestName` VARCHAR(191) NULL;
