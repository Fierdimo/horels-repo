# Credit System - Admin Configuration Specification

**Date:** 2026-02-03  
**Status:** Design Phase  
**Purpose:** Especificar cómo el admin puede configurar los valores del sistema de créditos

---

## 📋 Contexto: Fórmulas de Cálculo

### A. Deposit Logic (Owner convierte semana → créditos)

```
Wallet Credits = [Base_Season_Value] × [Location_Multiplier] × [Unit_Size_Multiplier]
```

**Base Seasons (configurables):**
- **RED** (Alta temporada): 1000 créditos base
- **WHITE** (Media temporada): 600 créditos base  
- **BLUE** (Baja temporada): 300 créditos base

**Ejemplo:**
```
Owner deposita semana RED en propiedad GOLD (1.3x) con unidad 2BR (1.5x):
= 1000 × 1.3 × 1.5
= 1,950 créditos
```

---

### B. Booking Logic (Usuario reserva con créditos)

```
Nightly Cost (Credits) = [Base_Nightly_Rate] × [Tier_Multiplier] × [Location_Multiplier] × [Room_Type_Multiplier]
```

**Base Nightly Rates (configurables):**
- **RED**: 150 créditos/noche (~1/7 de 1000)
- **WHITE**: 90 créditos/noche (~1/7 de 600)
- **BLUE**: 45 créditos/noche (~1/7 de 300)

**Ejemplo:**
```
Usuario reserva 7 noches en RED, propiedad GOLD (1.3x), habitación Deluxe (1.5x), location 1.2x:
Costo/noche = 150 × 1.3 × 1.2 × 1.5 = 351 créditos
Total 7 noches = 2,457 créditos
```

---

## 🎯 Valores Actuales (Hardcodeados)

**Actualmente en `CreditCalculationService.ts`:**

### 1. Base Season Values (Deposit)
```typescript
private static readonly BASE_SEASON_VALUES = {
  RED: 1000,    // Alta temporada
  WHITE: 600,   // Media temporada
  BLUE: 300     // Baja temporada
};
```

### 2. Base Nightly Rates (Booking)
```typescript
private static readonly BASE_NIGHTLY_RATES = {
  RED: 150,     // ~1/7 de 1000
  WHITE: 90,    // ~1/7 de 600
  BLUE: 45      // ~1/7 de 300
};
```

### 3. Property Tier Multipliers
```typescript
private static readonly TIER_MULTIPLIERS = {
  DIAMOND: 1.5,      // Propiedades premium
  GOLD: 1.3,         // Alta calidad
  SILVER_PLUS: 1.1,  // Sobre estándar
  STANDARD: 1.0      // Estándar
};
```

### 4. Room Type Multipliers
```typescript
private static readonly ROOM_TYPE_MULTIPLIERS = {
  STANDARD: 1.0,      // Studio / Standard
  SUPERIOR: 1.2,      // 1 bedroom
  DELUXE: 1.5,        // 2 bedroom
  SUITE: 2.0,         // 3 bedroom
  PRESIDENTIAL: 2.5   // Penthouse
};
```

### 5. Location Multipliers
**Actualmente:** Campo `location_multiplier` en tabla `timeshare_properties` (editable por admin)

---

## 🆕 Solución Propuesta: Sistema de Configuración

### **FASE 1: Valores Base Configurables**

Crear tabla `credit_system_config` para valores globales:

```sql
CREATE TABLE credit_system_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  config_key VARCHAR(100) UNIQUE NOT NULL,
  config_value DECIMAL(10,2) NOT NULL,
  config_type ENUM('BASE_SEASON', 'BASE_NIGHTLY', 'TIER_MULTIPLIER', 'ROOM_MULTIPLIER', 'OTHER') NOT NULL,
  description TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT REFERENCES users(id),
  INDEX idx_config_type (config_type)
);
```

**Registros iniciales:**
```sql
-- Base Season Values (para depósitos)
INSERT INTO credit_system_config (config_key, config_value, config_type, description) VALUES
('BASE_SEASON_RED', 1000, 'BASE_SEASON', 'Valor base para semanas de temporada alta'),
('BASE_SEASON_WHITE', 600, 'BASE_SEASON', 'Valor base para semanas de temporada media'),
('BASE_SEASON_BLUE', 300, 'BASE_SEASON', 'Valor base para semanas de temporada baja'),

-- Base Nightly Rates (para bookings)
('BASE_NIGHTLY_RED', 150, 'BASE_NIGHTLY', 'Costo base por noche en temporada alta'),
('BASE_NIGHTLY_WHITE', 90, 'BASE_NIGHTLY', 'Costo base por noche en temporada media'),
('BASE_NIGHTLY_BLUE', 45, 'BASE_NIGHTLY', 'Costo base por noche en temporada baja'),

-- Tier Multipliers
('TIER_DIAMOND', 1.5, 'TIER_MULTIPLIER', 'Multiplicador para propiedades DIAMOND'),
('TIER_GOLD', 1.3, 'TIER_MULTIPLIER', 'Multiplicador para propiedades GOLD'),
('TIER_SILVER_PLUS', 1.1, 'TIER_MULTIPLIER', 'Multiplicador para propiedades SILVER_PLUS'),
('TIER_STANDARD', 1.0, 'TIER_MULTIPLIER', 'Multiplicador para propiedades STANDARD'),

-- Room Type Multipliers
('ROOM_STANDARD', 1.0, 'ROOM_MULTIPLIER', 'Multiplicador para habitaciones Standard/Studio'),
('ROOM_SUPERIOR', 1.2, 'ROOM_MULTIPLIER', 'Multiplicador para habitaciones Superior/1BR'),
('ROOM_DELUXE', 1.5, 'ROOM_MULTIPLIER', 'Multiplicador para habitaciones Deluxe/2BR'),
('ROOM_SUITE', 2.0, 'ROOM_MULTIPLIER', 'Multiplicador para Suites/3BR'),
('ROOM_PRESIDENTIAL', 2.5, 'ROOM_MULTIPLIER', 'Multiplicador para Presidential/Penthouse'),

-- Credit to EUR conversion rate
('CREDIT_TO_EUR_RATE', 0.10, 'OTHER', 'Tasa de conversión de créditos a euros (1 crédito = €X)');
```

---

### **FASE 2: Auto-Asignación de Room Multipliers**

**Problema:** Si un resort tiene 200 unidades, configurar manualmente el multiplicador de cada una es inviable.

**Solución:** Sistema inteligente basado en la **categoría** de la unidad.

#### 2.1. Agregar Campo a `timeshare_units`

```sql
ALTER TABLE timeshare_units 
ADD COLUMN room_type_multiplier DECIMAL(3,2) DEFAULT NULL,
ADD INDEX idx_room_type_multiplier (room_type_multiplier);
```

**Lógica:**
- Si `room_type_multiplier` es NULL → Sistema calcula automáticamente basándose en `category`
- Si admin especifica valor → Usa ese valor (override manual)

---

#### 2.2. Auto-Mapping de Categorías → Room Types

**Mapeo inteligente por patrones en el nombre de la categoría:**

```typescript
// En CreditCalculationService
private static readonly CATEGORY_PATTERNS: Array<{
  pattern: RegExp;
  roomType: keyof typeof ROOM_TYPE_MULTIPLIERS;
}> = [
  // PRESIDENTIAL
  { pattern: /penthouse|presidential|ático/i, roomType: 'PRESIDENTIAL' },
  
  // SUITE
  { pattern: /\b3\s*br\b|3\s*bed|three.*bed|suite.*3|3.*habitaciones/i, roomType: 'SUITE' },
  
  // DELUXE
  { pattern: /\b2\s*br\b|2\s*bed|two.*bed|deluxe|2.*habitaciones/i, roomType: 'DELUXE' },
  
  // SUPERIOR
  { pattern: /\b1\s*br\b|1\s*bed|one.*bed|superior|1.*habitación/i, roomType: 'SUPERIOR' },
  
  // STANDARD (default)
  { pattern: /studio|standard|básico|estándar/i, roomType: 'STANDARD' }
];

/**
 * Auto-detectar room type desde categoría de la unidad
 */
private detectRoomTypeFromCategory(category: string): keyof typeof ROOM_TYPE_MULTIPLIERS {
  for (const { pattern, roomType } of CATEGORY_PATTERNS) {
    if (pattern.test(category)) {
      return roomType;
    }
  }
  return 'STANDARD'; // Default fallback
}
```

**Ejemplos de auto-detección:**
```typescript
"2BR Oceanview"           → DELUXE (1.5x)
"Studio Deluxe"           → STANDARD (1.0x) - Studio prevalece
"1 Bedroom Suite"         → SUPERIOR (1.2x)
"3BR Presidential"        → SUITE (2.0x) - O PRESIDENTIAL si penthouse
"Penthouse Vista Mar"     → PRESIDENTIAL (2.5x)
"Habitación Estándar"     → STANDARD (1.0x)
"Deluxe 2 Habitaciones"   → DELUXE (1.5x)
```

---

#### 2.3. Comando Admin: Auto-Configurar Todas las Unidades

```http
POST /admin/credits/auto-configure-units
Authorization: Bearer {admin_token}

{
  "property_id": 5,  // Opcional: solo una propiedad
  "dry_run": true    // Preview sin guardar
}

Response:
{
  "success": true,
  "preview": [
    {
      "unit_id": 1,
      "category": "2BR Oceanview",
      "detected_room_type": "DELUXE",
      "multiplier": 1.5,
      "current_multiplier": null,
      "action": "SET"
    },
    {
      "unit_id": 2,
      "category": "Studio Standard",
      "detected_room_type": "STANDARD",
      "multiplier": 1.0,
      "current_multiplier": null,
      "action": "SET"
    },
    {
      "unit_id": 3,
      "category": "3BR Suite",
      "detected_room_type": "SUITE",
      "multiplier": 2.0,
      "current_multiplier": 1.8,  // Ya tiene valor manual
      "action": "SKIP"  // No sobrescribir manual override
    }
  ],
  "summary": {
    "total_units": 200,
    "units_configured": 195,
    "units_skipped": 5,  // Ya tenían override manual
    "units_failed": 0
  }
}
```

**Ejecución real:**
```http
POST /admin/credits/auto-configure-units
{
  "property_id": 5,
  "dry_run": false  // Guardar cambios
}
```

---

### **FASE 3: UI Admin para Configuración**

#### 3.1. Panel de Configuración Global

**Ruta:** `/admin/settings/credits`

```
┌─────────────────────────────────────────────────────────────┐
│  ⚙️  Configuración del Sistema de Créditos                  │
└─────────────────────────────────────────────────────────────┘

┌─ VALORES BASE DE TEMPORADA (Depósitos) ───────────────────┐
│                                                             │
│  Temporada ALTA (RED)      [ 1000 ] créditos              │
│  Temporada MEDIA (WHITE)   [  600 ] créditos              │
│  Temporada BAJA (BLUE)     [  300 ] créditos              │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─ TARIFAS NOCTURNAS BASE (Bookings) ───────────────────────┐
│                                                             │
│  Noche en temporada ALTA    [ 150 ] créditos/noche        │
│  Noche en temporada MEDIA   [  90 ] créditos/noche        │
│  Noche en temporada BAJA    [  45 ] créditos/noche        │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─ MULTIPLICADORES DE TIER ──────────────────────────────────┐
│                                                             │
│  🏆 DIAMOND      [ 1.50 ]  (Propiedades premium)          │
│  🥇 GOLD         [ 1.30 ]  (Alta calidad)                 │
│  🥈 SILVER_PLUS  [ 1.10 ]  (Sobre estándar)               │
│  🥉 STANDARD     [ 1.00 ]  (Estándar)                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─ MULTIPLICADORES DE TIPO DE HABITACIÓN ────────────────────┐
│                                                             │
│  🏠 STANDARD        [ 1.00 ]  (Studio/Estándar)           │
│  🏡 SUPERIOR        [ 1.20 ]  (1 Habitación)              │
│  🏘️  DELUXE          [ 1.50 ]  (2 Habitaciones)            │
│  🏰 SUITE           [ 2.00 ]  (3 Habitaciones)            │
│  👑 PRESIDENTIAL    [ 2.50 ]  (Penthouse)                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─ CONVERSIÓN CRÉDITO → EURO ────────────────────────────────┐
│                                                             │
│  1 crédito = [ 0.10 ] EUR                                  │
│  (Usado para pagos híbridos créditos + efectivo)          │
│                                                             │
└─────────────────────────────────────────────────────────────┘

[💾 Guardar Cambios]  [↻ Restaurar Valores por Defecto]
```

---

#### 3.2. Auto-Configuración Masiva de Unidades

**Ruta:** `/admin/settings/credits/auto-configure`

```
┌─────────────────────────────────────────────────────────────┐
│  🤖 Auto-Configuración de Multiplicadores de Habitación     │
└─────────────────────────────────────────────────────────────┘

Este asistente detectará automáticamente el tipo de cada unidad
basándose en su categoría y asignará el multiplicador correcto.

┌─ OPCIONES ──────────────────────────────────────────────────┐
│                                                              │
│  Propiedad:  [Todas las propiedades ▼]                     │
│               ( ) Solo propiedades activas                   │
│                                                              │
│  Modo:       (•) Preview (ver cambios sin guardar)         │
│              ( ) Aplicar cambios                            │
│                                                              │
│  Sobrescribir: [ ] Sobrescribir valores manuales existentes │
│                                                              │
└──────────────────────────────────────────────────────────────┘

[🔍 Analizar Unidades]

┌─ VISTA PREVIA DE CAMBIOS ───────────────────────────────────┐
│                                                              │
│  Unidades encontradas: 200                                  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ ID  │ Categoría            │ Tipo      │ Mult │ Estado│ │
│  ├────────────────────────────────────────────────────────┤ │
│  │ 1   │ 2BR Oceanview       │ DELUXE    │ 1.5  │ ✅ SET │ │
│  │ 2   │ Studio Standard     │ STANDARD  │ 1.0  │ ✅ SET │ │
│  │ 3   │ 3BR Suite           │ SUITE     │ 2.0  │ ⏩ SKIP│ │
│  │     │                     │           │ 1.8* │manual │ │
│  │ 4   │ 1BR Superior Vista  │ SUPERIOR  │ 1.2  │ ✅ SET │ │
│  │ 5   │ Penthouse Deluxe    │ PRESIDEN..│ 2.5  │ ✅ SET │ │
│  │ ... │ ...                 │ ...       │ ...  │ ...   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Resumen:                                                   │
│  • Unidades a configurar: 195                              │
│  • Unidades saltadas (manual): 5                           │
│  • Unidades con error: 0                                   │
│                                                              │
└──────────────────────────────────────────────────────────────┘

[⚠️ Cancelar]  [✅ Aplicar Configuración (195 unidades)]
```

---

#### 3.3. Configuración Individual de Unidad

**Ruta:** `/admin/properties/{id}/units/{unit_id}/edit`

Agregar sección en el formulario de edición de unidad:

```
┌─ CONFIGURACIÓN DE CRÉDITOS ─────────────────────────────────┐
│                                                              │
│  Categoría: [2BR Oceanview Deluxe        ]                 │
│                                                              │
│  Tipo de Habitación (para cálculo de créditos):            │
│  ( ) Auto-detectar desde categoría ✨                       │
│       → Detectado: DELUXE (Multiplicador: 1.5x)            │
│                                                              │
│  (•) Configurar manualmente                                 │
│      [DELUXE                          ▼]                    │
│      Multiplicador: 1.5x                                    │
│                                                              │
│  [ ] Usar multiplicador personalizado:                     │
│      [ 1.50 ] (sobrescribe el valor del tipo)             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

### **FASE 4: Migración de Servicio**

Modificar `CreditCalculationService` para que lea de la base de datos:

```typescript
class CreditCalculationService {
  
  /**
   * Cache de configuraciones (actualizar cada 5 minutos)
   */
  private static configCache: Map<string, number> = new Map();
  private static cacheExpiry: Date | null = null;
  
  /**
   * Obtener valor de configuración desde DB (con fallback)
   */
  private async getConfigValue(
    key: string, 
    fallback: number
  ): Promise<number> {
    // 1. Verificar cache
    if (this.isCacheValid()) {
      const cached = CreditCalculationService.configCache.get(key);
      if (cached !== undefined) return cached;
    }
    
    // 2. Buscar en DB
    try {
      const config = await CreditSystemConfig.findOne({ 
        where: { config_key: key } 
      });
      
      if (config) {
        const value = parseFloat(config.config_value.toString());
        CreditCalculationService.configCache.set(key, value);
        return value;
      }
    } catch (error) {
      console.warn(`Error fetching config ${key}:`, error);
    }
    
    // 3. Fallback a valor hardcoded
    return fallback;
  }
  
  /**
   * Obtener multiplicador de unidad (con auto-detección)
   */
  private async getUnitMultiplier(unit: TimeshareUnit): Promise<number> {
    // 1. Si unidad tiene override manual, usarlo
    if (unit.room_type_multiplier !== null) {
      return parseFloat(unit.room_type_multiplier.toString());
    }
    
    // 2. Auto-detectar desde categoría
    const detectedType = this.detectRoomTypeFromCategory(unit.category);
    
    // 3. Obtener multiplicador desde config
    const configKey = `ROOM_${detectedType}`;
    return await this.getConfigValue(
      configKey,
      this.ROOM_TYPE_MULTIPLIERS[detectedType]  // Fallback
    );
  }
  
  /**
   * Calcular créditos de depósito (versión configurable)
   */
  async calculateDepositCredits(weekId: number): Promise<CalculationResult> {
    const week = await WeekAllocation.findByPk(weekId, {
      include: [/* ... */]
    });
    
    // Obtener valores configurables
    const baseValue = await this.getConfigValue(
      `BASE_SEASON_${week.season_type}`,
      this.BASE_SEASON_VALUES[week.season_type]
    );
    
    const tierMultiplier = await this.getConfigValue(
      `TIER_${property.tier}`,
      this.TIER_MULTIPLIERS[property.tier]
    );
    
    const locationMultiplier = parseFloat(property.location_multiplier);
    
    const roomTypeMultiplier = await this.getUnitMultiplier(unit);
    
    // Calcular
    const credits = Math.round(
      baseValue * tierMultiplier * locationMultiplier * roomTypeMultiplier
    );
    
    return { credits, breakdown: { /* ... */ } };
  }
}
```

---

## 📊 Modelo de Base de Datos

### Nueva Tabla: `credit_system_config`

```typescript
// backend/src/models/v2/CreditSystemConfig.ts
import { Model, DataTypes } from 'sequelize';
import sequelize from '../../config/database';

class CreditSystemConfig extends Model {
  public id!: number;
  public config_key!: string;
  public config_value!: number;
  public config_type!: 'BASE_SEASON' | 'BASE_NIGHTLY' | 'TIER_MULTIPLIER' | 'ROOM_MULTIPLIER' | 'OTHER';
  public description!: string | null;
  public updated_at!: Date;
  public updated_by!: number | null;
  
  /**
   * Get configuration value by key
   */
  static async getValue(key: string, defaultValue: number): Promise<number> {
    const config = await this.findOne({ where: { config_key: key } });
    return config ? parseFloat(config.config_value.toString()) : defaultValue;
  }
  
  /**
   * Update or create configuration
   */
  static async setValue(
    key: string, 
    value: number, 
    updatedBy: number
  ): Promise<void> {
    await this.upsert({
      config_key: key,
      config_value: value,
      updated_by: updatedBy,
      updated_at: new Date()
    });
  }
  
  /**
   * Get all configs by type
   */
  static async getByType(type: string): Promise<CreditSystemConfig[]> {
    return await this.findAll({ 
      where: { config_type: type },
      order: [['config_key', 'ASC']]
    });
  }
}

CreditSystemConfig.init({
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  config_key: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  config_value: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  config_type: {
    type: DataTypes.ENUM(
      'BASE_SEASON',
      'BASE_NIGHTLY',
      'TIER_MULTIPLIER',
      'ROOM_MULTIPLIER',
      'OTHER'
    ),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_by: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  sequelize,
  tableName: 'credit_system_config',
  timestamps: false,
  indexes: [
    { fields: ['config_type'] },
    { fields: ['config_key'], unique: true }
  ]
});

export default CreditSystemConfig;
```

---

### Modificación: `timeshare_units` table

```sql
ALTER TABLE timeshare_units 
ADD COLUMN room_type_multiplier DECIMAL(3,2) DEFAULT NULL 
  COMMENT 'Override manual del multiplicador. NULL = auto-detectar desde category',
ADD INDEX idx_room_type_multiplier (room_type_multiplier);
```

---

## 🛠️ API Endpoints

### 1. Get Current Configuration

```http
GET /admin/credits/config
Authorization: Bearer {admin_token}

Response: {
  "success": true,
  "data": {
    "base_seasons": {
      "RED": 1000,
      "WHITE": 600,
      "BLUE": 300
    },
    "base_nightly": {
      "RED": 150,
      "WHITE": 90,
      "BLUE": 45
    },
    "tier_multipliers": {
      "DIAMOND": 1.5,
      "GOLD": 1.3,
      "SILVER_PLUS": 1.1,
      "STANDARD": 1.0
    },
    "room_multipliers": {
      "STANDARD": 1.0,
      "SUPERIOR": 1.2,
      "DELUXE": 1.5,
      "SUITE": 2.0,
      "PRESIDENTIAL": 2.5
    },
    "credit_to_eur_rate": 0.10
  }
}
```

---

### 2. Update Configuration

```http
PATCH /admin/credits/config
Authorization: Bearer {admin_token}

{
  "BASE_SEASON_RED": 1200,
  "BASE_SEASON_WHITE": 700,
  "ROOM_DELUXE": 1.6
}

Response: {
  "success": true,
  "message": "3 configuraciones actualizadas",
  "updated": [
    "BASE_SEASON_RED",
    "BASE_SEASON_WHITE",
    "ROOM_DELUXE"
  ]
}
```

---

### 3. Auto-Configure Units

```http
POST /admin/credits/auto-configure-units
Authorization: Bearer {admin_token}

{
  "property_id": 5,        // Opcional: null = todas
  "dry_run": true,         // true = preview, false = ejecutar
  "overwrite_manual": false // false = respetar overrides manuales
}

Response (dry_run=true): {
  "success": true,
  "dry_run": true,
  "preview": [
    {
      "unit_id": 1,
      "category": "2BR Oceanview",
      "current_multiplier": null,
      "detected_room_type": "DELUXE",
      "new_multiplier": 1.5,
      "action": "SET"
    },
    {
      "unit_id": 3,
      "category": "3BR Suite",
      "current_multiplier": 1.8,  // Override manual
      "detected_room_type": "SUITE",
      "new_multiplier": 2.0,
      "action": "SKIP"  // No sobrescribir manual
    }
  ],
  "summary": {
    "total_units": 200,
    "will_configure": 195,
    "will_skip": 5,
    "errors": 0
  }
}

Response (dry_run=false): {
  "success": true,
  "dry_run": false,
  "summary": {
    "total_units": 200,
    "configured": 195,
    "skipped": 5,
    "errors": 0
  }
}
```

---

### 4. Update Unit Multiplier (Individual)

```http
PATCH /admin/properties/:property_id/units/:unit_id
Authorization: Bearer {admin_token}

{
  "room_type_multiplier": 1.75  // null = auto-detectar
}

Response: {
  "success": true,
  "unit": {
    "id": 1,
    "category": "2BR Oceanview",
    "room_type_multiplier": 1.75,
    "auto_detected_type": "DELUXE"
  }
}
```

---

## ✅ Plan de Implementación

### **Sprint 1: Base de Datos y Modelos** (2-3 días)
- [ ] Crear migración para tabla `credit_system_config`
- [ ] Seedear valores iniciales
- [ ] Crear modelo `CreditSystemConfig`
- [ ] Agregar campo `room_type_multiplier` a `timeshare_units`
- [ ] Tests unitarios del modelo

### **Sprint 2: Backend Service** (3-4 días)
- [ ] Modificar `CreditCalculationService` para leer desde DB
- [ ] Implementar cache de configuraciones
- [ ] Implementar auto-detección de room type desde categoría
- [ ] Crear servicio `CreditConfigService`
- [ ] Tests de cálculo con valores configurables

### **Sprint 3: API Endpoints** (2-3 días)
- [ ] Endpoint GET `/admin/credits/config`
- [ ] Endpoint PATCH `/admin/credits/config`
- [ ] Endpoint POST `/admin/credits/auto-configure-units`
- [ ] Endpoint PATCH para unidad individual
- [ ] Tests de integración de endpoints

### **Sprint 4: UI Admin** (4-5 días)
- [ ] Página de configuración global (`/admin/settings/credits`)
- [ ] Wizard de auto-configuración masiva
- [ ] Agregar sección a formulario de edición de unidad
- [ ] Preview de cambios antes de aplicar
- [ ] Validaciones de formulario

### **Sprint 5: Testing y Documentación** (2 días)
- [ ] Tests end-to-end
- [ ] Documentación de API
- [ ] Guía para admins
- [ ] Migration guide desde valores hardcoded

---

## 🎓 Preguntas Frecuentes

### **¿Qué pasa con los cálculos existentes si cambio los valores?**
Los cálculos de créditos **ya otorgados** no se modifican (están guardados en `credit_transactions`). Solo afecta a nuevos depósitos y bookings.

### **¿Cómo reviso el historial de cambios de configuración?**
La tabla `credit_system_config` tiene campo `updated_at` y `updated_by`. Se puede agregar tabla de auditoría si se requiere historial completo.

### **¿Puedo tener diferentes multiplicadores de temporada por propiedad?**
Actualmente NO. Los valores BASE_SEASON son globales. Si se necesita, se puede agregar tabla `property_season_overrides`.

### **¿La auto-detección puede equivocarse?**
Sí, por eso:
1. Siempre hay preview antes de aplicar
2. Admin puede hacer override manual por unidad
3. Se puede configurar manualmente unidades problemáticas

### **¿Qué pasa si elimino una configuración de la tabla?**
El servicio usa fallback a valores hardcoded (los actuales) para evitar errores.

---

## 📌 Próximos Pasos

1. **Revisar y aprobar especificación**
2. **Crear tickets de implementación por Sprint**
3. **Comenzar con Sprint 1: DB y Modelos**
4. **Testing continuo durante desarrollo**
5. **Deploy gradual: primero sandbox, luego producción**

---

**Documentación relacionada:**
- [TIMESHARE_PLATFORM_V2_SPEC.md](TIMESHARE_PLATFORM_V2_SPEC.md)
- [WEEK_ALLOCATION_WORKFLOW.md](WEEK_ALLOCATION_WORKFLOW.md)
- Backend: `/backend/src/services/CreditCalculationService.ts`
- Backend: `/backend/CREDIT_SYSTEM_API.md`
