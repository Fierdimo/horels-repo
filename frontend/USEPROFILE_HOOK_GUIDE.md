# useProfile Hook - Usage Examples & Documentation

## Quick Start

### Importar el hook
```typescript
import { useProfile } from '@/hooks/useProfile';
```

### Uso básico en componente
```typescript
export default function MyComponent() {
  const { profile, isLoading, error, updateProfile, isUpdating } = useProfile();

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error.message} />;
  if (!profile) return <p>No profile found</p>;

  return (
    <div>
      <h1>{profile.firstName} {profile.lastName}</h1>
      <p>Email: {profile.email}</p>
    </div>
  );
}
```

## API Reference

### Hook Signature
```typescript
function useProfile(): UseProfileReturn
```

### Return Type
```typescript
interface UseProfileReturn {
  profile: User | null;
  isLoading: boolean;
  error: Error | null;
  updateProfile: (data: ProfileData) => Promise<void>;
  isUpdating: boolean;
}
```

### ProfileData Type
```typescript
interface ProfileData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
}
```

## Advanced Usage Examples

### 1. Actualizar perfil con validación
```typescript
async function handleUpdateProfile(formData: ProfileData) {
  try {
    // Validación básica en cliente
    if (formData.firstName?.trim().length === 0) {
      toast.error('First name cannot be empty');
      return;
    }

    // Llamar hook para actualizar
    await updateProfile(formData);
    
    // Success toast es automático desde el hook
  } catch (error) {
    console.error('Update failed:', error);
    // Error toast es automático desde el hook
  }
}
```

### 2. Form con sincronización de datos
```typescript
export function ProfileEditForm() {
  const { profile, isLoading, updateProfile, isUpdating } = useProfile();
  const [formData, setFormData] = useState<ProfileData>({
    firstName: '',
    lastName: '',
    phone: '',
    address: ''
  });

  // Sincronizar cuando profile cargue
  useEffect(() => {
    if (profile) {
      setFormData({
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        phone: profile.phone || '',
        address: profile.address || ''
      });
    }
  }, [profile]);

  const handleSave = async () => {
    await updateProfile(formData);
  };

  if (isLoading) return <Spinner />;

  return (
    <form>
      <input
        value={formData.firstName}
        onChange={(e) => setFormData(prev => ({
          ...prev,
          firstName: e.target.value
        }))}
      />
      <button 
        onClick={handleSave} 
        disabled={isUpdating}
      >
        {isUpdating ? 'Saving...' : 'Save'}
      </button>
    </form>
  );
}
```

### 3. Usar profile en múltiples componentes
```typescript
// Header.tsx
export function Header() {
  const { profile } = useProfile();

  return <div>Welcome, {profile?.firstName}</div>;
}

// Sidebar.tsx
export function Sidebar() {
  const { profile } = useProfile();

  return (
    <div>
      <p>Status: {profile?.status}</p>
      <p>Role: {profile?.role}</p>
    </div>
  );
}

// Main.tsx - Ambos componentes comparten el cache de React Query
export function App() {
  return (
    <div>
      <Header />
      <Sidebar />
    </div>
  );
}
```

### 4. Revalidación manual
```typescript
import { useQueryClient } from '@tanstack/react-query';

export function ManualRefreshProfile() {
  const { profile } = useProfile();
  const queryClient = useQueryClient();

  const handleRefresh = async () => {
    // Revalida el profile query inmediatamente
    await queryClient.invalidateQueries({ 
      queryKey: ['profile'] 
    });
  };

  return (
    <div>
      <p>Last updated: {profile?.updated_at}</p>
      <button onClick={handleRefresh}>
        Refresh Profile
      </button>
    </div>
  );
}
```

### 5. Actualización condicional
```typescript
export function ConditionalUpdate() {
  const { profile, updateProfile } = useProfile();

  const handleUpgradeProfile = async () => {
    if (profile?.status === 'pending') {
      toast.error('Cannot update pending profile');
      return;
    }

    await updateProfile({
      firstName: profile.firstName?.toUpperCase()
    });
  };

  return (
    <button 
      onClick={handleUpgradeProfile}
      disabled={profile?.status === 'pending'}
    >
      Update Profile
    </button>
  );
}
```

### 6. Sincronización con componentes externos
```typescript
export function ProfileDisplay() {
  const { profile, isLoading } = useProfile();
  const [hasChanges, setHasChanges] = useState(false);

  // Detector de cambios externo
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'profile-updated') {
        setHasChanges(true);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  if (isLoading) return <Spinner />;

  return (
    <div>
      {hasChanges && (
        <Alert>Profile was updated in another tab</Alert>
      )}
      <ProfileInfo profile={profile} />
    </div>
  );
}
```

## Common Patterns

### Pattern 1: Loading + Error Boundary
```typescript
export function SafeProfileView() {
  const { profile, isLoading, error } = useProfile();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <ErrorBoundary>
        <p>Failed to load profile: {error.message}</p>
      </ErrorBoundary>
    );
  }

  if (!profile) {
    return <div>Profile not found</div>;
  }

  return <ProfileDetails profile={profile} />;
}
```

### Pattern 2: Optimistic Updates
```typescript
export function OptimisticUpdateForm() {
  const { profile, updateProfile, isUpdating } = useProfile();
  const [optimisticData, setOptimisticData] = useState<ProfileData | null>(null);

  const handleChange = (data: ProfileData) => {
    // Mostrar cambios optimísticamente
    setOptimisticData(data);
  };

  const handleSubmit = async () => {
    try {
      await updateProfile(optimisticData || {});
    } catch (error) {
      // Revertir cambios optimísticos si falla
      setOptimisticData(null);
    }
  };

  const displayData = optimisticData || profile;

  return (
    <div>
      <input 
        value={displayData?.firstName}
        onChange={(e) => handleChange({ 
          firstName: e.target.value 
        })}
        disabled={isUpdating}
      />
      <button onClick={handleSubmit} disabled={isUpdating}>
        Save
      </button>
    </div>
  );
}
```

### Pattern 3: Debounced Auto-save
```typescript
import { useCallback, useRef } from 'react';
import { debounce } from 'lodash';

export function AutoSaveProfile() {
  const { profile, updateProfile } = useProfile();
  const debounceRef = useRef(
    debounce(async (data: ProfileData) => {
      await updateProfile(data);
    }, 1000)
  );

  const handleChange = useCallback((field: string, value: string) => {
    const newData: ProfileData = {
      ...profile,
      [field]: value
    };
    debounceRef.current(newData);
  }, [profile]);

  return (
    <div>
      <input 
        onChange={(e) => handleChange('firstName', e.target.value)}
        placeholder="Auto-saves after 1 second"
      />
    </div>
  );
}
```

## Performance Tips

### 1. Memo para evitar re-renders
```typescript
const ProfileCard = React.memo(function ProfileCard({ 
  profile 
}: { 
  profile: User | null 
}) {
  return (
    <div>
      <h2>{profile?.firstName} {profile?.lastName}</h2>
      <p>{profile?.email}</p>
    </div>
  );
});

export function App() {
  const { profile } = useProfile();
  return <ProfileCard profile={profile} />;
}
```

### 2. useCallback para funciones
```typescript
export function ProfileForm() {
  const { updateProfile } = useProfile();

  const handleSubmit = useCallback(
    async (formData: ProfileData) => {
      await updateProfile(formData);
    },
    [updateProfile]
  );

  return <Form onSubmit={handleSubmit} />;
}
```

### 3. Selectores de Query
```typescript
import { useQuery } from '@tanstack/react-query';

// Solo suscribirse a cambios de firstName
export function FirstNameDisplay() {
  const { data: firstName } = useQuery({
    queryKey: ['profile'],
    select: (profile) => profile?.firstName
  });

  return <div>{firstName}</div>;
}
```

## Error Scenarios

### Scenario 1: Usuario no autenticado
```typescript
export function ProtectedProfile() {
  const { profile, isLoading, error } = useProfile();

  if (!isLoading && !profile) {
    return <Navigate to="/login" />;
  }

  return <ProfileDisplay profile={profile} />;
}
```

### Scenario 2: Actualización fallida
```typescript
export function RobustUpdateForm() {
  const { profile, updateProfile } = useProfile();
  const [localData, setLocalData] = useState<ProfileData | null>(null);

  const handleSave = async () => {
    try {
      await updateProfile(localData || {});
      // Success - form se resetea automáticamente
      setLocalData(null);
    } catch (error) {
      // Error - mantener datos locales para que usuario reintente
      toast.error('Failed to update. Please try again.');
    }
  };

  return (
    <Form 
      initialData={profile}
      onSubmit={handleSave}
    />
  );
}
```

## Testing

### Unit Test Example
```typescript
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useProfile } from '@/hooks/useProfile';

describe('useProfile', () => {
  it('should fetch profile data', async () => {
    const queryClient = new QueryClient();
    const wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useProfile(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    // Wait for query to complete
    await act(async () => {
      // Esperar a que isLoading sea false
    });

    expect(result.current.profile).toBeDefined();
  });
});
```

## Migration Guide

Si estás migrando desde versión anterior sin API:

```typescript
// ANTES (sin API)
const { user } = useAuth();
const [firstName, setFirstName] = useState(user?.firstName);

// DESPUÉS (con API)
const { profile } = useProfile();
const [firstName, setFirstName] = useState(profile?.firstName);

// Para actualizar (ANTES)
setFirstName('New Name');

// Para actualizar (DESPUÉS)
await updateProfile({ firstName: 'New Name' });
```

## Troubleshooting

### Problema: Profile no actualiza después de cambios
**Solución**: Asegurate de que QueryClient está configurado en el App
```typescript
const queryClient = new QueryClient();

<QueryClientProvider client={queryClient}>
  <App />
</QueryClientProvider>
```

### Problema: Toast notifications no aparecen
**Solución**: Asegurate de tener Toaster en el layout global
```typescript
import { Toaster } from 'react-hot-toast';

export function App() {
  return (
    <>
      <Toaster />
      <Routes />
    </>
  );
}
```

### Problema: Múltiples requests al API
**Solución**: React Query cachea automáticamente. Si necesitas revalidar:
```typescript
const queryClient = useQueryClient();
await queryClient.invalidateQueries({ queryKey: ['profile'] });
```

## Related Hooks

- `useAuth()` - Autenticación y login/logout
- `useSwaps()` - Gestión de intercambios
- `useWeeks()` - Gestión de semanas
- `useNightCredits()` - Gestión de créditos nocturnos

