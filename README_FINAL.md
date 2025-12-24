# 🎯 INSTRUCCIONES FINALES - Sistema Listo

## ✅ Estado del Sistema

- ✅ Base de datos limpia y lista
- ✅ Propiedad PMS configurada (ID: 29)
- ✅ Usuarios staff disponibles
- ✅ Sincronización automática implementada
- ✅ Frontend y Backend listos

## 🔐 Credenciales de Acceso

### Usuario Staff #1
```
Email: test@hotel.com
Password: (usar el password configurado)
Nombre: jon doe
Propiedad: API Hotel (Gross Pricing) - ID: 29
```

### Usuario Staff #2
```
Email: apihotel@test.com
Password: (usar el password configurado)
Nombre: Jaime Moron
Propiedad: API Hotel (Gross Pricing) - ID: 29
```

## 🚀 Pasos para Sincronizar

### 1. Iniciar la Aplicación

```bash
# Terminal 1 - Backend (Puerto 3000)
cd backend
npm run dev

# Terminal 2 - Frontend (Puerto 5173)
cd frontend
npm run dev
```

### 2. Acceder al Sistema

1. Abrir navegador: **http://localhost:5173**
2. Login con cualquiera de los usuarios staff
3. Navegar a: **Rooms** / **Habitaciones**

### 3. Sincronizar Habitaciones

**AUTOMÁTICO:** 
- El sistema sincronizará automáticamente al entrar a la página de habitaciones
- Si no hay habitaciones, se sincronizará solo

**MANUAL:**
- Click en botón **"Sync from PMS"** (ícono refresh)
- Esperar ~5-10 segundos
- Ver mensaje de éxito
- **500 habitaciones** aparecerán en la lista

## 📊 Resultado Esperado

```
✅ 500 habitaciones sincronizadas
✅ Datos en tiempo real desde Mews
✅ Todas las habitaciones con marketplace_enabled = false
✅ Staff puede activar/editar habitaciones
```

## 🎨 Funcionalidades Disponibles

### En la Página de Habitaciones:

1. **Ver lista completa** de 500 habitaciones
2. **Buscar** por nombre, tipo, piso
3. **Filtrar** por estado, tipo, capacidad
4. **Activar/Desactivar** marketplace
5. **Editar** precio personalizado
6. **Agregar** imágenes
7. **Sincronizar** manualmente desde PMS

### Datos Mostrados (del PMS):
- Nombre de habitación
- Tipo
- Capacidad
- Piso
- Estado (available, occupied, etc.)
- Precio base
- Amenidades

## 🔄 Cómo Funciona

```
Frontend (Staff clicks "Sync")
    ↓
POST /api/hotel-staff/rooms/sync
    ↓
Backend: staffRoomController.syncRooms()
    ↓
roomSyncService.syncRoomsFromPMS(29)
    ↓
PMSFactory.getAdapter(29) → MewsAdapter
    ↓
adapter.getAvailability() → API Mews
    ↓
Guardar mapeos en BD (pmsResourceId, propertyId)
    ↓
RoomEnrichmentService.enrichRooms()
    ↓
Combinar datos BD + datos PMS en tiempo real
    ↓
Retornar 500 habitaciones enriquecidas
    ↓
Frontend: Mostrar lista + Toast success
```

## 📝 Verificación Manual

### Ver habitaciones sincronizadas:
```bash
docker exec -it sw2_mariadb mysql -u sw2_user -psw2_password sw2_db -e "SELECT COUNT(*) as total FROM rooms;"
```

### Ver primeras 10 habitaciones:
```bash
docker exec -it sw2_mariadb mysql -u sw2_user -psw2_password sw2_db -e "SELECT id, pms_resource_id, is_marketplace_enabled, pms_last_sync FROM rooms LIMIT 10;"
```

## 🎯 Próximos Pasos Después de Sincronizar

1. **Activar habitaciones en marketplace:**
   - Toggle el switch "Marketplace Enabled"
   - Solo habitaciones activas se muestran a guests

2. **Configurar precios personalizados:**
   - Click en "Edit" para una habitación
   - Agregar "Custom Price" (opcional)
   - Sobrescribe el precio del PMS

3. **Agregar imágenes:**
   - En el modal de edición
   - Agregar URLs de imágenes
   - Mejora presentación visual

## 🐛 Troubleshooting

### No aparecen habitaciones:
1. Verificar que backend está corriendo (puerto 3000)
2. Verificar logs de backend para errores
3. Verificar credenciales Mews en `.env`
4. Click manual en "Sync from PMS"

### Error "No PMS configured":
- Verificar en BD que propiedad 29 tiene:
  - `pms_provider = 'mews'`
  - `pms_sync_enabled = 1`
  - `pms_credentials` no es NULL

### No puedo hacer login:
- Resetear password del usuario
- Verificar que usuario está `approved`
- Verificar que usuario tiene role `staff`

## ✅ Checklist Final

Antes de usar el sistema, verificar:

- [ ] Backend corriendo en http://localhost:3000
- [ ] Frontend corriendo en http://localhost:5173
- [ ] Base de datos MariaDB corriendo (Docker)
- [ ] Redis corriendo (Docker) - opcional para workers
- [ ] Variables de entorno en `backend/.env`:
  - [ ] `USE_REAL_PMS=true`
  - [ ] `MEWS_CLIENT_ID` configurado
  - [ ] `MEWS_CLIENT_SECRET` configurado
  - [ ] `MEWS_BASE_URL=https://api.mews-demo.com`
- [ ] Usuario staff existe y está approved
- [ ] Usuario staff está asignado a propiedad 29

## 📚 Documentación

- [INICIO_RAPIDO.md](INICIO_RAPIDO.md) - Guía de inicio rápido
- [SINCRONIZACION_APLICACION.md](SINCRONIZACION_APLICACION.md) - Detalles técnicos
- [PMS_SYNC_SUMMARY.md](PMS_SYNC_SUMMARY.md) - Resumen completo
- [COMANDOS_UTILES.md](COMANDOS_UTILES.md) - Comandos de terminal

---

## 🎉 ¡Todo Listo!

El sistema está configurado y listo para sincronizar habitaciones desde la aplicación web.

**Siguiente paso:** Iniciar la aplicación y hacer login como staff → Ver página Rooms → Sistema sincronizará automáticamente.

**No se necesitan scripts externos. Todo funciona desde la interfaz web.**
