-- AlterEnum: add `at_destination` to OrderStatus on orders table
ALTER TABLE `orders` MODIFY COLUMN `status` ENUM('pending','confirmed','preparing','ready','in_transit','at_destination','delivered','cancelled') NOT NULL DEFAULT 'pending';

-- AlterEnum: add `at_destination` to OrderStatus on order_status_history table
ALTER TABLE `order_status_history` MODIFY `status` ENUM('pending','confirmed','preparing','ready','in_transit','at_destination','delivered','cancelled') NOT NULL;

-- Add delivery confirmation fields
ALTER TABLE `orders` ADD COLUMN `deliveryPin` VARCHAR(6) NULL;
ALTER TABLE `orders` ADD COLUMN `deliveryQrToken` VARCHAR(191) NULL;

-- Unique index for QR token lookup
CREATE UNIQUE INDEX `orders_deliveryQrToken_key` ON `orders`(`deliveryQrToken`);
