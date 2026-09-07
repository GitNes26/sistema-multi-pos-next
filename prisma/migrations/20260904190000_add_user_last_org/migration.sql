-- Recuerda la última organización activa del usuario (multi-org).
-- Columna simple sin FK: se valida contra membresías/empleo al iniciar sesión.
ALTER TABLE `users` ADD COLUMN `lastOrganizationId` VARCHAR(191) NULL;
