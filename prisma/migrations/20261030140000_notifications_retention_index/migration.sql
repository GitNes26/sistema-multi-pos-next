-- Permite purgar notificaciones antiguas por fecha sin recorrer la tabla.
CREATE INDEX `notifications_createdAt_idx` ON `notifications`(`createdAt`);
