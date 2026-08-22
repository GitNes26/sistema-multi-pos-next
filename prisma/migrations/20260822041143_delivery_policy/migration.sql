-- AlterTable
ALTER TABLE `delivery_policies` MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `order_status_history` MODIFY `status` ENUM('pending', 'confirmed', 'preparing', 'ready', 'in_transit', 'delivered', 'cancelled') NOT NULL;
