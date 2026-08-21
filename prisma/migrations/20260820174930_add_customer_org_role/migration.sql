-- AlterTable
ALTER TABLE `memberships` MODIFY `role` ENUM('owner', 'manager', 'cashier', 'customer', 'superadmin', 'admin') NOT NULL;

-- AlterTable
ALTER TABLE `user_invitations` MODIFY `role` ENUM('owner', 'manager', 'cashier', 'customer', 'superadmin', 'admin') NOT NULL DEFAULT 'cashier';
