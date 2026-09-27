-- AlterTable
ALTER TABLE `employees` ADD COLUMN `commissionRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `dailyHours` DECIMAL(5, 2) NOT NULL DEFAULT 8,
    ADD COLUMN `holidayRate` DECIMAL(5, 2) NOT NULL DEFAULT 2,
    ADD COLUMN `overtimeRate` DECIMAL(5, 2) NOT NULL DEFAULT 2,
    ADD COLUMN `payMethod` VARCHAR(191) NOT NULL DEFAULT 'cash',
    ADD COLUMN `receivesTips` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `restDayRate` DECIMAL(5, 2) NOT NULL DEFAULT 2,
    ADD COLUMN `shiftEnd` VARCHAR(5) NULL,
    ADD COLUMN `shiftStart` VARCHAR(5) NULL,
    ADD COLUMN `workDays` JSON NULL;

-- CreateTable
CREATE TABLE `payroll_concepts` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `calc` VARCHAR(191) NOT NULL DEFAULT 'fixed',
    `amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `payroll_concepts_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payroll_periods` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `folio` VARCHAR(191) NOT NULL,
    `frequency` VARCHAR(191) NOT NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `holidays` JSON NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `notes` TEXT NULL,
    `createdById` VARCHAR(191) NULL,
    `closedAt` DATETIME(3) NULL,
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `payroll_periods_organizationId_startDate_idx`(`organizationId`, `startDate`),
    UNIQUE INDEX `payroll_periods_organizationId_folio_key`(`organizationId`, `folio`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payroll_entries` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `periodId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `salaryType` VARCHAR(191) NOT NULL,
    `salaryAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `dailyRate` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `hourlyRate` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `daysWorked` DECIMAL(6, 2) NOT NULL DEFAULT 0,
    `hoursWorked` DECIMAL(8, 2) NOT NULL DEFAULT 0,
    `absences` DECIMAL(6, 2) NOT NULL DEFAULT 0,
    `overtimeHours` DECIMAL(8, 2) NOT NULL DEFAULT 0,
    `holidayDays` DECIMAL(6, 2) NOT NULL DEFAULT 0,
    `restDaysWorked` DECIMAL(6, 2) NOT NULL DEFAULT 0,
    `salesTotal` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `basePay` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `overtimePay` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `holidayPay` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `restDayPay` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `commissionPay` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `tips` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `perceptions` JSON NULL,
    `deductions` JSON NULL,
    `grossPay` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `totalDeductions` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `netPay` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `payMethod` VARCHAR(191) NOT NULL DEFAULT 'cash',
    `notes` TEXT NULL,
    `paidAt` DATETIME(3) NULL,
    `emailedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `payroll_entries_organizationId_employeeId_idx`(`organizationId`, `employeeId`),
    UNIQUE INDEX `payroll_entries_periodId_employeeId_key`(`periodId`, `employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `payroll_concepts` ADD CONSTRAINT `payroll_concepts_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_periods` ADD CONSTRAINT `payroll_periods_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_entries` ADD CONSTRAINT `payroll_entries_periodId_fkey` FOREIGN KEY (`periodId`) REFERENCES `payroll_periods`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_entries` ADD CONSTRAINT `payroll_entries_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

