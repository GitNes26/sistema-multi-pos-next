-- Frecuencia de pago de la suscripción (meses). Columna opcional: las suscripciones
-- existentes quedan en NULL («fecha manual») y conservan su vencimiento.
ALTER TABLE `organization_subscriptions` ADD COLUMN `billingMonths` INTEGER NULL;
