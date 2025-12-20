# Developer Quick Start Guide - Owner Features

## 🚀 Quick Start para Desarrolladores

### 1. Entender la Arquitectura

#### Estructura de Archivos
```
frontend/
├── src/
│   ├── hooks/
│   │   ├── useAuth.ts (Autenticación)
│   │   ├── useProfile.ts (Perfil - NUEVO)
│   │   ├── useSwaps.ts (Intercambios)
│   │   ├── useWeeks.ts (Semanas)
│   │   └── useNightCredits.ts (Créditos)
│   │
│   ├── pages/owner/
│   │   ├── Dashboard.tsx (Principal)
│   │   ├── Swaps.tsx (Intercambios)
│   │   ├── Credits.tsx (Créditos)
│   │   └── Profile.tsx (Perfil)
│   │
│   ├── api/
│   │   ├── auth.ts (Autenticación)
│   │   ├── timeshare.ts (Timeshare)
│   │   └── client.ts (HTTP Client)
│   │
│   └── types/
│       ├── models.ts (Tipos de datos)
│       └── api.ts (Tipos de API)
```

#### Flujo de Datos
```
React Component
    ↓
Hook (useProfile, useSwaps, etc.)
    ↓
API Layer (auth.ts, timeshare.ts)
    ↓
HTTP Client (apiClient)
    ↓
Backend API (/api/...)
    ↓
Database
```

---

### 2. Trabajar con useProfile Hook

#### Importar el Hook
```typescript
import { useProfile } from '@/hooks/useProfile';
```

#### Uso Básico
```typescript
export default function MyComponent() {
  const { profile, isLoading, error, updateProfile, isUpdating } = useProfile();

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage />;
  if (!profile) return <div>No profile</div>;

  return (
    <div>
      <h1>{profile.firstName}</h1>
      <button onClick={() => updateProfile({ firstName: 'New Name' })}>
        Update
      </button>
    </div>
  );
}
```

#### Actualizar Datos
```typescript
const handleSave = async () => {
  try {
    await updateProfile({
      firstName: 'Juan',
      lastName: 'García',
      phone: '555-1234',
      address: 'Calle Principal 123'
    });
    // Toast success es automático
  } catch (error) {
    // Toast error es automático
    console.error(error);
  }
};
```

---

### 3. Trabajar con Otras Páginas

#### Swaps.tsx
```typescript
import { useSwaps } from '@/hooks/useSwaps';
import { useWeeks } from '@/hooks/useWeeks';

export default function Swaps() {
  const { swaps, createSwap, acceptSwap, isCreating, isAccepting } = useSwaps();
  const { weeks } = useWeeks();

  // Crear nuevo swap
  const handleCreateSwap = async (formData) => {
    await createSwap(formData);
  };

  // Aceptar swap
  const handleAcceptSwap = async (swapId, weekId) => {
    await acceptSwap({
      swapId,
      data: { responder_week_id: weekId }
    });
  };
}
```

#### Credits.tsx
```typescript
import { useQuery } from '@tanstack/react-query';
import { timeshareApi } from '@/api/timeshare';

export default function Credits() {
  const { data: credits } = useQuery({
    queryKey: ['credits'],
    queryFn: timeshareApi.getCredits
  });

  const { data: weeks } = useQuery({
    queryKey: ['weeks'],
    queryFn: timeshareApi.getWeeks
  });
}
```

---

### 4. Agregar Nuevas Funcionalidades

#### Ejemplo: Agregar campo nuevo a Profile

**Paso 1: Actualizar Backend**
```typescript
// authRoutes.ts
router.put('/profile', authenticateToken, async (req, res) => {
  const { firstName, lastName, phone, address, newField } = req.body;
  
  await User.update(
    { firstName, lastName, phone, address, newField },
    { where: { id: req.user.id } }
  );
});
```

**Paso 2: Actualizar API Client**
```typescript
// api/auth.ts
updateProfile: async (profileData: {
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  newField?: string; // NUEVO
}): Promise<{ success: boolean; user: User }> => {
  const { data } = await apiClient.put('/auth/profile', profileData);
  return data;
}
```

**Paso 3: Actualizar Hook**
```typescript
// hooks/useProfile.ts
const updateProfileMutation = useMutation({
  mutationFn: async (data: ProfileData & { newField?: string }) => {
    return await authApi.updateProfile(data);
  }
});
```

**Paso 4: Actualizar Componente**
```typescript
// pages/owner/Profile.tsx
const [formData, setFormData] = useState({
  firstName: '',
  lastName: '',
  phone: '',
  address: '',
  newField: '' // NUEVO
});

// En el formulario
<input
  name="newField"
  value={formData.newField}
  onChange={handleInputChange}
/>

// Al guardar
await updateProfile({
  firstName: formData.firstName,
  lastName: formData.lastName,
  phone: formData.phone,
  address: formData.address,
  newField: formData.newField // NUEVO
});
```

**Paso 5: Agregar Traducción**
```json
// locales/en/translation.json
"owner": {
  "profile": {
    "newField": "New Field"
  }
}

// locales/es/translation.json
"owner": {
  "profile": {
    "newField": "Nuevo Campo"
  }
}
```

---

### 5. Debugging & Troubleshooting

#### Ver qué está pasando en React Query
```typescript
import { useQueryClient } from '@tanstack/react-query';

export function DebugComponent() {
  const queryClient = useQueryClient();
  
  return (
    <button onClick={() => {
      const cache = queryClient.getQueryData(['profile']);
      console.log('Profile cache:', cache);
    }}>
      Debug Profile Cache
    </button>
  );
}
```

#### Ver errores de API
```typescript
export function ErrorDebug() {
  const { profile, isLoading, error } = useProfile();

  if (error) {
    console.error('Profile error:', error);
    console.error('Error message:', error.message);
    return <div>Error: {error.message}</div>;
  }

  return null;
}
```

#### Ver estado de actualización
```typescript
export function UpdateDebug() {
  const { isUpdating, updateProfile } = useProfile();

  const handleUpdate = async () => {
    console.log('Update started...');
    try {
      await updateProfile({ firstName: 'Test' });
      console.log('Update success!');
    } catch (error) {
      console.log('Update failed:', error);
    }
  };

  return <button onClick={handleUpdate}>Update {isUpdating && 'ing...'}</button>;
}
```

---

### 6. Testing

#### Test Básico del Hook
```typescript
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useProfile } from '@/hooks/useProfile';

describe('useProfile Hook', () => {
  it('should fetch profile', async () => {
    const queryClient = new QueryClient();
    const wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useProfile(), { wrapper });

    // Esperar a que cargue
    await act(async () => {
      await new Promise(r => setTimeout(r, 100));
    });

    expect(result.current.profile).toBeDefined();
  });
});
```

#### Test del Componente
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Profile from '@/pages/owner/Profile';

describe('Profile Component', () => {
  it('should display profile data', async () => {
    const queryClient = new QueryClient();
    
    render(
      <QueryClientProvider client={queryClient}>
        <Profile />
      </QueryClientProvider>
    );

    // Esperar a que cargue
    await screen.findByText(/profile/i);
  });

  it('should update profile', async () => {
    // Test de actualización de perfil
  });
});
```

---

### 7. Mejores Prácticas

#### DO ✅
```typescript
// DO: Usar el hook correctamente
const { profile, updateProfile } = useProfile();

// DO: Manejar loading y error states
if (isLoading) return <Spinner />;
if (error) return <Error />;

// DO: Validar datos antes de enviar
if (!formData.firstName) {
  toast.error('Name is required');
  return;
}

// DO: Usar types TypeScript
interface ProfileData {
  firstName?: string;
  lastName?: string;
}
```

#### DON'T ❌
```typescript
// DON'T: Llamar updateProfile sin manejo de error
updateProfile(data); // Sin await/catch

// DON'T: Ignorar loading states
{showData && <Data />}

// DON'T: Usar any types
const [data, setData] = useState<any>(null);

// DON'T: Duplicar lógica de API
const [profile, setProfile] = useState(null);
useEffect(() => {
  authApi.getCurrentUser().then(setProfile);
}, []);
```

---

### 8. Recursos & Referencias

#### Documentación Incluida
1. **PROFILE_API_INTEGRATION.md** - Arquitectura técnica
2. **USEPROFILE_HOOK_GUIDE.md** - Guía completa del hook
3. **PROFILE_ROADMAP.md** - Plan futuro
4. **COMPLETION_SUMMARY.md** - Resumen del proyecto

#### Librerías Usadas
- [React Query Docs](https://tanstack.com/query/latest)
- [React i18next](https://react.i18next.com/)
- [Lucide Icons](https://lucide.dev/)
- [TailwindCSS](https://tailwindcss.com/)

#### Comandos Útiles
```bash
# Desarrollo
npm run dev

# Build
npm run build

# Preview
npm run preview

# Type check
npm run type-check

# Lint
npm run lint

# Format
npm run format
```

---

### 9. Common Issues & Solutions

#### Problema: "Cannot find module 'useProfile'"
```
Solución: Asegurar que el path es correcto
import { useProfile } from '@/hooks/useProfile';
NO:
import { useProfile } from '@/hooks';
```

#### Problema: Profile no actualiza después de cambios
```
Solución: Asegurar que QueryClient está en el app
<QueryClientProvider client={queryClient}>
  <App />
</QueryClientProvider>
```

#### Problema: Toast no aparece
```
Solución: Asegurar que Toaster está en layout global
<Toaster position="top-right" />
```

#### Problema: "Type 'User | null' has no property 'firstName'"
```
Solución: Hacer type guard
if (!profile) return <div>Loading</div>;
profile.firstName // Ahora safe
```

---

### 10. Checklist para Agregar Nueva Feature

- [ ] Crear endpoint en backend (si es necesario)
- [ ] Actualizar API client (`api/auth.ts` o `api/timeshare.ts`)
- [ ] Actualizar tipos en `types/api.ts`
- [ ] Actualizar tipos en `types/models.ts`
- [ ] Crear/actualizar hook si es necesario
- [ ] Actualizar componente
- [ ] Agregar traducciones (5 idiomas)
- [ ] Probar en desarrollo local
- [ ] Escribir tests
- [ ] Actualizar documentación
- [ ] Hacer commit y push

---

## 📞 Support

### Documentación
Consulta los archivos incluidos:
- `PROFILE_API_INTEGRATION.md` - Detalles técnicos
- `USEPROFILE_HOOK_GUIDE.md` - Ejemplos de uso
- `PROFILE_ROADMAP.md` - Futuras features

### Debugging
1. Revisar console del navegador
2. Usar React DevTools
3. Usar Redux DevTools (para React Query)
4. Revisar logs del backend

### Contacto
Para preguntas, revisar la documentación primero y consultar con el equipo.

---

**¡Happy Coding!** 🚀
