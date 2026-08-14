-- FASE 14.4 — Menú dinámico multinivel (BD).

-- CreateTable
CREATE TABLE `menus` (
    `id` VARCHAR(191) NOT NULL,
    `parentId` VARCHAR(191) NULL,
    `type` VARCHAR(20) NOT NULL DEFAULT 'item',
    `label` VARCHAR(100) NOT NULL,
    `icon` VARCHAR(50) NULL,
    `href` VARCHAR(255) NULL,
    `badge` VARCHAR(50) NULL,
    `badgeVariant` VARCHAR(20) NULL,
    `permissionKey` VARCHAR(50) NULL,
    `sortOrder` INT NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `menus_parentId_idx` ON `menus`(`parentId`);

-- AddForeignKey
ALTER TABLE `menus` ADD CONSTRAINT `menus_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `menus`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
