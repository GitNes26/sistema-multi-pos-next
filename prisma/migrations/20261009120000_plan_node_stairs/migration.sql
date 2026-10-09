-- Plano de sala: elemento «Escaleras» (lugares con más de un piso).
ALTER TABLE `plan_nodes` MODIFY `kind` ENUM('entrance', 'exit', 'restroom', 'kitchen', 'bar_station', 'cashier', 'stairs', 'other') NOT NULL DEFAULT 'other';
