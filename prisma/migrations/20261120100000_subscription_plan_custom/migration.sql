-- Plan "Personalizado": plan propio de una empresa (accesos, sucursales, empleados y precio libres). No aparece en el catalogo de planes.
ALTER TABLE `subscription_plans` ADD COLUMN `isCustom` BOOLEAN NOT NULL DEFAULT false;
