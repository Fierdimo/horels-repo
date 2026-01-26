# Paywall Suave en Home - Análisis y Propuesta

**Fecha:** 25 de Enero, 2026  
**Request de:** Gregorio (mencionado por Antonio)  
**Asunto:** Implementar trigger suave de paywall en pantalla Home

---

## 📋 Request Original

### Lo que Gregorio Propone

```
Trigger de Paywall (mínimo + no invasivo):

1. Usuario llega a Home
2. Esperar 8-12 segundos
3. Si usuario SIGUE en Home (no navegó / app activa)
4. Mostrar paywall existente
5. Máximo 1 vez por día por device
```

### Por Qué

> "Muchos usuarios abren el app y se van en pocos segundos, nunca llegan al gate de 10-click o alerts. Esto aumenta exposición sin ser agresivo."

### Reglas y Constraints

✅ **No inmediato** - Delay de 8-12s  
✅ **Solo si muestra interés** - Usuario aún en Home  
✅ **Cooldown** - 1 paywall/día/device (timestamp local)  
✅ **Skip** - Si tiene suscripción activa o promo activa  

---

## ❓ Aclaración Necesaria

### ⚠️ Pregunta Crítica

**Este request parece ser para una aplicación móvil diferente (Secret World travel/content app), NO para el sistema de timeshare/hotel management.**

Evidencia:
- Menciona "app" (mobile app)
- Menciona "suscripción/promo" (típico de apps de contenido)
- Menciona "10-click gate" (paywall freemium típico)
- Menciona "background" del app

**Nuestro sistema actual:**
- Es una aplicación web (no mobile app native)
- No tiene sistema de suscripciones freemium
- No tiene paywall existente
- Enfocado en timeshare management

### Posibles Escenarios

**Escenario 1:** Request para app móvil de Secret World (contenido de viajes)  
- Esta es la interpretación más probable
- Requeriría implementar en app mobile separada
- No afecta nuestro sistema de timeshare

**Escenario 2:** Request para agregar paywall a nuestro sistema web  
- Tendríamos que crear sistema de suscripciones
- Definir qué features son premium
- Implementar paywall desde cero

---

## 🤔 Si Es Para App Móvil de Secret World

### Arquitectura Propuesta

```typescript
// Mobile App (React Native / Flutter)
// HomeScreen.tsx

import { useState, useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

export function HomeScreen() {
  const [showPaywall, setShowPaywall] = useState(false);
  const navigation = useNavigation();
  const timerRef = useRef(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // Check if paywall was shown today
    const checkPaywallCooldown = async () => {
      const lastShown = await AsyncStorage.getItem('paywall_last_shown');
      if (lastShown) {
        const lastShownDate = new Date(lastShown);
        const now = new Date();
        const hoursSinceLastShown = (now - lastShownDate) / (1000 * 60 * 60);
        
        // If shown less than 24 hours ago, skip
        if (hoursSinceLastShown < 24) {
          return false;
        }
      }
      return true;
    };

    // Check if user has active subscription/promo
    const hasActiveSubscription = async () => {
      // Check subscription status
      const user = await getCurrentUser();
      return user.hasActiveSubscription || user.hasActivePromo;
    };

    // Setup paywall trigger
    const setupPaywallTrigger = async () => {
      const canShow = await checkPaywallCooldown();
      const hasSubscription = await hasActiveSubscription();
      
      if (!canShow || hasSubscription) {
        return;
      }

      // Random delay between 8-12 seconds
      const delay = 8000 + Math.random() * 4000;
      
      timerRef.current = setTimeout(() => {
        // Only show if user is still on Home screen and app is active
        if (navigation.isFocused() && appState.current === 'active') {
          setShowPaywall(true);
          // Save timestamp
          AsyncStorage.setItem('paywall_last_shown', new Date().toISOString());
        }
      }, delay);
    };

    setupPaywallTrigger();

    // Listen to app state changes
    const subscription = AppState.addEventListener('change', nextAppState => {
      appState.current = nextAppState;
      
      // If app goes to background, cancel timer
      if (nextAppState === 'background' && timerRef.current) {
        clearTimeout(timerRef.current);
      }
    });

    // Cleanup
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      subscription.remove();
    };
  }, [navigation]);

  return (
    <View style={styles.container}>
      {/* Home Screen Content */}
      <HomeContent />

      {/* Paywall Modal */}
      {showPaywall && (
        <PaywallModal
          visible={showPaywall}
          onClose={() => setShowPaywall(false)}
          onSubscribe={() => {
            // Handle subscription
          }}
        />
      )}
    </View>
  );
}
```

### Componente de Paywall

```typescript
// PaywallModal.tsx

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  onSubscribe: () => void;
}

export function PaywallModal({ visible, onClose, onSubscribe }: PaywallModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
    >
      <View style={styles.overlay}>
        <View style={styles.paywallContainer}>
          {/* Close button (small, not prominent) */}
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={onClose}
          >
            <Icon name="close" size={20} color="#999" />
          </TouchableOpacity>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.title}>
              Unlock Premium Features
            </Text>
            
            <View style={styles.features}>
              <FeatureItem text="Ad-free experience" />
              <FeatureItem text="Offline access" />
              <FeatureItem text="Exclusive content" />
              <FeatureItem text="Priority support" />
            </View>

            <Text style={styles.price}>
              Only $9.99/month
            </Text>

            <TouchableOpacity 
              style={styles.subscribeButton}
              onPress={onSubscribe}
            >
              <Text style={styles.subscribeText}>
                Start Free Trial
              </Text>
            </TouchableOpacity>

            <Text style={styles.terms}>
              7 days free, then $9.99/month. Cancel anytime.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}
```

### Testing

```typescript
// HomeScreen.test.tsx

describe('Paywall Trigger', () => {
  it('should show paywall after 8-12 seconds if user stays on Home', async () => {
    // Mock AsyncStorage (no cooldown)
    AsyncStorage.getItem.mockResolvedValue(null);
    
    // Mock user without subscription
    mockGetCurrentUser.mockResolvedValue({
      hasActiveSubscription: false,
      hasActivePromo: false
    });

    render(<HomeScreen />);

    // Wait minimum delay
    await waitFor(() => {
      expect(screen.queryByText('Unlock Premium Features')).toBeNull();
    }, { timeout: 7000 });

    // Wait maximum delay
    await waitFor(() => {
      expect(screen.getByText('Unlock Premium Features')).toBeOnTheScreen();
    }, { timeout: 13000 });
  });

  it('should NOT show paywall if shown in last 24 hours', async () => {
    // Mock shown 1 hour ago
    const oneHourAgo = new Date(Date.now() - 3600 * 1000);
    AsyncStorage.getItem.mockResolvedValue(oneHourAgo.toISOString());

    render(<HomeScreen />);

    await waitFor(() => {
      expect(screen.queryByText('Unlock Premium Features')).toBeNull();
    }, { timeout: 15000 });
  });

  it('should NOT show paywall if user has subscription', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);
    mockGetCurrentUser.mockResolvedValue({
      hasActiveSubscription: true
    });

    render(<HomeScreen />);

    await waitFor(() => {
      expect(screen.queryByText('Unlock Premium Features')).toBeNull();
    }, { timeout: 15000 });
  });

  it('should cancel timer if user navigates away', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);
    
    const { rerender } = render(<HomeScreen />);

    // Navigate away after 5 seconds
    await waitFor(() => {}, { timeout: 5000 });
    
    // Simulate navigation to another screen
    mockNavigation.isFocused.mockReturnValue(false);
    rerender(<HomeScreen />);

    // Wait full delay
    await waitFor(() => {
      expect(screen.queryByText('Unlock Premium Features')).toBeNull();
    }, { timeout: 10000 });
  });
});
```

---

## 🌐 Si Es Para Sistema Web (Nuestro Sistema)

### Implementación en React Web

```typescript
// frontend/src/pages/owner/Dashboard.tsx

import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import PaywallModal from '@/components/PaywallModal';

export default function Dashboard() {
  const [showPaywall, setShowPaywall] = useState(false);
  const location = useLocation();
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    // Check if paywall was shown today
    const checkPaywallCooldown = () => {
      const lastShown = localStorage.getItem('paywall_last_shown');
      if (lastShown) {
        const lastShownDate = new Date(lastShown);
        const now = new Date();
        const hoursSinceLastShown = (now.getTime() - lastShownDate.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceLastShown < 24) {
          return false;
        }
      }
      return true;
    };

    // Check if user has active subscription
    const hasActiveSubscription = () => {
      // Check user subscription status from context/API
      const user = getCurrentUser();
      return user?.hasActiveSubscription || user?.hasActivePromo;
    };

    // Setup paywall trigger
    const setupPaywallTrigger = () => {
      const canShow = checkPaywallCooldown();
      const hasSubscription = hasActiveSubscription();
      
      if (!canShow || hasSubscription) {
        return;
      }

      // Random delay between 8-12 seconds
      const delay = 8000 + Math.random() * 4000;
      
      timerRef.current = window.setTimeout(() => {
        // Only show if user is still on dashboard (location hasn't changed)
        if (location.pathname === '/owner/dashboard') {
          setShowPaywall(true);
          localStorage.setItem('paywall_last_shown', new Date().toISOString());
        }
      }, delay);
    };

    setupPaywallTrigger();

    // Cleanup
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [location]);

  // Also clear timer if user navigates away
  useEffect(() => {
    // When location changes, clear timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [location.pathname]);

  return (
    <div className="dashboard">
      {/* Dashboard Content */}
      <DashboardContent />

      {/* Paywall Modal */}
      {showPaywall && (
        <PaywallModal
          isOpen={showPaywall}
          onClose={() => setShowPaywall(false)}
        />
      )}
    </div>
  );
}
```

### Hook Reutilizable

```typescript
// frontend/src/hooks/usePaywallTrigger.ts

import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface UsePaywallTriggerOptions {
  delayMin?: number; // milliseconds
  delayMax?: number; // milliseconds
  cooldownHours?: number;
  enabledPaths?: string[]; // Only trigger on these paths
}

export function usePaywallTrigger(options: UsePaywallTriggerOptions = {}) {
  const {
    delayMin = 8000,
    delayMax = 12000,
    cooldownHours = 24,
    enabledPaths = ['/']
  } = options;

  const [showPaywall, setShowPaywall] = useState(false);
  const location = useLocation();
  const { user } = useAuth();
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    // Only trigger on enabled paths
    if (!enabledPaths.includes(location.pathname)) {
      return;
    }

    // Check cooldown
    const lastShown = localStorage.getItem('paywall_last_shown');
    if (lastShown) {
      const hoursSince = (Date.now() - new Date(lastShown).getTime()) / (1000 * 60 * 60);
      if (hoursSince < cooldownHours) {
        return;
      }
    }

    // Check if user has active subscription
    if (user?.hasActiveSubscription || user?.hasActivePromo) {
      return;
    }

    // Random delay
    const delay = delayMin + Math.random() * (delayMax - delayMin);

    // Set timer
    timerRef.current = window.setTimeout(() => {
      // Double-check user is still on same path
      if (location.pathname === enabledPaths[0]) {
        setShowPaywall(true);
        localStorage.setItem('paywall_last_shown', new Date().toISOString());
      }
    }, delay);

    // Cleanup
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [location.pathname, user, delayMin, delayMax, cooldownHours, enabledPaths]);

  const dismissPaywall = () => {
    setShowPaywall(false);
  };

  return { showPaywall, dismissPaywall };
}
```

### Uso del Hook

```typescript
// En cualquier página

import { usePaywallTrigger } from '@/hooks/usePaywallTrigger';

export default function HomePage() {
  const { showPaywall, dismissPaywall } = usePaywallTrigger({
    delayMin: 8000,
    delayMax: 12000,
    cooldownHours: 24,
    enabledPaths: ['/']
  });

  return (
    <div>
      <HomeContent />
      
      {showPaywall && (
        <PaywallModal onClose={dismissPaywall} />
      )}
    </div>
  );
}
```

---

## 📊 Analytics y Tracking

### Eventos a Trackear

```typescript
// analytics.ts

export const trackPaywallEvents = {
  // Cuando el paywall se muestra
  shown: (metadata: {
    screenName: string;
    delaySeconds: number;
    userType: string;
  }) => {
    analytics.track('Paywall Shown', metadata);
  },

  // Cuando usuario cierra el paywall
  dismissed: (metadata: {
    screenName: string;
    timeOnScreen: number;
    dismissMethod: 'close_button' | 'backdrop' | 'escape';
  }) => {
    analytics.track('Paywall Dismissed', metadata);
  },

  // Cuando usuario hace click en subscribe
  subscribeClicked: (metadata: {
    screenName: string;
    planType: string;
  }) => {
    analytics.track('Paywall Subscribe Clicked', metadata);
  },

  // Conversión exitosa
  converted: (metadata: {
    planType: string;
    price: number;
    currency: string;
  }) => {
    analytics.track('Paywall Converted', metadata);
  }
};
```

### Dashboard de Métricas

```
Métricas Clave a Monitorear:

1. Exposure Rate
   - % de usuarios que ven el paywall
   - Target: 15-25% de daily active users

2. Conversion Rate
   - % de usuarios que subscriben después de ver paywall
   - Target: 2-5% (típico para soft paywalls)

3. Dismissal Rate
   - % de usuarios que cierran el paywall
   - Análisis: ¿Por qué lo cierran? ¿Timing? ¿Contenido?

4. Time to Conversion
   - Tiempo entre ver paywall y subscribir
   - Insight: ¿Cuántos ven paywall múltiples veces antes de convertir?

5. Retention After Paywall
   - ¿Usuarios que vieron paywall siguen usando app?
   - Asegurar que no sea demasiado invasivo
```

---

## ⚠️ Consideraciones UX

### Buenas Prácticas

✅ **DO:**
- Hacer el botón de cerrar visible pero no prominente
- Usar animación suave al mostrar
- Permitir cerrar con Escape key
- Recordar preferencia si usuario ya rechazó
- Ofrecer "Don't show again for a week" option

❌ **DON'T:**
- Hacer difícil cerrar el paywall
- Mostrarlo en momentos críticos (durante checkout, etc)
- Usar lenguaje agresivo o presionante
- Interrumpir acciones importantes
- Ignorar cooldown (spam)

### A/B Testing Ideas

```
Variantes a Testear:

1. Timing
   - A: 8s delay
   - B: 12s delay
   - Metric: Conversion rate

2. Mensaje
   - A: "Unlock premium"
   - B: "Support our work"
   - Metric: Conversion rate + retention

3. Incentivo
   - A: "Start free trial"
   - B: "Get 20% off"
   - Metric: Conversion rate

4. Frecuencia
   - A: 1x per day
   - B: 1x per week
   - Metric: Conversion vs annoyance (retention)
```

---

## 🎯 Recomendación Final

### Si Es Para App Móvil de Secret World

✅ **Implementar según especificado**

Pasos:
1. Confirmar que es para app móvil separada
2. Implementar hook/componente según código arriba
3. Setup analytics para tracking
4. A/B test para optimizar timing y mensaje
5. Monitorear métricas de conversión y retention

### Si Es Para Nuestro Sistema Web

⚠️ **Primero necesitamos definir:**

1. **Sistema de Suscripciones**
   - ¿Qué features son premium?
   - ¿Pricing tiers?
   - ¿Integración de pagos?

2. **Paywall Existente**
   - ¿Diseño?
   - ¿Contenido?
   - ¿Flows de suscripción?

3. **Estrategia de Monetización**
   - ¿Target users?
   - ¿Modelo freemium o trial?
   - ¿Métricas de éxito?

---

## 📝 Próximos Pasos

### Para Avanzar Necesitamos:

1. **Aclarar contexto** ⚠️
   - ¿App móvil de Secret World o sistema web de timeshare?
   
2. **Si es app móvil:**
   - Confirmar stack técnico (React Native/Flutter)
   - Confirmar paywall existente
   - Acceso al código de la app
   
3. **Si es sistema web:**
   - Definir estrategia de suscripciones
   - Diseñar paywall
   - Plan de implementación completo

---

**Esperando aclaración del contexto para proceder.** 🤔

---

_Documento preparado por el equipo de desarrollo_  
_25 de Enero, 2026_
