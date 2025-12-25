# MIGRACIONES DEL SISTEMA DE CRÉDITOS - LISTAS PARA PRODUCCIÓN

## 📋 Resumen Ejecutivo

**Estado:** ✅ LISTO PARA PRODUCCIÓN  
**Fecha:** 25 de Diciembre, 2025  
**Total de Migraciones:** 15  
**Tablas Nuevas:** 12  
**Tablas Modificadas:** 3  

---

## 🔄 Orden de Ejecución

Las migraciones se ejecutarán automáticamente en este orden:

### 1. Limpieza (1 migración)
```
20251224235959-drop-legacy-credit-system.js
```
- Elimina tablas obsoletas del sistema antiguo de créditos
- Usa `DROP TABLE IF EXISTS` para ser idempotente
- Seguro para producción limpia (no causará errores si las tablas no existen)

### 2. Nuevas Tablas Base (3 migraciones)
```
20251225000000-create-platform-settings.js         → platform_settings (7 registros)
20251225000001-create-property-tiers.js            → property_tiers (5 registros)
20251225000002-create-room-type-multipliers.js     → room_type_multipliers (5 registros)
```

### 3. Tablas de Calendario y Wallets (3 migraciones)
```
20251225000003-create-seasonal-calendar.js         → seasonal_calendar
20251225000004-create-user-credit-wallets.js       → user_credit_wallets
20251225000005-create-credit-transactions.js       → credit_transactions [ALTO VOLUMEN]
```

### 4. Tablas de Costos y Servicios (3 migraciones)
```
20251225000006-create-credit-booking-costs.js      → credit_booking_costs
20251225000007-create-ancillary-services.js        → ancillary_services
20251225000008-create-booking-ancillary-services.js → booking_ancillary_services
```

### 5. Tablas de Gestión (3 migraciones)
```
20251225000009-create-week-claim-requests.js       → week_claim_requests
20251225000010-create-inter-property-settlements.js → inter_property_settlements
20251225000011-create-setting-change-log.js        → setting_change_log
```

### 6. Modificaciones a Tablas Existentes (3 migraciones)
```
20251225000012-modify-properties-for-credits.js    → properties (+3 columnas)
20251225000013-modify-weeks-for-credits.js         → weeks (+7 columnas)
20251225000014-modify-bookings-for-credits.js      → bookings (+8 columnas)
```

---

## 📊 Resumen de Cambios

### Tablas Nuevas (12)

| Tabla | Propósito | Registros Iniciales | Índices |
|-------|-----------|---------------------|---------|
| `platform_settings` | Configuración dinámica del sistema | 7 | 2 |
| `property_tiers` | Tiers de propiedades (DIAMOND→STANDARD) | 5 | 2 |
| `room_type_multipliers` | Multiplicadores por tipo de habitación | 5 | 2 |
| `seasonal_calendar` | Calendario RED/WHITE/BLUE | 0 | 3 |
| `user_credit_wallets` | Wallets de créditos de usuarios | 0 | 3 |
| `credit_transactions` | **[ALTO VOLUMEN]** Transacciones de créditos | 0 | 7 |
| `credit_booking_costs` | Costos de reservas en créditos | 0 | 4 |
| `ancillary_services` | Servicios adicionales | 0 | 5 |
| `booking_ancillary_services` | Relación servicios-reservas | 0 | 4 |
| `week_claim_requests` | Solicitudes de propiedad de semanas | 0 | 5 |
| `inter_property_settlements` | Liquidaciones entre propiedades | 0 | 6 |
| `setting_change_log` | Auditoría de cambios de configuración | 0 | 4 |

**Total:** 12 tablas nuevas con **47 índices optimizados**

### Tablas Modificadas (3)

#### `properties` (+3 columnas)
- `tier_id` INT → property_tiers.id
- `allows_credit_bookings` BOOLEAN
- `credit_booking_notice_days` TINYINT
- **+2 índices**

#### `weeks` (+7 columnas)
- `deposited_for_credits` BOOLEAN
- `credits_earned` DECIMAL(10,2)
- `credit_deposit_date` DATETIME(3)
- `credit_expiration_date` DATETIME(3)
- `season_at_deposit` ENUM('RED','WHITE','BLUE')
- `room_type_at_deposit` VARCHAR(50)
- `credit_calculation_metadata` JSON
- **+4 índices**

#### `bookings` (+8 columnas)
- `payment_method` ENUM('CREDITS','EUROS','HYBRID','P2P_SWAP')
- `credit_amount_paid` DECIMAL(10,2)
- `euro_amount_paid` DECIMAL(10,2)
- `topup_required` BOOLEAN
- `topup_amount_euros` DECIMAL(10,2)
- `credit_refund_amount` DECIMAL(10,2)
- `credit_conversion_rate` DECIMAL(10,4)
- `payment_calculation_metadata` JSON
- **+4 índices**

---

## 🚀 Instrucciones de Despliegue en Producción

### Pre-Despliegue

1. **Backup completo de la base de datos**
   ```bash
   mysqldump -u usuario -p sw2_hotels > backup_pre_creditos_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Verificar espacio en disco**
   - Tablas nuevas: ~50 MB iniciales
   - Índices: ~100 MB (estimado)
   - Recomendado: 500 MB libres

3. **Verificar conexión a base de datos**
   ```bash
   mysql -u usuario -p sw2_hotels -e "SELECT VERSION();"
   ```

### Despliegue

1. **Subir archivos al servidor**
   ```bash
   git pull origin main
   cd backend
   ```

2. **Instalar dependencias** (si es necesario)
   ```bash
   npm install
   ```

3. **Ejecutar migraciones**
   ```bash
   npx sequelize-cli db:migrate
   ```

4. **Verificar ejecución**
   ```bash
   npx sequelize-cli db:migrate:status | grep "20251225"
   ```

### Post-Despliegue

1. **Verificar tablas creadas**
   ```bash
   node verify-db-state.js
   ```

2. **Verificar datos semilla**
   ```sql
   SELECT COUNT(*) FROM platform_settings;    -- Esperado: 7
   SELECT COUNT(*) FROM property_tiers;       -- Esperado: 5
   SELECT COUNT(*) FROM room_type_multipliers; -- Esperado: 5
   ```

3. **Verificar índices críticos**
   ```bash
   node check-bookings-indexes.js
   ```

---

## ⚡ Optimizaciones de Performance

### Índices Estratégicos

- **7 índices** en `credit_transactions` (tabla de alto volumen)
- **3 índices** en `seasonal_calendar` para lookups de fechas
- **4 índices** en `bookings` para payment analytics
- **Índices compuestos** para queries complejas

### Tipos de Datos Optimizados

- `DECIMAL(10,2)` para precisión matemática (créditos, euros)
- `ENUM` para campos categóricos (1 byte vs 4+ bytes VARCHAR)
- `TINYINT` para booleanos y contadores pequeños
- `DATE/DATETIME(3)` con precisión de milisegundos donde necesario
- `JSON` para metadata flexible

### Preparación para Alto Volumen

- `credit_transactions`: Preparada para 100K+ transacciones/año
- Estrategia de particionamiento documentada (cuando > 1M registros)
- Índices optimizados para TPS de 10-50 durante picos

---

## 🔒 Seguridad y Validación

### Foreign Keys
- **19 foreign keys** configuradas
- Todas con `ON UPDATE CASCADE`
- `ON DELETE` configurado apropiadamente (CASCADE, SET NULL, RESTRICT)

### Constraints
- `UNIQUE` indexes donde necesario
- `NOT NULL` en campos críticos
- `DEFAULT` values para campos opcionales

### Audit Trail
- `setting_change_log` registra todos los cambios de configuración
- Timestamps en todas las transacciones
- IP address y user agent en cambios sensibles

---

## 🧪 Testing

### Script de Prueba Incluido

```bash
node test-migrations.js
```

Este script:
1. Crea una DB temporal
2. Ejecuta TODAS las migraciones
3. Verifica tablas, índices y foreign keys
4. Limpia automáticamente

**Ejecutar ANTES del despliegue a producción**

---

## 📞 Rollback

Si algo sale mal, ejecutar:

```bash
# Revertir última migración
npx sequelize-cli db:migrate:undo

# Revertir todas las migraciones de créditos
npx sequelize-cli db:migrate:undo:all --to 20251224150000-remove-obsolete-room-columns.js
```

**IMPORTANTE:** Restaurar desde backup si hay datos críticos afectados.

---

## ✅ Checklist de Producción

- [ ] Backup de base de datos completo
- [ ] Espacio en disco verificado (>500 MB)
- [ ] Script de prueba ejecutado: `node test-migrations.js`
- [ ] Migraciones desplegadas: `npx sequelize-cli db:migrate`
- [ ] Verificación post-despliegue: `node verify-db-state.js`
- [ ] Datos semilla verificados (7, 5, 5 registros)
- [ ] Índices verificados: `node check-bookings-indexes.js`
- [ ] Foreign keys verificadas (19 total)
- [ ] Monitoreo activado

---

## 📈 Próximos Pasos

Después del despliegue exitoso de las migraciones:

1. **Crear Modelos Sequelize** para las nuevas tablas
2. **Implementar Servicios**:
   - `CreditCalculationService` (cálculo de créditos)
   - `CreditWalletService` (gestión de wallets)
   - `CreditTransactionService` (transacciones)
   - `SeasonalCalendarService` (calendario)
3. **Crear API Endpoints**
4. **Implementar Frontend** (componentes React)
5. **Testing end-to-end**

---

**Documento generado automáticamente**  
**Fecha:** 25 de Diciembre, 2025  
**Versión:** 1.0
