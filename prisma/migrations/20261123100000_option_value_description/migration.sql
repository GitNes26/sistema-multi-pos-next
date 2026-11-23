-- Descripcion opcional de cada valor de opcion/topping. Columna nullable: no afecta a los datos existentes.
ALTER TABLE `product_option_values` ADD COLUMN `description` VARCHAR(191) NULL;
