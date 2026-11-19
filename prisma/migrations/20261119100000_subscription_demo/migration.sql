-- Bandera Demo en la suscripcion: empresas de prueba gratis (no se cobran ni cuentan en ingresos).
ALTER TABLE `organization_subscriptions` ADD COLUMN `isDemo` BOOLEAN NOT NULL DEFAULT false;
