# V2 Schema Documentation System

## 📋 Overview

Este sistema asegura que siempre tenemos una **fuente de verdad centralizada** para los schemas de las tablas V2.

## 🎯 Problema que Resuelve

Anteriormente, los fixtures y tests asumían la estructura de las tablas, lo que causaba errores como:
- ❌ Usar `pms_credentials` cuando la columna real es `pms_credentials_encrypted`
- ❌ No saber qué campos son requeridos vs opcionales
- ❌ No conocer los valores ENUM disponibles

## ✅ Solución

Un script que **consulta la base de datos real** y genera:

1. **JSON** (`V2_DATABASE_SCHEMA.json`) - Estructura completa en formato legible por máquina
2. **Markdown** (`V2_DATABASE_SCHEMA.md`) - Documentación humana con todos los campos
3. **TypeScript** (`tests/fixtures/v2-schema.ts`) - Helpers para validar fixtures

## 🚀 Cómo Usar

### 1. Generar/Actualizar Documentación

Después de cualquier migración o cambio en la base de datos:

```bash
npm run document:schema
```

Esto consultará la DB y actualizará automáticamente los 3 archivos.

### 2. Consultar el Schema

**Para humanos:**
```bash
# Ver campos requeridos de timeshare_properties
cat docs_v2/V2_DATABASE_SCHEMA.md | grep -A 20 "timeshare_properties"
```

**Para código:**
```typescript
import { V2_REQUIRED_FIELDS, V2_ENUMS, validateFixture } from '../fixtures/v2-schema';

// Ver campos requeridos
console.log(V2_REQUIRED_FIELDS.timeshare_properties);
// ['name', 'slug', 'city', 'country', ...]

// Ver valores ENUM disponibles
console.log(V2_ENUMS.timeshare_properties.pms_provider);
// ['mews', 'cloudbeds', 'opera', 'resnexus', 'other']

// Validar que un fixture tiene todos los campos requeridos
const propertyData = { name: 'Test', slug: 'test-resort' };
validateFixture('timeshare_properties', propertyData); // ❌ Error: Missing required fields...
```

### 3. Crear Fixtures Correctos

**ANTES (incorrecto):**
```typescript
// ❌ Asumiendo estructura
await TimeshareProperty.create({
  name: 'Test Resort',
  pms_credentials: { apiKey: 'test' }, // ❌ Columna no existe!
});
```

**AHORA (correcto):**
```typescript
import { V2_REQUIRED_FIELDS } from '../fixtures/v2-schema';

// ✅ Consultar campos reales primero
console.log('Required:', V2_REQUIRED_FIELDS.timeshare_properties);

// ✅ Usar nombres correctos de columnas
await TimeshareProperty.create({
  name: 'Test Resort',
  slug: 'test-resort',
  city: 'Marbella',
  country: 'Spain',
  pms_provider: 'mews',
  program_type: 'FLOATING',
  // ... todos los campos requeridos
});
```

## 📁 Archivos Generados

### 1. V2_DATABASE_SCHEMA.json

```json
{
  "generatedAt": "2026-02-01T20:54:02.481Z",
  "database": "sw2_db",
  "tables": {
    "timeshare_properties": {
      "tableName": "timeshare_properties",
      "columns": {
        "name": { "type": "VARCHAR(255)", "nullable": false },
        "slug": { "type": "VARCHAR(255)", "nullable": false }
      },
      "requiredFields": ["name", "slug", ...],
      "optionalFields": ["id", "region", ...],
      "enums": {
        "pms_provider": ["mews", "cloudbeds", ...]
      }
    }
  }
}
```

### 2. V2_DATABASE_SCHEMA.md

Documentación humana con tablas markdown mostrando:
- ✅ Campos requeridos
- 🔹 Campos opcionales
- Tipos de datos
- Valores por defecto
- Opciones ENUM

### 3. tests/fixtures/v2-schema.ts

Helpers TypeScript:

```typescript
export const V2_REQUIRED_FIELDS = {
  timeshare_properties: [
    'name',
    'slug',
    'city',
    // ...
  ] as const,
};

export const V2_ENUMS = {
  timeshare_properties: {
    pms_provider: ['mews', 'cloudbeds', ...] as const,
  },
};

export function validateFixture(tableName, data): void {
  // Valida que data tenga todos los campos requeridos
}
```

## 🔄 Workflow Recomendado

### Para Desarrolladores

1. **Antes de escribir fixtures:**
   ```bash
   npm run document:schema
   cat docs_v2/V2_DATABASE_SCHEMA.md | grep -A 30 "timeshare_properties"
   ```

2. **Durante desarrollo:**
   - Consultar `V2_DATABASE_SCHEMA.md` para ver estructura exacta
   - Usar `V2_REQUIRED_FIELDS` para saber qué campos incluir
   - Usar `V2_ENUMS` para valores válidos

3. **Después de cambios en migrations:**
   ```bash
   npm run migrate:v2
   npm run document:schema  # ← Actualizar documentación
   git add docs_v2/ tests/fixtures/v2-schema.ts
   ```

### Para AI/Copilot

**Prompt recomendado:**

> "Antes de crear fixtures, lee `backend/docs_v2/V2_DATABASE_SCHEMA.md` para conocer la estructura exacta de las tablas V2. Usa solo los nombres de columnas que aparecen en ese archivo."

## ⚠️ Importante

1. **SIEMPRE** ejecutar `npm run document:schema` después de migrations
2. **NUNCA** asumir nombres de columnas - siempre consultar el schema
3. **COMMIT** los archivos generados (`V2_DATABASE_SCHEMA.*` y `v2-schema.ts`)
4. **REVISAR** el diff cuando cambie el schema

## 🤖 Automatización

### Pre-commit Hook (Opcional)

```bash
# .git/hooks/pre-commit
#!/bin/bash
if git diff --cached --name-only | grep -q "migrations_v2"; then
  echo "🔍 Migrations detectadas, actualizando schema..."
  npm run document:schema
  git add docs_v2/V2_DATABASE_SCHEMA.* tests/fixtures/v2-schema.ts
fi
```

### CI/CD Check

```yaml
# .github/workflows/ci.yml
- name: Verify schema is up to date
  run: |
    npm run document:schema
    git diff --exit-code docs_v2/ tests/fixtures/v2-schema.ts
```

## 📚 Referencias

- Script: `backend/scripts/document-v2-schema.js`
- Documentación: `backend/docs_v2/V2_DATABASE_SCHEMA.md`
- TypeScript Helper: `backend/tests/fixtures/v2-schema.ts`
- JSON Schema: `backend/docs_v2/V2_DATABASE_SCHEMA.json`
