-- Script para limpiar toda la data de prueba y preparar para sincronización PMS
-- Este script elimina:
-- 1. Todas las habitaciones (rooms)
-- 2. Todos los bookings
-- 3. Todas las semanas (weeks)
-- 4. Todas las solicitudes de swap
-- 5. Todos los night credits
-- 6. Todas las propiedades EXCEPTO "API Hotel (Gross Pricing) - Do not change" (ID 29)

-- Deshabilitar verificaciones de claves foráneas temporalmente
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Limpiar tablas relacionadas con bookings y swaps
TRUNCATE TABLE swap_requests;
TRUNCATE TABLE bookings;
TRUNCATE TABLE weeks;
TRUNCATE TABLE night_credits;

-- 2. Limpiar habitaciones
TRUNCATE TABLE rooms;

-- 3. Eliminar propiedades de prueba (mantener solo ID 29 - API Hotel)
DELETE FROM properties WHERE id != 29;

-- 4. Limpiar logs y registros relacionados
TRUNCATE TABLE action_logs;

-- Habilitar verificaciones de claves foráneas nuevamente
SET FOREIGN_KEY_CHECKS = 1;

-- Verificar resultados
SELECT 'ROOMS' as tabla, COUNT(*) as total FROM rooms
UNION ALL
SELECT 'BOOKINGS', COUNT(*) FROM bookings
UNION ALL
SELECT 'WEEKS', COUNT(*) FROM weeks
UNION ALL
SELECT 'SWAP_REQUESTS', COUNT(*) FROM swap_requests
UNION ALL
SELECT 'NIGHT_CREDITS', COUNT(*) FROM night_credits
UNION ALL
SELECT 'PROPERTIES', COUNT(*) FROM properties;

-- Mostrar la propiedad que quedó
SELECT id, name, pms_provider, pms_sync_enabled, pms_property_id FROM properties;
