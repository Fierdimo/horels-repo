-- Script para eliminar toda la data de habitaciones
-- Ejecutar este script para resetear la tabla rooms

-- Deshabilitar verificaciones de claves foráneas temporalmente
SET FOREIGN_KEY_CHECKS = 0;

-- Eliminar todos los registros de la tabla rooms
TRUNCATE TABLE rooms;

-- Habilitar verificaciones de claves foráneas nuevamente
SET FOREIGN_KEY_CHECKS = 1;

-- Verificar que la tabla está vacía
SELECT COUNT(*) as total_rooms FROM rooms;
