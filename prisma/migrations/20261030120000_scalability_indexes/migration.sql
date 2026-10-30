-- Índices compuestos para consultas por empresa + fecha/estado (escalabilidad).

CREATE INDEX `sales_organizationId_createdAt_idx` ON `sales`(`organizationId`, `createdAt`);
CREATE INDEX `sales_organizationId_locationId_createdAt_idx` ON `sales`(`organizationId`, `locationId`, `createdAt`);
CREATE INDEX `sales_organizationId_status_createdAt_idx` ON `sales`(`organizationId`, `status`, `createdAt`);
CREATE INDEX `orders_organizationId_createdAt_idx` ON `orders`(`organizationId`, `createdAt`);
CREATE INDEX `orders_organizationId_locationId_status_idx` ON `orders`(`organizationId`, `locationId`, `status`);
CREATE INDEX `orders_organizationId_customerId_createdAt_idx` ON `orders`(`organizationId`, `customerId`, `createdAt`);
CREATE INDEX `inventory_movements_organizationId_createdAt_idx` ON `inventory_movements`(`organizationId`, `createdAt`);
CREATE INDEX `inventory_movements_organizationId_locationId_createdAt_idx` ON `inventory_movements`(`organizationId`, `locationId`, `createdAt`);
CREATE INDEX `inventory_movements_variantId_createdAt_idx` ON `inventory_movements`(`variantId`, `createdAt`);
CREATE INDEX `inventory_organizationId_locationId_locationType_idx` ON `inventory`(`organizationId`, `locationId`, `locationType`);
CREATE INDEX `products_organizationId_isActive_name_idx` ON `products`(`organizationId`, `isActive`, `name`);
CREATE INDEX `products_organizationId_categoryId_idx` ON `products`(`organizationId`, `categoryId`);
CREATE INDEX `product_variants_organizationId_isActive_idx` ON `product_variants`(`organizationId`, `isActive`);
CREATE INDEX `product_variants_organizationId_sku_idx` ON `product_variants`(`organizationId`, `sku`);
CREATE INDEX `customers_organizationId_fullName_idx` ON `customers`(`organizationId`, `fullName`);
CREATE INDEX `customers_phone_idx` ON `customers`(`phone`);
CREATE INDEX `users_phone_idx` ON `users`(`phone`);
CREATE INDEX `employees_phone_idx` ON `employees`(`phone`);
CREATE INDEX `cash_sessions_organizationId_locationId_status_idx` ON `cash_sessions`(`organizationId`, `locationId`, `status`);
CREATE INDEX `cash_sessions_organizationId_openedAt_idx` ON `cash_sessions`(`organizationId`, `openedAt`);
CREATE INDEX `loyalty_transactions_organizationId_customerId_createdAt_idx` ON `loyalty_transactions`(`organizationId`, `customerId`, `createdAt`);
CREATE INDEX `sale_returns_organizationId_createdAt_idx` ON `sale_returns`(`organizationId`, `createdAt`);
CREATE INDEX `categories_organizationId_isActive_idx` ON `categories`(`organizationId`, `isActive`);
