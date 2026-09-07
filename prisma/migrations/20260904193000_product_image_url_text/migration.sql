-- imageUrl en TEXT: los placeholders de imagen de la demo son data-URIs SVG
-- (gradiente + emoji) que exceden el VARCHAR(191) por defecto.
ALTER TABLE `products` MODIFY COLUMN `imageUrl` TEXT NULL;
