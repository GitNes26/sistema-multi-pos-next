-- AlterTable: Teléfono único por organización.
-- En MySQL, UNIQUE permite múltiples NULL, replicando el partial index
-- del plan (UNIQUE(organization_id, phone) WHERE phone IS NOT NULL).
ALTER TABLE `customers` ADD UNIQUE INDEX `customers_organizationId_phone_key`(`organizationId`, `phone`);

-- NOTA: el CHECK que garantizaba variant_id XOR product_id en `inventory`
-- NO se implementó: MySQL 8 error 3823 prohíbe usar columnas referenciadas
-- por FK con ON DELETE SET NULL / ON UPDATE CASCADE dentro de CHECK constraints.
-- La validación XOR queda a nivel de aplicación en el servicio de inventario.