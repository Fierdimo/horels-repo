# 🚀 Inicio Rápido - Sincronización de Habitaciones

## Estado Actual
- ✅ Base de datos limpia (0 habitaciones)
- ✅ Propiedad PMS configurada: **API Hotel (Gross Pricing) - Do not change** (ID: 29)
- ✅ PMS: Mews (Vienna Hotel)
- ✅ Sistema listo para sincronizar desde la aplicación web

## 📱 Cómo Sincronizar Habitaciones

### Opción 1: Desde la Aplicación Web (RECOMENDADO)

1. **Iniciar la aplicación:**
   ```bash
   # Terminal 1 - Backend
   cd backend
   npm run dev
   
   # Terminal 2 - Frontend
   cd frontend
   npm run dev
   ```

2. **Acceder a la aplicación:**
   - URL: http://localhost:5173
   - Usuario: Staff asignado a la propiedad 29

3. **Sincronizar habitaciones:**
   - Navegar a: **Rooms** / **Habitaciones**
   - Click en botón: **"Sync from PMS"** (ícono refresh)
   - Esperar unos segundos (sincronizando 500 habitaciones)
   - ✅ Ver mensaje de éxito
   - ✅ Las habitaciones aparecerán en la lista

### Opción 2: Via API (Para Testing)

```bash
# 1. Obtener token (login como staff)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "staff@hotel.com", "password": "password"}'

# 2. Sincronizar (usar el token obtenido)
curl -X POST http://localhost:3000/api/hotel-staff/rooms/sync \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

## 📊 Resultado Esperado

Después de la sincronización:
- **500 habitaciones** sincronizadas desde Mews
- Todas con `is_marketplace_enabled = false`
- Staff puede activarlas para marketplace
- Datos en tiempo real del PMS (nombre, precio, estado, etc.)

## 🔄 Sincronización Automática

El frontend **sincroniza automáticamente** en estos casos:
- ✅ Primera vez que staff accede a la página de habitaciones
- ✅ Cuando no hay habitaciones en la base de datos
- ✅ Sin necesidad de hacer click en el botón

## 🎯 Próximos Pasos

1. **Activar habitaciones en marketplace:**
   - En la lista de habitaciones
   - Toggle "Marketplace Enabled"
   - Solo habitaciones activas se muestran a guests

2. **Configurar precios personalizados (opcional):**
   - Editar habitación
   - Establecer "Custom Price"
   - Override del precio del PMS

3. **Agregar imágenes (opcional):**
   - Editar habitación
   - Agregar URLs de imágenes
   - Para mejor presentación en marketplace

## 🐛 Si algo no funciona

### Backend no inicia:
```bash
cd backend
npm install
npm run dev
```

### Frontend no inicia:
```bash
cd frontend
npm install
npm run dev
```

### No aparece el botón "Sync from PMS":
- Verificar que estás logueado como **Staff** o **Admin**
- Verificar que el usuario está asignado a la **propiedad 29**

### Error "No PMS configured":
```bash
# Verificar credenciales en backend/.env
MEWS_CLIENT_ID=E0D439EE522F44368DC78E1BFB03710C-D24FB11DBE31D4621C4817E028D9E1D
MEWS_CLIENT_SECRET=C66EF7B239D24632943D115EDE9CB810-EA00F8FD8294692C940F6B5A8F9453D
MEWS_BASE_URL=https://api.mews-demo.com
USE_REAL_PMS=true
```

## ✅ Verificación

```bash
# Verificar habitaciones sincronizadas
docker exec -it sw2_mariadb mysql -u sw2_user -psw2_password sw2_db -e "SELECT COUNT(*) as total FROM rooms;"

# Ver primeras 5 habitaciones
docker exec -it sw2_mariadb mysql -u sw2_user -psw2_password sw2_db -e "SELECT id, pms_resource_id, is_marketplace_enabled FROM rooms LIMIT 5;"
```

## 📚 Documentación Adicional

- [SINCRONIZACION_APLICACION.md](SINCRONIZACION_APLICACION.md) - Guía detallada
- [PMS_SYNC_SUMMARY.md](PMS_SYNC_SUMMARY.md) - Resumen completo
- [COMANDOS_UTILES.md](COMANDOS_UTILES.md) - Comandos rápidos

---

**¡El sistema está listo! Inicia la aplicación y sincroniza desde el botón en la interfaz web.**
