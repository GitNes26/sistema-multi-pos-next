-- Roles de sistema por modo de negocio (FASE wizards/businessModes).
-- `roles.businessMode` solo se usa en roles de sistema (organizationId = NULL):
--   NULL            → compartido a todas las organizaciones (owner, cashier, …)
--   'food_service'  → mesero, cocina (KDS)
--   'services'      → agente de atención
--   'rental'        → agente de renta
--   'hybrid'        → incluye los roles específicos de food_service
ALTER TABLE `roles` ADD COLUMN `businessMode` ENUM('retail', 'food_service', 'services', 'rental', 'hybrid') NULL;