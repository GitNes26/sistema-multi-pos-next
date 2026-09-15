ALTER TABLE `customer_credits`
  ADD COLUMN `useDefaultLimit` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `products`
  ADD COLUMN `isAvailable` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `availabilityNote` VARCHAR(191) NULL;

ALTER TABLE `product_variants`
  ADD COLUMN `isAvailable` BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE `product_recipe_items` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `variantId` VARCHAR(191) NULL,
  `optionValueId` VARCHAR(191) NULL,
  `ingredientProductId` VARCHAR(191) NULL,
  `ingredientVariantId` VARCHAR(191) NULL,
  `quantity` DECIMAL(12,3) NOT NULL,
  `wastePercent` DECIMAL(5,2) NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `product_recipe_items_organizationId_productId_idx`(`organizationId`, `productId`),
  INDEX `product_recipe_items_optionValueId_idx`(`optionValueId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
