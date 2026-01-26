# Análisis de Simplificación - Vistas del Staff

**Fecha:** 25 de Enero, 2026  
**Objetivo:** Simplificar vistas del Staff siguiendo el mismo enfoque que con Owner

---

## 📊 Estado Actual: 14 Páginas

### Páginas Existentes:

1. **Dashboard.tsx** - Dashboard principal con stats
2. **StaffDashboard.tsx** - Dashboard alternativo (¿redundante?)
3. **Services.tsx** - Gestión de servicios solicitados por guests
4. **Rooms.tsx** - Gestión de habitaciones y disponibilidad
5. **Products.tsx** - Productos/amenidades del hotel
6. **PendingBookings.tsx** - Aprobar bookings de invitaciones
7. **History.tsx** - Historial de servicios
8. **Availability.tsx** - Calendario de disponibilidad
9. **Profile.tsx** - Perfil del staff
10. **MarketplaceSettings.tsx** - Configuración de marketplace
11. **SwapApprovals.tsx** - Aprobar swaps de owners
12. **AssignPeriod.tsx** - Asignar periodos a owners
13. **CreateOwnerInvitation.tsx** - Crear invitaciones para nuevos owners
14. **NightCreditRequests.tsx** - Aprobar solicitudes de night credits

---

## 🎯 Análisis Funcional

### Grupo 1: Dashboard y Operaciones Diarias
**Páginas:**
- Dashboard.tsx
- StaffDashboard.tsx (redundante)
- Services.tsx
- PendingBookings.tsx

**Funcionalidad:**
- Ver stats del día (check-ins, check-outs)
- Servicios pendientes de guests
- Bookings pendientes de aprobación
- Acciones rápidas

**Propuesta:** → **UnifiedDashboard**
- Tab 1: Resumen (stats + acciones rápidas)
- Tab 2: Servicios Pendientes (lista + aprobar/rechazar)
- Tab 3: Bookings Pendientes (lista + aprobar/rechazar)

---

### Grupo 2: Gestión de Property
**Páginas:**
- Rooms.tsx
- Products.tsx
- Availability.tsx
- MarketplaceSettings.tsx

**Funcionalidad:**
- Gestión de habitaciones (CRUD)
- Productos/amenidades del hotel
- Calendario de disponibilidad
- Habilitar/deshabilitar rooms en marketplace

**Propuesta:** → **PropertyManagement**
- Tab 1: Habitaciones (lista + CRUD + marketplace toggle)
- Tab 2: Productos (lista + CRUD)
- Tab 3: Disponibilidad (calendario + bloqueos)

---

### Grupo 3: Gestión de Owners
**Páginas:**
- CreateOwnerInvitation.tsx
- AssignPeriod.tsx
- SwapApprovals.tsx
- NightCreditRequests.tsx

**Funcionalidad:**
- Invitar nuevos owners
- Asignar periodos a owners existentes
- Aprobar swaps entre owners
- Aprobar conversiones a night credits

**Propuesta:** → **OwnerManagement**
- Tab 1: Invitaciones (crear + listar)
- Tab 2: Asignar Periodos
- Tab 3: Aprobaciones (Swaps + Night Credits)

---

### Grupo 4: Historial y Perfil
**Páginas:**
- History.tsx
- Profile.tsx

**Funcionalidad:**
- Historial de servicios completados
- Perfil personal del staff

**Propuesta:**
- History → Tab en UnifiedDashboard
- Profile → Mantener separado (similar a MyAccount de Owner)

---

## 🎨 Propuesta de Simplificación

### De 14 páginas → 4 páginas principales

```
┌─────────────────────────────────────────────────────┐
│              MENÚ SIMPLIFICADO STAFF                 │
├─────────────────────────────────────────────────────┤
│                                                      │
│  1. 📊 Dashboard                                     │
│     └─ Tab 1: Resumen del Día                        │
│     └─ Tab 2: Servicios Pendientes                   │
│     └─ Tab 3: Bookings Pendientes                    │
│     └─ Tab 4: Historial                              │
│                                                      │
│  2. 🏨 Property                                      │
│     └─ Tab 1: Habitaciones                           │
│     └─ Tab 2: Productos                              │
│     └─ Tab 3: Disponibilidad                         │
│                                                      │
│  3. 👥 Owners                                        │
│     └─ Tab 1: Crear Invitación                       │
│     └─ Tab 2: Asignar Periodo                        │
│     └─ Tab 3: Aprobaciones                           │
│                                                      │
│  4. 👤 Mi Perfil                                     │
│     └─ Información personal                          │
│     └─ Cambiar contraseña                            │
│                                                      │
│  5. 🛒 Marketplace (mantener)                        │
│     └─ Vista pública del marketplace                 │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Resultado:**
- **De 14 páginas → 5 páginas** (64% reducción)
- **De 14 items de menú → 5 items** (64% reducción)
- Navegación más clara y enfocada

---

## 📋 Comparativa Antes vs Después

### ANTES (14 items de menú):
```
1. Dashboard
2. Services
3. Rooms
4. Products
5. Bookings Pendientes
6. Swap Approvals
7. Create Owner Invitation
8. Assign Period
9. Marketplace Settings
10. Marketplace
11. History (?)
12. Availability (?)
13. Profile (?)
14. Night Credit Requests (?)
```

### DESPUÉS (5 items de menú):
```
1. 📊 Dashboard
   └─ Resumen + Servicios + Bookings + Historial

2. 🏨 Property
   └─ Habitaciones + Productos + Disponibilidad

3. 👥 Owners
   └─ Invitaciones + Asignar + Aprobaciones

4. 👤 Mi Perfil

5. 🛒 Marketplace
```

---

## 🔄 Flujos Típicos del Staff

### Flujo 1: Atender Servicio de Guest (Operación Diaria)
**Antes:**
```
Dashboard → Click "Services" en menú → Ver lista → Aprobar
(3 clicks + cambio de página)
```

**Después:**
```
Dashboard → Tab "Servicios" → Aprobar
(2 clicks + sin cambio de página)
```

---

### Flujo 2: Invitar Nuevo Owner
**Antes:**
```
Dashboard → Click "Create Owner Invitation" → Formulario
(2 clicks + cambio de página)
```

**Después:**
```
Dashboard → Click "Owners" → Tab "Invitaciones" → Formulario
(3 clicks pero todo organizado)
```

---

### Flujo 3: Aprobar Booking de Invitación
**Antes:**
```
Dashboard → Click "Bookings Pendientes" → Ver lista → Aprobar
(3 clicks + cambio de página)
```

**Después:**
```
Dashboard → Tab "Bookings" → Aprobar
(2 clicks + sin cambio de página)
```

---

### Flujo 4: Gestionar Habitaciones
**Antes:**
```
Dashboard → Click "Rooms" → CRUD
Click "Marketplace Settings" → Habilitar en marketplace
(Dos páginas separadas para funcionalidad relacionada)
```

**Después:**
```
Dashboard → Click "Property" → Tab "Habitaciones" → CRUD + toggle marketplace
(Todo en un solo lugar)
```

---

## 🎯 Arquitectura de las Nuevas Páginas

### 1. UnifiedDashboard.tsx

```typescript
interface UnifiedDashboardProps {}

function UnifiedDashboard() {
  const [activeTab, setActiveTab] = useState<'summary' | 'services' | 'bookings' | 'history'>('summary');
  
  // Queries
  const { data: stats } = useStaffStats();
  const { data: services } = useQuery(['staff-services']);
  const { data: bookings } = useQuery(['pending-bookings']);
  const { data: history } = useQuery(['service-history']);
  
  // Mutations
  const approveService = useMutation(...);
  const approveBooking = useMutation(...);
  
  return (
    <div>
      {/* Stats Cards - Siempre visibles */}
      <StatsGrid stats={stats} />
      
      {/* Tabs */}
      <TabNavigation activeTab={activeTab} onChange={setActiveTab} />
      
      {/* Tab Content */}
      {activeTab === 'summary' && <SummaryView stats={stats} />}
      {activeTab === 'services' && <ServicesTab services={services} onApprove={approveService} />}
      {activeTab === 'bookings' && <BookingsTab bookings={bookings} onApprove={approveBooking} />}
      {activeTab === 'history' && <HistoryTab history={history} />}
    </div>
  );
}
```

**Features:**
- Stats cards con métricas del día
- Tab "Resumen": Quick stats + acciones rápidas
- Tab "Servicios": Lista de servicios pendientes con botones aprobar/rechazar
- Tab "Bookings": Lista de bookings de invitación pendientes
- Tab "Historial": Servicios completados

---

### 2. PropertyManagement.tsx

```typescript
interface PropertyManagementProps {}

function PropertyManagement() {
  const [activeTab, setActiveTab] = useState<'rooms' | 'products' | 'availability'>('rooms');
  
  // Queries
  const { data: rooms } = useQuery(['staff-rooms']);
  const { data: products } = useQuery(['staff-products']);
  const { data: calendar } = useQuery(['property-availability']);
  
  // Mutations
  const createRoom = useMutation(...);
  const toggleMarketplace = useMutation(...);
  const createProduct = useMutation(...);
  
  return (
    <div>
      <TabNavigation activeTab={activeTab} onChange={setActiveTab} />
      
      {activeTab === 'rooms' && (
        <RoomsTab 
          rooms={rooms} 
          onCreate={createRoom}
          onToggleMarketplace={toggleMarketplace}
        />
      )}
      
      {activeTab === 'products' && (
        <ProductsTab 
          products={products} 
          onCreate={createProduct}
        />
      )}
      
      {activeTab === 'availability' && (
        <AvailabilityCalendar 
          calendar={calendar}
        />
      )}
    </div>
  );
}
```

**Features:**
- Tab "Habitaciones": CRUD de rooms + toggle marketplace + stats
- Tab "Productos": CRUD de productos/amenidades
- Tab "Disponibilidad": Calendario con bloqueos

---

### 3. OwnerManagement.tsx

```typescript
interface OwnerManagementProps {}

function OwnerManagement() {
  const [activeTab, setActiveTab] = useState<'invitations' | 'assign' | 'approvals'>('invitations');
  
  // Queries
  const { data: invitations } = useQuery(['owner-invitations']);
  const { data: swaps } = useQuery(['pending-swaps']);
  const { data: nightCredits } = useQuery(['night-credit-requests']);
  
  return (
    <div>
      <TabNavigation activeTab={activeTab} onChange={setActiveTab} />
      
      {activeTab === 'invitations' && <InvitationsTab />}
      {activeTab === 'assign' && <AssignPeriodTab />}
      {activeTab === 'approvals' && (
        <ApprovalsTab 
          swaps={swaps}
          nightCredits={nightCredits}
        />
      )}
    </div>
  );
}
```

**Features:**
- Tab "Invitaciones": Crear nueva + listar enviadas
- Tab "Asignar": Asignar periodos a owners existentes
- Tab "Aprobaciones": Swaps + Night Credits en listas separadas

---

### 4. StaffProfile.tsx

```typescript
interface StaffProfileProps {}

function StaffProfile() {
  const { data: user } = useAuth();
  
  return (
    <div>
      <ProfileForm user={user} />
      <ChangePasswordSection />
    </div>
  );
}
```

**Features:**
- Información personal (nombre, email, phone)
- Cambiar contraseña
- Property asignada (read-only)

---

## ⚙️ Componentes Reutilizables

### StatsGrid
```typescript
interface Stat {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'yellow' | 'red';
}

function StatsGrid({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map(stat => (
        <StatCard key={stat.label} {...stat} />
      ))}
    </div>
  );
}
```

### TabNavigation
```typescript
interface Tab {
  id: string;
  label: string;
  badge?: number;
}

function TabNavigation({ tabs, activeTab, onChange }: TabNavigationProps) {
  return (
    <div className="border-b border-gray-200">
      <nav className="flex space-x-8">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={activeTab === tab.id ? 'active' : ''}
          >
            {tab.label}
            {tab.badge && <span className="badge">{tab.badge}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}
```

### ApprovalCard
```typescript
interface Approval {
  id: number;
  title: string;
  description: string;
  requester: string;
  date: string;
}

function ApprovalCard({ approval, onApprove, onReject }: ApprovalCardProps) {
  return (
    <div className="border rounded-lg p-4">
      <h3>{approval.title}</h3>
      <p>{approval.description}</p>
      <div className="flex gap-2 mt-4">
        <button onClick={() => onApprove(approval.id)} className="btn-success">
          ✓ Aprobar
        </button>
        <button onClick={() => onReject(approval.id)} className="btn-danger">
          ✗ Rechazar
        </button>
      </div>
    </div>
  );
}
```

---

## 🚀 Plan de Implementación

### Fase 1: UnifiedDashboard (2 días)
1. Crear componente base con tabs
2. Tab "Resumen": Migrar stats de Dashboard.tsx actual
3. Tab "Servicios": Migrar Services.tsx
4. Tab "Bookings": Migrar PendingBookings.tsx
5. Tab "Historial": Migrar History.tsx
6. Testing: Verificar todos los flujos

### Fase 2: PropertyManagement (2 días)
1. Crear componente base con tabs
2. Tab "Habitaciones": Migrar Rooms.tsx + MarketplaceSettings
3. Tab "Productos": Migrar Products.tsx
4. Tab "Disponibilidad": Migrar Availability.tsx
5. Testing: CRUD de rooms y products

### Fase 3: OwnerManagement (2 días)
1. Crear componente base con tabs
2. Tab "Invitaciones": Migrar CreateOwnerInvitation.tsx
3. Tab "Asignar": Migrar AssignPeriod.tsx
4. Tab "Aprobaciones": Migrar SwapApprovals.tsx + NightCreditRequests.tsx
5. Testing: Flujo completo de invitaciones

### Fase 4: Actualizar Navegación (1 día)
1. Actualizar Sidebar.tsx con nuevo menú
2. Actualizar App.tsx con nuevas rutas
3. Eliminar rutas legacy
4. Testing: Navegación completa

**Total: 7 días (1.5 semanas)**

---

## 📊 Métricas de Mejora

### Reducción de Complejidad
- **Páginas:** 14 → 5 (64% reducción)
- **Items de menú:** 14 → 5 (64% reducción)
- **Clicks promedio:** 3 → 2 (33% reducción)
- **Cambios de página:** Reducidos significativamente

### Mejoras de UX
- ✅ Todo el contenido relacionado en un solo lugar
- ✅ Sin cambios de página para operaciones frecuentes
- ✅ Navegación más clara y predecible
- ✅ Menos carga cognitiva para el staff

---

## ⚠️ Consideraciones

### 1. **Mantener Marketplace Separado**
El marketplace es una funcionalidad pública que staff puede consultar pero no es parte de su trabajo diario. Mantener separado.

### 2. **Perfil Separado**
Similar a Owner, el perfil no se usa frecuentemente así que mantenerlo como página separada está bien.

### 3. **Dashboard vs StaffDashboard**
Actualmente hay dos dashboards:
- `Dashboard.tsx` - Más completo, con stats reales
- `StaffDashboard.tsx` - Básico, solo muestra staff requests

**Decisión:** Usar Dashboard.tsx como base y eliminar StaffDashboard.tsx

### 4. **Night Credit Requests**
Actualmente es página separada pero se usa poco. Integrar en OwnerManagement → Tab "Aprobaciones"

---

## 🎯 Archivos a Modificar

### Crear:
1. `frontend/src/pages/staff/UnifiedDashboard.tsx`
2. `frontend/src/pages/staff/PropertyManagement.tsx`
3. `frontend/src/pages/staff/OwnerManagement.tsx`
4. `frontend/src/components/staff/StatsGrid.tsx`
5. `frontend/src/components/staff/TabNavigation.tsx`
6. `frontend/src/components/staff/ApprovalCard.tsx`

### Modificar:
1. `frontend/src/App.tsx` - Actualizar rutas
2. `frontend/src/components/layout/Sidebar.tsx` - Simplificar menú
3. `frontend/src/pages/staff/Profile.tsx` - Ajustar si es necesario

### Deprecar (mantener pero no linkear):
1. `Dashboard.tsx` → Migrado a UnifiedDashboard
2. `StaffDashboard.tsx` → Eliminar (redundante)
3. `Services.tsx` → Migrado a UnifiedDashboard Tab
4. `Rooms.tsx` → Migrado a PropertyManagement Tab
5. `Products.tsx` → Migrado a PropertyManagement Tab
6. `PendingBookings.tsx` → Migrado a UnifiedDashboard Tab
7. `History.tsx` → Migrado a UnifiedDashboard Tab
8. `Availability.tsx` → Migrado a PropertyManagement Tab
9. `MarketplaceSettings.tsx` → Migrado a PropertyManagement Tab
10. `SwapApprovals.tsx` → Migrado a OwnerManagement Tab
11. `AssignPeriod.tsx` → Migrado a OwnerManagement Tab
12. `CreateOwnerInvitation.tsx` → Migrado a OwnerManagement Tab
13. `NightCreditRequests.tsx` → Migrado a OwnerManagement Tab

---

## ✅ Checklist de Implementación

### Pre-implementación
- [ ] Revisar este análisis con el equipo
- [ ] Validar flujos propuestos
- [ ] Decidir sobre StaffDashboard.tsx (eliminar vs mantener)

### Fase 1: UnifiedDashboard
- [ ] Crear componente base
- [ ] Implementar Tab "Resumen"
- [ ] Implementar Tab "Servicios"
- [ ] Implementar Tab "Bookings"
- [ ] Implementar Tab "Historial"
- [ ] Testing E2E

### Fase 2: PropertyManagement
- [ ] Crear componente base
- [ ] Implementar Tab "Habitaciones"
- [ ] Implementar Tab "Productos"
- [ ] Implementar Tab "Disponibilidad"
- [ ] Testing E2E

### Fase 3: OwnerManagement
- [ ] Crear componente base
- [ ] Implementar Tab "Invitaciones"
- [ ] Implementar Tab "Asignar"
- [ ] Implementar Tab "Aprobaciones"
- [ ] Testing E2E

### Fase 4: Integración
- [ ] Actualizar Sidebar.tsx
- [ ] Actualizar App.tsx
- [ ] Eliminar imports legacy
- [ ] Testing navegación completa
- [ ] Compilar frontend (0 errores)

---

## 🎉 Resultado Esperado

**De 14 páginas → 5 páginas (64% reducción)**

**Menú Final del Staff:**
```
📊 Dashboard
   └─ Operaciones del día

🏨 Property
   └─ Gestión del hotel

👥 Owners
   └─ Gestión de propietarios

👤 Mi Perfil
   └─ Información personal

🛒 Marketplace
   └─ Vista pública
```

**Experiencia del Staff:**
- ✅ Menos navegación
- ✅ Más eficiencia
- ✅ Todo el contexto en una pantalla
- ✅ Menos carga cognitiva

---

**Documento generado:** 25 de Enero, 2026  
**Versión:** 1.0 - Propuesta de Simplificación Staff
