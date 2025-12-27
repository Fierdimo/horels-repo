# Sistema de Créditos - Frontend Fase 1 Completada

## 📦 Archivos Creados

### Tipos TypeScript
- **`src/types/credits.ts`** - Tipos e interfaces completos para el sistema de créditos
  - Modelos de datos (CreditWallet, CreditTransaction, PropertyTier, etc.)
  - Tipos de solicitud/respuesta para API
  - Tipos helper para UI

### Servicio API
- **`src/api/credits.ts`** - Cliente API para endpoints de créditos
  - `getWallet()` - Obtener billetera del usuario
  - `getTransactions()` - Historial con paginación
  - `depositWeek()` - Depositar semana por créditos
  - `estimateCredits()` - Calcular créditos estimados
  - `checkAffordability()` - Verificar si puede pagar
  - `spendCredits()` - Gastar créditos en reserva
  - `refundCredits()` - Reembolsar créditos
  - `getRate()` - Tasa de conversión crédito/euro
  - `getExpiringCredits()` - Créditos próximos a expirar

### Componentes UI (Fase 1)

#### 1. **CreditWalletWidget.tsx**
Widget de billetera de créditos con información completa del balance.

**Props:**
```typescript
{
  userId: number;
  onDepositClick?: () => void;
  className?: string;
}
```

**Características:**
- Muestra balance actual
- Total ganado, gastado, expirado, reembolsado
- Alerta de créditos próximos a expirar (30 días)
- Botón para depositar semana
- Diseño con gradiente azul atractivo
- Estados de carga y error

**Uso:**
```tsx
<CreditWalletWidget 
  userId={user.id} 
  onDepositClick={() => setDepositModalOpen(true)}
/>
```

#### 2. **TransactionHistoryTable.tsx**
Tabla de historial de transacciones con paginación.

**Props:**
```typescript
{
  userId: number;
  pageSize?: number; // default: 10
  className?: string;
}
```

**Características:**
- Lista de todas las transacciones del usuario
- Iconos por tipo (depósito ↑, gasto ↓, reembolso ↻)
- Estados con badges de colores
- Información de expiración
- Referencias (week, booking, swap)
- Paginación con botones prev/next
- Botón de refrescar
- Estados de carga, error y vacío

**Uso:**
```tsx
<TransactionHistoryTable 
  userId={user.id} 
  pageSize={5}
/>
```

#### 3. **ExpirationAlert.tsx**
Alerta visual de créditos próximos a expirar.

**Props:**
```typescript
{
  userId: number;
  warningDays?: number; // default: 30
  onClose?: () => void;
  className?: string;
}
```

**Características:**
- 3 niveles de urgencia (crítico: ≤7 días, advertencia: ≤14 días, info: ≤30 días)
- Colores según urgencia (rojo, amarillo, azul)
- Lista de hasta 3 transacciones próximas a expirar
- Botón para cerrar/descartar
- Solo aparece si hay créditos expirando
- Sugerencia de acción

**Uso:**
```tsx
<ExpirationAlert 
  userId={user.id} 
  warningDays={30}
/>
```

#### 4. **EstimateCreditsTool.tsx**
Calculadora interactiva de créditos.

**Props:**
```typescript
{
  onEstimateComplete?: (estimatedCredits: number) => void;
  className?: string;
}
```

**Características:**
- Selección de temporada (RED/WHITE/BLUE)
- Selección de nivel de ubicación (DIAMOND a STANDARD)
- Selección de tipo de habitación (PRESIDENTIAL a STANDARD)
- Botón de calcular
- Resultado con desglose detallado
- Información de expiración estimada
- Fórmula visible
- Callback al completar estimación

**Uso:**
```tsx
<EstimateCreditsTool 
  onEstimateComplete={(credits) => console.log(credits)}
/>
```

#### 5. **DepositWeekModal.tsx**
Modal completo para depositar semana por créditos.

**Props:**
```typescript
{
  userId: number;
  weekId?: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (creditsEarned: number) => void;
  className?: string;
}
```

**Características:**
- Modal con 3 pasos: calcular → confirmar → éxito
- Formulario para seleccionar temporada, ubicación y tipo de habitación
- Cálculo de créditos estimados
- Pantalla de confirmación con información importante
- Pantalla de éxito
- Auto-cierre después de depósito exitoso (3 segundos)
- Callback al completar exitosamente
- Manejo de errores

**Uso:**
```tsx
const [modalOpen, setModalOpen] = useState(false);

<DepositWeekModal
  userId={user.id}
  weekId={weekId} // opcional
  isOpen={modalOpen}
  onClose={() => setModalOpen(false)}
  onSuccess={(creditsEarned) => {
    console.log('Credits earned:', creditsEarned);
    // Refrescar datos, mostrar toast, etc.
  }}
/>
```

### Archivo de Índice
- **`src/components/common/index.ts`** - Exportaciones centralizadas

---

## 🎨 Integración en Dashboard de Usuario

El dashboard de invitados (`GuestDashboard.tsx`) ha sido actualizado para incluir:

1. **Sección de Sistema de Créditos** (arriba del dashboard)
   - ExpirationAlert (si hay créditos expirando)
   - Grid 1/3 - 2/3:
     - CreditWalletWidget (izquierda)
     - TransactionHistoryTable (derecha, últimas 5 transacciones)

2. **Modal de Depósito**
   - DepositWeekModal controlado por estado local
   - Abre al hacer clic en "Depositar Semana" del widget

---

## 🚀 Cómo Usar

### Importar Componentes
```tsx
import { 
  CreditWalletWidget, 
  TransactionHistoryTable, 
  ExpirationAlert,
  DepositWeekModal,
  EstimateCreditsTool 
} from '@/components/common';
```

### Ejemplo Completo
```tsx
import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { 
  CreditWalletWidget, 
  TransactionHistoryTable, 
  ExpirationAlert,
  DepositWeekModal 
} from '@/components/common';

export default function MyPage() {
  const { user } = useAuthStore();
  const [depositModalOpen, setDepositModalOpen] = useState(false);

  if (!user) return null;

  return (
    <div className="p-8 space-y-6">
      {/* Alerta de Expiración */}
      <ExpirationAlert 
        userId={user.id} 
        warningDays={30}
      />

      {/* Grid de Billetera y Transacciones */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <CreditWalletWidget 
            userId={user.id} 
            onDepositClick={() => setDepositModalOpen(true)}
          />
        </div>
        <div className="lg:col-span-2">
          <TransactionHistoryTable 
            userId={user.id} 
            pageSize={10}
          />
        </div>
      </div>

      {/* Modal de Depósito */}
      <DepositWeekModal
        userId={user.id}
        isOpen={depositModalOpen}
        onClose={() => setDepositModalOpen(false)}
        onSuccess={(credits) => {
          console.log('Deposited:', credits);
          // Refrescar datos o mostrar notificación
        }}
      />
    </div>
  );
}
```

---

## 🎨 Diseño y Estilos

Todos los componentes usan **Tailwind CSS** con:
- Colores consistentes (azul para principal, verde para ganancias, rojo para gastos)
- Estados de hover y transiciones suaves
- Diseño responsive (mobile-first)
- Iconos de **lucide-react**
- Estados de carga con spinners
- Estados de error con mensajes claros
- Estados vacíos con ilustraciones

### Paleta de Colores
- **Azul** (primary): Sistema, acciones principales
- **Verde**: Depósitos, ganancias, éxito
- **Rojo**: Gastos, crítico, error
- **Amarillo**: Advertencias, expiraciones próximas
- **Gris**: Neutral, expirado, cancelado

---

## 📱 Responsividad

Todos los componentes son completamente responsive:

- **Mobile** (< 768px):
  - Columnas apiladas verticalmente
  - Texto y botones más grandes
  - Modal ocupa toda la pantalla

- **Tablet** (768px - 1024px):
  - Grids de 2 columnas
  - Espaciado optimizado

- **Desktop** (> 1024px):
  - Grids de 3 columnas
  - Máximo ancho con margen centrado
  - Uso completo del espacio

---

## 🔄 Actualización de Datos

### Recargar Wallet
```tsx
// El componente CreditWalletWidget recarga automáticamente cuando cambia userId
// Para forzar recarga, usa un key prop:
<CreditWalletWidget 
  key={refreshKey} 
  userId={user.id}
/>
```

### Recargar Transacciones
```tsx
// El componente TransactionHistoryTable tiene botón de refrescar integrado
// También recarga automáticamente cuando cambia la página o userId
```

### Después de Operaciones
```tsx
<DepositWeekModal
  onSuccess={(credits) => {
    // Opción 1: Recargar página
    window.location.reload();

    // Opción 2: Usar react-query para invalidar cache
    queryClient.invalidateQueries(['wallet', userId]);
    
    // Opción 3: Cambiar key para forzar re-render
    setRefreshKey(Date.now());

    // Opción 4: Mostrar notificación toast
    toast.success(`¡${credits} créditos depositados!`);
  }}
/>
```

---

## 🛠️ Próximos Pasos

### Fase 2: Proceso de Reserva (Pendiente)
- **BookingPaymentSelector** - Selector de método de pago
- **CreditAffordabilityChecker** - Verificador de saldo
- **HybridPaymentCalculator** - Calculador de pago híbrido
- **BookingConfirmationSummary** - Resumen con créditos

### Fase 3: Gestión de Créditos (Pendiente)
- **RefundCreditModal** - Modal de reembolso
- **CreditHistoryFilters** - Filtros avanzados
- **CreditBalanceChart** - Gráfico de evolución

### Fase 4: Panel Admin (Pendiente)
- **PropertyTierManager** - Gestor de niveles
- **SeasonalCalendarEditor** - Editor de calendario
- **RoomMultiplierConfig** - Configurador de multiplicadores
- **BookingCostManager** - Gestor de costos

---

## 📝 Notas Técnicas

### Dependencias Requeridas
Todas ya están instaladas en el proyecto:
- `axios` - Cliente HTTP
- `date-fns` - Manipulación de fechas
- `lucide-react` - Iconos
- `react-hook-form` - (para futuros formularios)
- `zod` - (para validación futura)
- `recharts` - (para gráficos futuros)

### TypeScript
Todos los componentes y tipos están completamente tipados con TypeScript.
No hay `any` types sin documentar.

### API Backend
Los componentes asumen que el backend está corriendo en la URL configurada en `src/utils/constants.ts` (`API_URL`).

Endpoints esperados:
```
GET    /api/credits/wallet/:userId
GET    /api/credits/transactions/:userId?page=1&limit=10
POST   /api/credits/deposit
POST   /api/credits/estimate
POST   /api/credits/check-affordability
POST   /api/credits/spend
POST   /api/credits/refund
GET    /api/credits/rate
GET    /api/credits/expiring/:userId?days=30
```

### Autenticación
Todos los requests usan el token JWT almacenado en `localStorage` (manejado por `src/api/client.ts`).

---

## ✅ Completado

- [x] Tipos TypeScript completos
- [x] Servicio API con 9 funciones
- [x] 5 componentes de Fase 1
- [x] Integración en GuestDashboard
- [x] Diseño responsive
- [x] Estados de carga/error/vacío
- [x] Documentación completa

---

**Fase 1 del Frontend: 100% Completa** 🎉

El sistema está listo para uso. Los usuarios pueden ver su balance, historial de transacciones, recibir alertas de expiración, y depositar semanas por créditos.

**Próximo paso recomendado**: Implementar Fase 2 (Proceso de Reserva) para permitir usar créditos en bookings.

---

*Documentación creada: 26 de Diciembre de 2024*
