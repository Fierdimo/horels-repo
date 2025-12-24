# Comandos Útiles - Gestión PMS y Habitaciones

## 🔄 Sincronización

### Sincronizar habitaciones desde PMS
```bash
npx ts-node scripts/sync-rooms-from-pms.ts 29
```

### Probar conexión PMS
```bash
npx ts-node scripts/test-pms-sync.js 29
```

### Limpiar y re-sincronizar
```bash
# 1. Eliminar habitaciones
node scripts/reset-rooms.js

# 2. Sincronizar desde PMS
npx ts-node scripts/sync-rooms-from-pms.ts 29
```

## 🗄️ Consultas de Base de Datos

### Ver estado general
```bash
docker exec -it sw2_mariadb mysql -u sw2_user -psw2_password sw2_db -e "SELECT 'Habitaciones' as Tabla, COUNT(*) as Total FROM rooms UNION ALL SELECT 'Bookings', COUNT(*) FROM bookings UNION ALL SELECT 'Propiedades', COUNT(*) FROM properties;"
```

### Ver primeras 10 habitaciones
```bash
docker exec -it sw2_mariadb mysql -u sw2_user -psw2_password sw2_db -e "SELECT id, pms_resource_id, is_marketplace_enabled, pms_last_sync FROM rooms LIMIT 10;"
```

### Contar habitaciones activas en marketplace
```bash
docker exec -it sw2_mariadb mysql -u sw2_user -psw2_password sw2_db -e "SELECT COUNT(*) as activas_marketplace FROM rooms WHERE is_marketplace_enabled = 1;"
```

### Ver propiedades con PMS configurado
```bash
docker exec -it sw2_mariadb mysql -u sw2_user -psw2_password sw2_db -e "SELECT id, name, pms_provider, pms_sync_enabled FROM properties WHERE pms_provider != 'none';"
```

## 🧹 Limpieza

### Limpiar toda la data de prueba
```bash
node scripts/clean-test-data.js
```

### Eliminar solo habitaciones
```bash
node scripts/reset-rooms.js
```

### SQL directo - Truncar tabla rooms
```bash
docker exec -it sw2_mariadb mysql -u sw2_user -psw2_password sw2_db -e "SET FOREIGN_KEY_CHECKS = 0; TRUNCATE TABLE rooms; SET FOREIGN_KEY_CHECKS = 1;"
```

## 🔧 Activar Habitaciones (Via SQL)

### Activar habitaciones específicas
```sql
-- Activar habitación por ID
UPDATE rooms SET is_marketplace_enabled = 1 WHERE id = 1;

-- Activar las primeras 10 habitaciones
UPDATE rooms SET is_marketplace_enabled = 1 ORDER BY id LIMIT 10;

-- Activar todas las habitaciones
UPDATE rooms SET is_marketplace_enabled = 1;
```

### Ejecutar desde terminal
```bash
docker exec -it sw2_mariadb mysql -u sw2_user -psw2_password sw2_db -e "UPDATE rooms SET is_marketplace_enabled = 1 LIMIT 10;"
```

## 🏨 Información de Propiedad

### Ver configuración PMS de la propiedad 29
```bash
docker exec -it sw2_mariadb mysql -u sw2_user -psw2_password sw2_db -e "SELECT id, name, pms_provider, pms_property_id, pms_sync_enabled FROM properties WHERE id = 29;"
```

## 📊 Estadísticas

### Resumen completo
```bash
docker exec -it sw2_mariadb mysql -u sw2_user -psw2_password sw2_db -e "
SELECT 
  (SELECT COUNT(*) FROM rooms) as total_rooms,
  (SELECT COUNT(*) FROM rooms WHERE is_marketplace_enabled = 1) as marketplace_enabled,
  (SELECT COUNT(*) FROM rooms WHERE custom_price IS NOT NULL) as with_custom_price,
  (SELECT COUNT(*) FROM bookings) as total_bookings,
  (SELECT COUNT(*) FROM properties) as total_properties;"
```

## 🔐 Acceso a Base de Datos

### Conectarse interactivamente
```bash
docker exec -it sw2_mariadb mysql -u sw2_user -psw2_password sw2_db
```

### Salir de MySQL
```sql
EXIT;
```

## 🚀 Backend

### Iniciar backend en modo desarrollo
```bash
cd backend
npm run dev
```

### Ejecutar migraciones
```bash
cd backend
npm run migrate
```

### Iniciar worker
```bash
cd backend
npm run start:worker
```

## 📝 Notas

- **Propiedad 29**: "API Hotel (Gross Pricing) - Do not change"
- **PMS Property ID**: `851df8c8-90f2-4c4a-8e01-a4fc46b25178`
- **Total habitaciones sincronizadas**: 500
- **Marketplace enabled por defecto**: No (staff debe activar)
