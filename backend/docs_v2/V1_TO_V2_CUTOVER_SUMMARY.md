# Cambio Total V1 → V2 - Resumen Ejecutivo

## Decisión Estratégica

**Estrategia elegida:** Cutover total (cambio directo, sin migración gradual)

**Razones:**
1. ✅ **Simplicidad:** No necesitamos mantener V1 y V2 simultáneamente
2. ✅ **Velocidad:** Implementación más rápida (sin capa de compatibilidad)
3. ✅ **Código limpio:** Eliminamos todo el código legacy
4. ✅ **Menor coste:** Sin mantenimiento dual de sistemas

**Riesgos mitigados:**
- ✅ Testing exhaustivo antes del cambio
- ✅ Migración de datos probada en staging
- ✅ Plan de rollback con backup de base de datos
- ✅ Ventana de mantenimiento planificada

---

## Plan Actualizado

### ✅ Cambios realizados:

1. **SPEC actualizado** ([TIMESHARE_PLATFORM_V2_SPEC.md](../docs_v2/TIMESHARE_PLATFORM_V2_SPEC.md))
   - Phase 9 cambiada de "Gradual Migration" a "Complete Cutover"
   - Plan de cutover de 2-4 horas
   - Estrategia de rollback definida

2. **Plan de eliminación creado** ([V1_DECOMMISSION_PLAN.md](V1_DECOMMISSION_PLAN.md))
   - Lista completa de archivos V1 a eliminar (8 archivos)
   - Mapeo de tablas V1 → V2
   - Timeline de eliminación (30 días de gracia)

3. **Script de auditoría** ([audit-v1-code.js](../scripts/audit-v1-code.js))
   - Identifica automáticamente código V1
   - 46+ referencias a eliminar
   - 8 archivos principales a borrar

---

## Código V1 a Eliminar

### 📂 Archivos principales (8):

```
❌ src/models/TimeshareAllocation.ts
❌ src/models/SwapRequest.ts
❌ src/services/PrepaidInventoryService.ts
❌ src/services/swapService.ts
❌ src/controllers/TimeshareAllocationController.ts
❌ src/routes/prepaidInventoryRoutes.ts
❌ src/routes/swapRoutes.ts
❌ src/routes/staffSwapRoutes.ts
```

### 🔄 Archivos a refactorizar (2):

```
🔧 src/services/UnifiedSearchService.ts  (usar V2 repositories)
🔧 src/app.ts                            (rutas V1 → V2)
```

### 🗑️ Tablas de base de datos:

```sql
DROP TABLE timeshare_allocations;  -- Reemplazada por week_allocations
DROP TABLE swap_requests;          -- Feature no incluida en V2 inicial
DROP TABLE swap_transactions;      -- Feature no incluida en V2 inicial
```

---

## Timeline de Eliminación

### 📅 Día 1 (Post-Cutover)
- ✅ Comentar rutas V1 en app.ts (no borrar aún)
- ✅ Actualizar README y documentación
- ✅ V2 en producción funcionando

### 📅 Semana 1-4 (Período de gracia)
- ✅ Monitoreo intensivo
- ✅ Código V1 disponible para rollback de emergencia
- ❌ Sin eliminaciones de código

### 📅 Día 30 (Limpieza final)
- ✅ Eliminar los 8 archivos V1
- ✅ Refactorizar UnifiedSearchService
- ✅ Eliminar rutas V1 de app.ts
- ✅ Borrar tablas V1 de la base de datos
- ✅ Archivar código V1 en rama `v1-archive`

---

## Próximos Pasos

### Inmediato (Phase 2.5-3):
1. ✅ Completar Phase 2 (Service Layer) - **HECHO**
2. 🔄 Phase 2.5: Integration tests para servicios - **EN PROGRESO**
3. 📋 Phase 3: API Controllers (V2 routes)

### Pre-Cutover (Week 14):
4. 📋 Escribir script de migración de datos
5. 📋 Probar migración en staging
6. 📋 Preparar plan de rollback

### Cutover (Week 15 - Sábado 2AM):
7. 📋 Ventana de mantenimiento 2-4 horas
8. 📋 Backup → Migrate → Deploy → Test
9. 📋 Monitoreo intensivo 48 horas

### Post-Cutover (Week 16+):
10. 📋 Semana 1-4: Período de gracia (código V1 disponible)
11. 📋 Día 30: Eliminación total de código V1
12. 📋 Archivar V1, actualizar documentación

---

## Estado Actual

### ✅ Completado:
- Phase 0: Preparación (migraciones, schema)
- Phase 1: Core Domain Model (models, repositories)
- Phase 2: Core Services (5 services, 18/18 tests passing)
- TypeScript: 0 errores
- Documentation: V1_DECOMMISSION_PLAN.md creado

### 🔄 En progreso:
- Phase 2.5: Integration tests (siguiente tarea)

### 📋 Pendiente:
- Phase 3: API Controllers
- Phase 4: Unified Search (refactor)
- Phase 5: Booking Flow
- Week 14: Migration script
- Week 15: Cutover
- Day 30: V1 elimination

---

## Impacto en el Equipo

### Ventajas del cambio total:
1. ✅ **Desarrollo más rápido:** No necesitamos mantener compatibilidad V1/V2
2. ✅ **Código más limpio:** Sin lógica condicional V1/V2
3. ✅ **Menos bugs:** Una sola fuente de verdad
4. ✅ **Onboarding más fácil:** Solo aprender V2

### Requiere:
1. ⚠️ **Testing exhaustivo:** Antes del cutover
2. ⚠️ **Plan de rollback:** Por si acaso
3. ⚠️ **Ventana de mantenimiento:** 2-4 horas sin servicio
4. ⚠️ **Monitoreo intensivo:** 48 horas post-cutover

---

## Preguntas Resueltas

**Q: ¿Qué pasa con el código V1 durante el desarrollo de V2?**  
A: Se mantiene hasta el cutover. Funciona en paralelo pero sin cambios.

**Q: ¿Podemos usar características V1 y V2 mezcladas?**  
A: No. V2 es una reescritura completa. Usamos solo V2 después del cutover.

**Q: ¿Qué pasa si hay un bug crítico post-cutover?**  
A: Tenemos plan de rollback: backup DB + deploy V1 code en < 30 minutos.

**Q: ¿Cuánto downtime habrá?**  
A: 2-4 horas en ventana de mantenimiento (sábado 2AM-6AM).

**Q: ¿Qué pasa con los datos de usuarios/propietarios?**  
A: Se migran automáticamente con el script. Sin pérdida de datos.

---

## Métricas de Éxito

**El cutover es exitoso si:**
- ✅ 0% pérdida de datos
- ✅ Todas las funciones críticas operativas (auth, booking, search)
- ✅ Sin rollback en 48 horas
- ✅ Tasa de error < 0.1%
- ✅ Quejas de clientes < 5 (solo issues menores)

**La eliminación V1 está completa cuando:**
- ✅ Todo el código V1 eliminado del repo
- ✅ Todas las tablas V1 borradas
- ✅ Documentación actualizada (solo V2)
- ✅ Equipo entrenado en arquitectura V2
- ✅ Sin referencias V1 en logs/monitoring

---

## Recursos

- 📖 [Plan completo de eliminación V1](V1_DECOMMISSION_PLAN.md)
- 📖 [Especificación V2](../docs_v2/TIMESHARE_PLATFORM_V2_SPEC.md)
- 📖 [Schema V2](../docs_v2/V2_DATABASE_SCHEMA.md)
- 🔧 [Script de auditoría V1](../scripts/audit-v1-code.js)

---

**Decisión aprobada por:** Usuario  
**Fecha:** 1 Febrero 2026  
**Próxima revisión:** Post Phase 3 (Week 10)
