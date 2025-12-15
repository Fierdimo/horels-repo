# SW2 Frontend - Timeshare & Hotel Marketplace Platform

Frontend web application for the SW2 Timesharing & Hotel platform. Built with React, TypeScript, Vite, and Tailwind CSS.

---

## 📋 Table of Contents

1. [Project Overview](#-project-overview)
2. [Business Idea](#-business-idea)
3. [Latest Features](#-latest-features-december-2025)
4. [Quick Start](#-quick-start)
5. [Tech Stack](#️-tech-stack)
6. [Architecture](#️-architecture)
7. [Development Plan](#-development-plan)
8. [Project Progress](#-project-progress)
9. [Implemented Features](#-implemented-features)
10. [Backend Integration](#-backend-integration)
11. [Internationalization](#-internationalization-i18n)
12. [Testing](#-testing)
13. [Deployment](#-deployment)

---

## 🎯 Project Overview

SW2 is a timeshare and hotel management platform that connects hotel week owners with guests, enabling exchanges, conversion to night credits, and lightweight guest access. Additionally, it features a **public marketplace** for room bookings with integrated Stripe payments.

### User Contexts
- **Mobile WebView**: Integrated in the Secret World mobile app (SSO via bridge)
- **Desktop Web**: Direct browser access for staff and administration
- **Public Marketplace**: Open access for browsing and booking hotel rooms

### User Roles
- **Owners**: Week management, P2P exchanges, credit conversion
- **Guests**: Token-based access to bookings and service requests
- **Hotel Staff**: Service and hotel request management
- **Administrators**: Complete platform management including:
  - User management (view, edit, suspend, delete)
  - Staff approval workflow
  - Activity logs and system monitoring
  - Platform settings configuration
  - Marketplace room management

---

## 🆕 Latest Features (December 2025)

### Marketplace & Stripe Integration

#### 1. Public Hotel Marketplace
- **Room Browsing**: Browse available properties and rooms without authentication
- **Real-time Availability**: Check room status and pricing
- **Search & Filters**: Find properties by location, price, capacity, amenities
- **Responsive Design**: Full mobile and desktop experience
- **Multi-language**: English, Spanish (German, French ready)

#### 2. Complete Stripe Payment Flow
- **Payment Intents API**: Secure payment processing with SCA compliance
- **Multiple Payment Options**:
  - New credit/debit cards (one-time or save for future)
  - Saved payment methods (authenticated users)
  - 3D Secure authentication support
- **Webhook Integration**: Real-time payment status updates
- **Test Mode Support**: Automatic €10/night pricing for development when room prices are zero

#### 3. User Profile Management
- **Profile CRUD**: Create, read, update user profiles
- **Auto-fill Forms**: Pre-populate booking forms with saved profile data
- **Save Preferences**: Option to save info for future bookings
- **Payment Methods**: View and manage saved credit/debit cards
- **Profile Fields**: firstName, lastName, phone, address, email

#### 4. Enhanced Booking Experience
**Guest Flow (Unauthenticated):**
1. Browse marketplace → Select property → Choose room
2. Select dates → Fill guest info → Enter payment details
3. Complete payment → Receive confirmation

**Authenticated User Flow:**
1. Browse marketplace → Select property → Choose room
2. Select dates → Auto-filled guest info from profile
3. Option to use saved card or new card
4. Complete payment (instant with saved card) → Confirmation

#### 5. Saved Payment Methods
- **Stripe Customer Integration**: Users linked to Stripe customers
- **Card Storage**: Securely store payment methods in Stripe
- **Quick Checkout**: One-click payment with saved cards
- **Card Management**: View card details (brand, last 4, expiry)
- **Auto-save Option**: Checkbox to save new cards during checkout

---

## 💼 Business Idea

### Revenue Model

#### 1. Exchange Fee (€10)
- Charged only when a swap between owners is successfully completed
- Stripe processing with automatic backend registration
- No charges for attempts or pending requests
- **Example**: Owner A wants to exchange their red week in Cancún for Owner B's red week in Madrid. When both accept, €10 is charged once.

#### 2. Extra Night Commissions
- When owners confirm their week with additional nights
- B2B2C model: hotel rate + platform commission (10-15%)
- Payment processed by Stripe transparently
- **Example**: Owner confirms their week and adds 3 extra nights at €100/night. Hotel receives €300, platform receives €30-45 commission.

#### 3. Service Fees
- Guest service requests (late checkout, baby cot, room service, etc.)
- Optional charge depending on service type with 10-20% markup
- Payment processing in the same request
- **Example**: Guest requests late checkout (€25 to hotel, €5 service fee = €30 total to guest)

### Value Proposition

**For Owners:**
- ✅ Flexibility to exchange weeks with other owners (same color)
- ✅ Conversion of fixed weeks to flexible night credits (Red=6, Blue=5, White=4 nights)
- ✅ Secure payment system with Stripe and transparent fees
- ✅ Integration with Secret World for contextual tourist content
- ✅ Intuitive dashboard with complete asset management

**For Guests:**
- ✅ Quick access to booking information without complex registrations (token-based)
- ✅ Easy hotel service requests with real-time tracking
- ✅ Secret World tourist content based on hotel location
- ✅ Secure temporary access (during stay + 30 days post-checkout)

**For Hotels:**
- ✅ Real-time service and request management panel
- ✅ Integration with existing PMS (Mews, Cloudbeds, ResNexus) - no changes needed
- ✅ Detailed statistics dashboard and activity logs
- ✅ Low implementation overhead (initial configuration only)
- ✅ Additional revenue generation from extra nights and services

### Competitive Differentiators

1. **Secret World Integration**: Tourist content and existing push notifications
2. **Freemium Model for Owners**: No subscriptions, pay-per-use only (swaps)
3. **Frictionless Guest Access**: Token-based, no apps or registrations
4. **Multi-PMS**: Works with any PMS (no lock-in)
5. **Responsive Dual-Context**: Same app for mobile webview and desktop browser

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** installed
- **npm** or **yarn**
- **SW2 Backend** running at `http://localhost:3000` (see backend README)

### Environment Variables

Create a `.env` file in the root directory:

```env
# API Configuration
VITE_API_URL=http://localhost:3000/api

# Stripe Configuration (Test Mode)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
```

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:5173`

### Available Commands

```bash
# Development
npm run dev              # Start dev server (http://localhost:5173)

# Build
npm run build            # Production build
npm run preview          # Preview local build

# Testing
npm run test             # Run unit tests (pending implementation)
npm run test:ui          # Tests in UI mode (pending)

# Linting
npm run lint             # ESLint check
```

### Environment Variables

Create a `.env` file with the following configuration:

```env
# Backend API
VITE_API_URL=http://localhost:3000/api

# Stripe (publishable key - Test Mode for development)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key

# Environment
VITE_ENV=development

# Feature flags (optional)
VITE_ENABLE_WEBVIEW_BRIDGE=true
VITE_ENABLE_EXPO_NOTIFICATIONS=true
```

**Important**: 
- Use `pk_test_` keys for development
- Never commit real Stripe secret keys
- Backend handles secret keys separately

---

## 🛠️ Tech Stack

### Core Framework
- **Vite 5.0+**: Ultra-fast build tool with HMR, optimized for React and code splitting
- **React 18.2+**: UI framework with Suspense for lazy loading and concurrent features
- **TypeScript 5.2+**: Complete type safety across the project, strict mode enabled
- **Tailwind CSS 3.4+**: Utility-first CSS framework with custom configuration

### State Management
- **Zustand 4.4+**: Lightweight and performant state management for auth and user preferences
- **React Query 5.17+** (TanStack Query): Server state with intelligent caching, optimistic updates, and automatic background refetching

### Routing & Code Splitting
- **React Router 6.21+**: Client-side routing with data loaders
- **React.lazy()**: Mandatory lazy loading for all routes (reduces initial bundle by ~70%)

### Internationalization (i18n)
- **react-i18next 14.0+**: i18n framework with support for 4 languages
- **i18next 23.7+**: Core i18n engine with namespace splitting per feature
- **i18next-browser-languagedetector 7.2+**: Automatic browser language detection
- **Languages**: Spanish (ES), English (EN), German (DE - ready), French (FR - ready)

### Payment Processing
- **@stripe/react-stripe-js 2.4+**: React components for Stripe Elements
- **@stripe/stripe-js 2.4+**: Stripe.js library for secure payment collection
- **PCI Compliance**: All card data handled by Stripe (never touches our servers)
- **3D Secure (SCA)**: Full support for Strong Customer Authentication

### UI Components & Styling
- **Lucide React**: Modern and lightweight icon library (tree-shakeable)
- **Tailwind Merge**: Merge Tailwind classes without conflicts
- **clsx**: Utility for conditional className
- **date-fns 3.0+**: Date formatting and manipulation
- **react-hot-toast 2.4+**: Elegant toast notifications

### HTTP & API Integration
- **Axios 1.6+**: HTTP client with interceptors for automatic JWT and error handling
- **API Client**: Centralized client with token management and retry logic

### WebView Bridge
- **postMessage API**: Bidirectional communication with Secret World mobile app
- **Custom bridge utilities**: SSO, locale detection, Expo push notifications

---

## 🏗️ Architecture

### Directory Structure

```
frontend/
├── src/
│   ├── pages/                 # Lazy-loaded pages by route
│   │   ├── auth/             # Authentication
│   │   │   └── Login.tsx     # Login page (SSO ready)
│   │   ├── owner/            # Owner dashboard
│   │   │   ├── Dashboard.tsx # Overview with stats
│   │   │   ├── Weeks.tsx     # Week management
│   │   │   ├── Swaps.tsx     # Exchange system
│   │   │   └── Credits.tsx   # Night credits
│   │   ├── guest/            # Guest access
│   │   │   ├── BookingAccess.tsx  # Booking view (token)
│   │   │   ├── Services.tsx       # Service requests
│   │   │   └── Nearby.tsx         # Secret World content
│   │   ├── staff/            # Staff panel
│   │   │   └── Dashboard.tsx      # Service management
│   │   └── admin/            # Admin panel
│   │       ├── Dashboard.tsx      # Admin overview
│   │       ├── Users.tsx          # User management
│   │       ├── Logs.tsx           # System logs
│   │       └── Statistics.tsx     # Statistics
│   ├── components/
│   │   ├── ui/               # UI components (Shadcn-style)
│   │   ├── common/           # Reusable components
│   │   │   ├── LoadingSpinner.tsx
│   │   │   ├── ErrorMessage.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   └── layout/           # Layout components (Header, Sidebar, etc)
│   ├── api/                  # Axios client and endpoints
│   │   ├── client.ts         # Axios instance with interceptors
│   │   ├── auth.ts           # Auth API (login, register, me)
│   │   ├── timeshare.ts      # Timeshare API (weeks, swaps, credits)
│   │   ├── hotel.ts          # Hotel Guest API (booking, services, nearby)
│   │   └── payments.ts       # Stripe API (payment intents)
│   ├── hooks/                # Custom hooks
│   │   ├── useAuth.ts        # Auth hook with mutations
│   │   ├── useWeeks.ts       # Weeks hook with queries
│   │   ├── useSwaps.ts       # Swaps hook with queries
│   │   └── useBridge.ts      # WebView bridge hook
│   ├── stores/               # Zustand stores
│   │   ├── authStore.ts      # Auth state (token, user, isAuthenticated)
│   │   └── userStore.ts      # User preferences (theme, language, notifications)
│   ├── locales/              # i18n translations
│   │   ├── es/translation.json  # Spanish
│   │   ├── en/translation.json  # English
│   │   ├── de/translation.json  # German
│   │   └── fr/translation.json  # French
│   ├── utils/                # Utilities
│   │   ├── bridge.ts         # WebView bridge utilities
│   │   ├── cn.ts             # Tailwind class merger
│   │   └── constants.ts      # Constants (API_URL, colors, fees, etc)
│   ├── types/                # TypeScript types
│   │   ├── api.ts            # API request/response types
│   │   ├── bridge.ts         # Bridge message types
│   │   └── models.ts         # Data models (User, Week, Swap, etc)
│   ├── App.tsx               # Main app with lazy routes
│   ├── main.tsx              # Entry point
│   ├── i18n.ts               # i18n configuration
│   └── index.css             # Global styles + Tailwind
├── public/                   # Static assets
├── index.html                # HTML template
├── vite.config.ts            # Vite configuration
├── tailwind.config.js        # Tailwind configuration
├── tsconfig.json             # TypeScript configuration
├── package.json              # Dependencies
└── README.md                 # This documentation
```

### Lazy Loading Strategy

**Mandatory**: All routes use `React.lazy()` + `Suspense` to reduce initial bundle.

```typescript
// Example in App.tsx
const OwnerDashboard = lazy(() => import('./pages/owner/Dashboard'));
const Swaps = lazy(() => import('./pages/owner/Swaps'));

// In the router
<Suspense fallback={<LoadingSpinner />}>
  <Routes>
    <Route path="/owner/dashboard" element={<OwnerDashboard />} />
    <Route path="/owner/swaps" element={<Swaps />} />
  </Routes>
</Suspense>
```

**Generated chunks**:
- `react-vendor.js` (~45KB): React core
- `ui-vendor.js` (~15KB): Lucide icons
- `i18n-vendor.js` (~25KB): i18next libraries
- `data-vendor.js` (~30KB): Axios, React Query, Zustand
- `stripe-vendor.js` (~40KB): Stripe libraries
- Route chunks (~10-20KB each): One per page

**Bundle size target**: <200KB initial, <500KB total

### Responsive Design

- **Mobile First** (<768px): Optimized for webview in Secret World app
  - Navigation bottom sheet
  - Touch-optimized buttons (min 44x44px)
  - Simplified layouts, full-width cards
  
- **Desktop** (≥768px): Optimized for staff and admin in browser
  - Sidebar navigation
  - Multi-column layouts
  - Data tables with pagination
  
- **Tailwind Breakpoints**: `sm:640px`, `md:768px`, `lg:1024px`, `xl:1280px`, `2xl:1536px`

---

## 📅 Development Plan



### Phase 1: Setup & Infrastructure (Week 1) - ✅ 100% COMPLETE

#### Completed ✅
- [x] Initialize Vite + React + TypeScript project
- [x] Install all core dependencies
- [x] Configure Tailwind CSS with custom theme
- [x] Setup i18n with 4 languages (ES, EN, DE, FR)
- [x] Implement WebView bridge utilities (postMessage)
- [x] Create route structure with lazy loading
- [x] Configure Axios client with JWT interceptors
- [x] Setup Zustand stores (auth, user preferences)
- [x] Create complete TypeScript types
- [x] Implement base components (Loading, Error, ProtectedRoute)

#### Files Created (60+ files)
- `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`
- 4 translation files (ES, EN, DE, FR) - Updated with auth & guest translations
- API clients: `auth.ts`, `timeshare.ts`, `hotel.ts`, `payments.ts`
- Hooks: `useAuth.ts`, `useWeeks.ts`, `useSwaps.ts`, `useBridge.ts`
- Stores: `authStore.ts`, `userStore.ts` with persistence
- Pages: `Login.tsx`, `Register.tsx`, `GuestDashboard.tsx`, `GuestInfo.tsx`, and more
- Validations: `validations.ts` (zod schemas)
- Components: `LoadingSpinner`, `ErrorMessage`, `ProtectedRoute`, `RootRedirect`
- Utilities: `bridge.ts`, `constants.ts`, `cn.ts`

### Phase 2: Authentication & Layout (Week 2) - ✅ 100% COMPLETE

#### Completed ✅
- [x] Complete Login page with validation (react-hook-form + zod)
- [x] Register page with validation and password confirmation
- [x] Implement SSO via WebView bridge (receive token from mobile)
- [x] Form validation with error messages
- [x] Toast notifications for success/error feedback
- [x] Remember me functionality
- [x] Password visibility toggle
- [x] Role-based redirection (owner, staff, admin, guest)
- [x] Guest dashboard for WebView access
- [x] Complete auth flow testing
- [x] CORS configuration for development
- [x] Create responsive Header component
- [x] Create Sidebar component (desktop) and BottomNav (mobile)
- [x] Implement light/dark theme with ThemeProvider
- [x] MainLayout wrapper with responsive navigation
- [x] Add navigation, theme, and role translations (4 languages)

### Phase 3: Owner Dashboard (Weeks 2-3) - 🟡 10% COMPLETE

#### Progress
- [x] "My Weeks" view with filters and search
- [x] Stats bar (total, available, confirmed, converted)
- [x] Table of weeks with actions
- [x] API integration (real data)
- [x] Confirmation modal (basic, with extra nights selector)
- [ ] Stripe integration for extra nights payment
- [ ] Activity feed (recent actions)
- [ ] Usage chart (per month)
- [ ] Exchanges view: create swap request
- [ ] Exchanges view: accept swap with payment (€10)
- [ ] Conversion to night credits (confirmation modal)
- [ ] Credit management: view, filter by expiration
- [ ] Use credits: property selector, dates, availability validation

> ⚠️ Pendiente: No se puede avanzar/pruebas en esta fase hasta poblar la base de datos con semanas asignadas a owners.

### Phase 4: Stripe Payments (Weeks 3-4) - ⚪ 0% PENDING

#### To Implement
- [ ] Setup Stripe Elements with i18n locale
- [ ] Lazy-loaded payment modal (reduce bundle)
- [ ] Payment flow for swaps (€10 fee)
- [ ] Payment flow for extra nights (variable)
- [ ] Payment flow for guest services
- [ ] Confirmation webhooks (backend already implemented)
- [ ] Payment states: pending, succeeded, failed
- [ ] Testing with Stripe test cards

### Phase 5: Guests & Secret World (Weeks 4-5) - ⚪ 0% PENDING

#### To Implement
- [ ] Token-based access: validate token, show booking
- [ ] Access window validation (30 days post-checkout)
- [ ] Service request: form with predefined types
- [ ] Payment modal for services with price
- [ ] Requested services view with status tracking
- [ ] Secret World integration: fetch nearby content
- [ ] Display cards and itineraries by proximity
- [ ] Filters by content type (attractions, restaurants, activities)

### Phase 6: Staff & Admin (Weeks 5-6) - 🟡 EN PROGRESO

#### Estado Actual: Admin Panel Implementado (80%)

##### ✅ Admin Panel - Completado
- ✅ **Navegación reorganizada**: Eliminación de tabs anidados, navegación de un solo nivel
- ✅ **Dashboard Overview**: Estadísticas generales y accesos rápidos
- ✅ **User Management**: Sistema completo de gestión de usuarios
  - ✅ Tabla con paginación (20 usuarios por página)
  - ✅ Filtros: búsqueda por email/nombre, rol, estado
  - ✅ Campos mostrados: Avatar, Email, Nombre completo, Rol, Estado, Propiedad, Fecha de registro
  - ✅ Acciones por usuario: Editar, Suspender/Activar, Eliminar
  - ✅ Modal de edición con todos los campos: email, firstName, lastName, phone, address, role, status
  - ✅ Creación de nuevos administradores
  - ✅ Badges visuales para roles y estados
  - ✅ Protección: No se puede editar/eliminar cuenta propia
  - ✅ Validaciones y mensajes de error/éxito
  - ✅ Actualización automática de datos después de cambios
- ✅ **Pending Approvals**: Gestión de solicitudes de staff
  - ✅ Lista de usuarios pendientes de aprobación
  - ✅ Badge con contador en tiempo real (30 segundos)
  - ✅ Acciones: Aprobar/Rechazar
  - ✅ Corrección de bug: búsqueda por rol 'staff' en lugar de 'guest'
- ✅ **Activity Logs**: Página placeholder lista para implementación
- ✅ **Platform Settings**: Página placeholder lista para implementación
- ✅ **CORS Configuration**: Método PATCH habilitado para operaciones de actualización
- ✅ **Type Safety**: Uso consistente de camelCase (firstName, lastName) entre frontend y backend
- ✅ **Token Persistence**: Solución para mantener sesión después de reload

##### 🔧 Backend - APIs Implementadas
- ✅ `GET /admin/users` - Lista usuarios con filtros (role, status, search) y paginación
- ✅ `PATCH /admin/users/:userId` - Actualiza usuario completo
- ✅ `DELETE /admin/users/:userId` - Elimina usuario (con protección auto-eliminación)
- ✅ `POST /admin/create-admin` - Crea nuevos administradores
- ✅ `GET /admin/staff-requests` - Lista usuarios staff pendientes
- ✅ `POST /admin/staff-requests/:userId` - Aprobar/rechazar staff
- ✅ Middleware de autorización y logging funcionando
- ✅ Validación de permisos por endpoint

##### 🎨 UX/UI Mejoradas
- ✅ Sidebar con 6 navegaciones principales
- ✅ Badge dinámico en "Pending Approvals" con contador
- ✅ Diseño consistente con Tailwind CSS
- ✅ Estados de loading y empty states
- ✅ Toast notifications para feedback inmediato
- ✅ Modales responsive para crear/editar
- ✅ Confirmaciones para acciones destructivas

##### ⚪ Pendiente en Admin Panel (20%)
- [ ] **Activity Logs**: Implementar visualización de logs
  - Backend ready: `GET /admin/logs`, `GET /admin/logs/stats`
  - Filtros: fecha, usuario, tipo de acción
  - Tabla paginada con detalles
  - Gráficas de actividad
- [ ] **Platform Settings**: Implementar configuración
  - Backend ready: `GET/PATCH /admin/settings/commission`, `GET/PUT /admin/settings/staff-auto-approval`
  - Editor de tasa de comisión
  - Configuración de auto-aprobación de staff
  - Ejemplos de cálculos

##### Staff Panel (Siguiente prioridad)
- [ ] Listado de servicios pendientes (limpieza, mantenimiento, solicitudes especiales, etc.)
- [ ] Filtros por tipo de servicio, estado, propiedad y fechas
- [ ] Detalle de cada servicio: usuario solicitante, propiedad, fechas, notas
- [ ] Actualización de estado del servicio (solicitado → confirmado → completado)
- [ ] Notificaciones push al staff cuando un huésped solicita un servicio
- [ ] Historial de servicios atendidos por staff

### Phase 7: Testing & Optimization (Weeks 7-8) - ⚪ 0% PENDING

#### To Implement
- [ ] E2E tests with Playwright (critical flows)
- [ ] Component tests with Vitest + React Testing Library
- [ ] Custom hook tests
- [ ] Bundle size analysis and optimization
- [ ] Lighthouse audit (Performance, Accessibility, SEO)
- [ ] Additional code splitting if needed
- [ ] CI/CD setup (GitHub Actions)
- [ ] Deployment to Vercel/Netlify

### Phase 8: Timeshare Purchase Flow (To Be Implemented)

Permitir que el usuario adquiera semanas de tiempo compartido directamente desde la app, con pago integrado y asignación automática.

#### To Implement
- [ ] Catálogo de semanas disponibles para compra (por hotel, fecha, color, precio)
- [ ] Selección y compra de semana (flujo UI)
- [ ] Integración Stripe para pago de adquisición
- [ ] Endpoint backend para procesar compra y asignar semana
- [ ] Confirmación y visualización en dashboard del owner

Esta fase permitirá monetizar la plataforma directamente y automatizar la adquisición de productos timeshare por parte del usuario final.

---

## 📊 Project Progress

### General Summary

| Module | Status | Progress | Last Update |
|--------|--------|----------|-------------|
| **Setup & Config** | 🟢 Complete | 100% | Dec 5, 2025 |
| **i18n (4 languages)** | 🟢 Complete | 100% | Dec 5, 2025 |
| **WebView Bridge** | 🟢 Complete | 100% | Dec 5, 2025 |
| **Auth & SSO** | 🟢 Complete | 100% | Dec 5, 2025 |
| **Layout Components** | 🟢 Complete | 100% | Dec 5, 2025 |
| **Guest Dashboard** | 🟢 Complete | 100% | Dec 5, 2025 |
| **Owner Dashboard** | 🟡 Started | 10% | Dec 5, 2025 |
| **Admin Panel** | 🟡 In Progress | 80% | Dec 14, 2025 |
| **Staff Panel** | ⚪ Pending | 0% | - |
| **Swaps & Credits** | ⚪ Pending | 0% | - |
| **Payments (Stripe)** | ⚪ Pending | 0% | - |
| **Testing** | ⚪ Pending | 0% | - |
| **Deployment** | ⚪ Pending | 0% | - |

### Legend
- 🟢 Complete (100%)
- 🟡 In progress (1-99%)
- ⚪ Pending (0%)
- 🔴 Blocked

### Total Progress: **60%**

**Calculation**: (Setup 100% + i18n 100% + Bridge 100% + Auth 100% + Layout 100% + Guest 100% + Owner 10% + Admin 80%) / 13 modules = 790/13 ≈ 60%

---

## ✅ Implemented Features

### ✅ Completed (Phase 1)

#### Project Configuration
- [x] Vite 5.0 with React 18 and TypeScript 5
- [x] Tailwind CSS 3.4 with custom theme (colors, radius, etc.)
- [x] PostCSS with autoprefixer
- [x] Path aliases (`@/*`) configured
- [x] `.gitignore` and `.env.example` created

#### Internationalization (i18n)
- [x] react-i18next configured
- [x] 4 languages: Spanish, English, German, French
- [x] Automatic browser language detection
- [x] Fallback to Spanish if language not supported
- [x] Complete namespace per module (common, auth, owner, guest, staff, admin, payment, navigation)

#### WebView Bridge
- [x] Utilities for bidirectional postMessage
- [x] Webview context detection (`isWebView()`)
- [x] Message listener from mobile app
- [x] Message sending to mobile app
- [x] Notification permission request (Expo)
- [x] TypeScript types for all messages

#### State Management
- [x] Zustand `authStore`: token, user, isAuthenticated, setAuth, clearAuth
- [x] Zustand `userStore`: preferences (theme, language, notifications), expoToken
- [x] Automatic localStorage persistence

#### API Integration
- [x] Axios client with configurable baseURL
- [x] Request interceptors: automatic JWT injection
- [x] Response interceptors: 401 error handling (redirect to login)
- [x] Modular API clients: `auth.ts`, `timeshare.ts`, `hotel.ts`, `payments.ts`
- [x] Complete types for requests and responses

#### Custom Hooks
- [x] `useAuth`: login, register, logout, getCurrentUser with mutations
- [x] `useWeeks`: getWeeks, confirmWeek, convertWeek with queries
- [x] `useSwaps`: getSwaps, createSwap, acceptSwap with queries
- [x] `useBridge`: SSO, locale detection, notification permissions

#### UI Components
- [x] `LoadingSpinner`: Spinner with 3 sizes (sm, md, lg)
- [x] `ErrorMessage`: Error display with icon
- [x] `ProtectedRoute`: Route wrapper with role-based access control

#### Routing
- [x] React Router 6 configured
- [x] Lazy loading for all pages
- [x] Suspense with LoadingSpinner as fallback
- [x] Protected routes with redirect to login
- [x] Role-based routing (owner, staff, admin)

#### Pages Created (Placeholder)
- [x] Login page with basic form
- [x] Owner Dashboard with navigation cards
- [x] Owner Weeks with weeks table
- [x] Owner Swaps (placeholder)
- [x] Owner Credits (placeholder)
- [x] Guest BookingAccess with token param
- [x] Guest Services (placeholder)
- [x] Staff Dashboard (placeholder)
- [x] Admin Dashboard (placeholder)

### 🟢 Phase 2 Completed

#### Authentication (100%)
- [x] Login form with react-hook-form + zod validation
- [x] Register form with password confirmation
- [x] useAuth hook with mutations and callbacks
- [x] SSO: receive token from mobile app via bridge
- [x] Toast notifications (react-hot-toast)
- [x] Remember me / session persistence
- [x] Password visibility toggle
- [x] Role-based redirection after login
- [x] Protected routes with role checking
- [x] Comprehensive error handling
- [x] Form validation with real-time feedback
- [x] WebView detection and SSO integration

#### Guest Dashboard (100%)
- [x] Complete dashboard layout
- [x] WebView detection and messaging
- [x] Quick access cards (Bookings, Services, Nearby)
- [x] Stats display section
- [x] Logout functionality
- [x] Responsive design
- [x] Multi-language support

#### Admin Panel (80%)
- [x] **Navigation Architecture**
  - [x] Single-level navigation (removed nested tabs)
  - [x] Sidebar with 6 main sections
  - [x] Dashboard as overview page
- [x] **User Management** (100%)
  - [x] User list with pagination (20 per page)
  - [x] Search by email/name
  - [x] Filter by role (owner, guest, staff, admin)
  - [x] Filter by status (pending, approved, suspended, rejected)
  - [x] User table columns: Avatar, Email, Name, Role, Status, Property, Registration Date
  - [x] Edit modal with all fields: email, firstName, lastName, phone, address, role, status
  - [x] Create admin functionality
  - [x] Suspend/Activate users
  - [x] Delete users (with self-protection)
  - [x] Real-time data updates after changes
  - [x] Visual badges for roles and statuses
  - [x] Toast notifications for feedback
  - [x] Backend integration: GET, PATCH, DELETE endpoints
  - [x] Type safety: camelCase consistency (firstName, lastName)
- [x] **Pending Approvals** (100%)
  - [x] List of pending staff users
  - [x] Real-time badge with count (30s refresh)
  - [x] Approve/Reject actions
  - [x] Bug fix: search by 'staff' role instead of 'guest'
  - [x] Backend integration working
- [x] **Session Persistence** (100%)
  - [x] Token persistence after page reload
  - [x] Zustand store integration
  - [x] Multiple storage location support
- [x] **CORS Configuration** (100%)
  - [x] PATCH method enabled
  - [x] All HTTP methods supported
- [ ] **Activity Logs** (0%)
  - [ ] Log table with pagination
  - [ ] Filters by date, user, action type
  - [ ] Activity statistics and charts
  - Backend ready: GET /admin/logs, GET /admin/logs/stats
- [ ] **Platform Settings** (0%)
  - [ ] Commission rate editor
  - [ ] Staff auto-approval configuration
  - [ ] Calculation examples
  - Backend ready: GET/PATCH /admin/settings/*

### 🟡 In Progress

#### Owner Dashboard (10%)
- [x] Basic layout with cards
- [ ] Real stats from API (total weeks, available, swaps, credits)
- [ ] Recent activity feed
- [ ] Week usage chart (per month)

### ⚪ Pending (40% of Project)

See previous sections for complete detail of Phases 2-7.

---

## 🔌 Backend Integration

### Backend Status

The SW2 backend is **100% implemented and tested**:
- ✅ Complete REST API in Express + TypeScript
- ✅ MariaDB database with Sequelize ORM
- ✅ JWT authentication (24hr expiry)
- ✅ Stripe integration (PaymentIntents, webhooks, refunds)
- ✅ PMS integration (Mews, Cloudbeds, ResNexus)
- ✅ **110 automated tests passing**

### API Base URL

```typescript
// Development
const API_URL = 'http://localhost:3000';

// Production (ejemplo)
const API_URL = 'https://api.sw2platform.com';
```

### Main Endpoints

#### Authentication (`/auth/*`)
```typescript
POST /auth/register
Body: { email, password, roleName: 'owner' | 'guest' | 'staff' | 'admin' }
Response: { message, userId }

POST /auth/login
Body: { email, password }
Response: { token, user: { id, email, role, created_at } }

GET /auth/me
Headers: { Authorization: 'Bearer <token>' }
Response: { user }
```

#### Timeshare (`/timeshare/*`)
```typescript
GET /timeshare/weeks
Response: { success: true, data: Week[] }

POST /timeshare/weeks/:id/confirm
Body: { extraNights?: number, paymentIntentId?: string }
Response: { success: true, booking }

POST /timeshare/swaps
Body: { requester_week_id, desired_start_date, desired_property_id }
Response: { success: true, swapRequest }

POST /timeshare/swaps/:id/authorize
Body: { responderWeekId }
Response: { success: true, message }

POST /timeshare/weeks/:id/convert
Response: { message, nightCredits }

GET /timeshare/night-credits
Response: { success: true, data: NightCredit[] }

POST /timeshare/night-credits/:id/use
Body: { propertyId, checkIn, checkOut, roomType }
Response: { success: true, nightsUsed, remainingNights, booking }
```

#### Hotel Guest (`/hotel/*`)
```typescript
GET /hotel/booking/:token
Response: { booking, hotel, services }

POST /hotel/services
Body: { bookingToken, serviceType, description, urgency, amount?, currency? }
Response: { message, serviceRequest, payment? }

GET /hotel/services/:token
Response: { services, count }

GET /hotel/nearby/:token?radius=5
Response: { content: Card[], location }
```

#### Payments (`/payments/*`)
```typescript
POST /payments/intent
Body: { amount, currency, type, metadata }
Response: { success: true, data: { paymentIntentId, clientSecret, amount, currency } }

GET /payments/:id/confirm
Response: { success: true, data: { paymentIntentId, status, amount, currency } }

POST /payments/webhook
Headers: { stripe-signature }
Body: <Stripe webhook payload>
Response: { received: true }
```

### Axios Configuration

```typescript
// src/api/client.ts
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' }
});

// Request interceptor: automatic JWT
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('sw2_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: 401 handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('sw2_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### React Query Configuration

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000 // 5 minutes
    }
  }
});
```

---

## 🌐 Internationalization (i18n)

### Supported Languages

- 🇪🇸 **Spanish (ES)** - Default language
- 🇬🇧 **English (EN)**
- 🇩🇪 **German (DE)**
- 🇫🇷 **French (FR)**

### Language Detection

1. **WebView (Mobile)**: Receives language via postMessage from Secret World app
   ```typescript
   // Mobile app sends
   window.postMessage({ type: 'LOCALE', payload: { locale: 'es' } });
   
   // Frontend receives in useBridge hook
   case 'LOCALE':
     i18n.changeLanguage(payload.locale);
     updatePreferences({ language: payload.locale });
   ```

2. **Desktop**: Automatic browser detection with fallback
   ```typescript
   // Detection order
   1. localStorage ('sw2-user' store)
   2. navigator.language / navigator.languages
   3. Fallback: 'es'
   ```

### Usage in Components

```typescript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t, i18n } = useTranslation();
  
  return (
    <div>
      <h1>{t('owner.dashboard.title')}</h1>
      <p>{t('owner.weeks.description')}</p>
      <button>{t('common.save')}</button>
      
      {/* With interpolation */}
      <p>{t('owner.dashboard.welcome', { name: user.name })}</p>
      
      {/* Change language manually */}
      <button onClick={() => i18n.changeLanguage('en')}>English</button>
    </div>
  );
}
```

### Translation Structure

```json
// locales/es/translation.json
{
  "common": {
    "loading": "Cargando...",
    "error": "Error",
    "save": "Guardar",
    "cancel": "Cancelar"
  },
  "auth": {
    "login": "Iniciar Sesión",
    "logout": "Cerrar Sesión",
    "email": "Correo Electrónico",
    "password": "Contraseña"
  },
  "owner": {
    "dashboard": {
      "title": "Mi Dashboard",
      "welcome": "Bienvenido, {{name}}"
    },
    "weeks": {
      "title": "Mis Semanas",
      "available": "Disponible",
      "confirmed": "Confirmada"
    }
  }
}
```

### Add New Language

1. Create file `src/locales/[code]/translation.json`
2. Copy structure from `es/translation.json`
3. Translate all strings
4. Register in `src/i18n.ts`:
   ```typescript
   import translationIT from './locales/it/translation.json';
   
   const resources = {
     es: { translation: translationES },
     en: { translation: translationEN },
     it: { translation: translationIT } // New
   };
   ```

---

## 🧪 Testing

### Testing Framework (To Implement)

- **Vitest**: Unit tests for functions and hooks
- **Playwright**: E2E tests for complete flows
- **React Testing Library**: Component tests

### Testing Commands

```bash
# Unit tests
npm run test

# E2E tests (to implement)
npm run test:e2e

# Test with UI
npm run test:ui

# Coverage
npm run test:coverage
```

### Testing Strategy (Planned)

1. **Unit Tests**: Utilities, hooks, stores (Phase 7)
2. **Component Tests**: UI components in isolation (Phase 7)
3. **Integration Tests**: API flows with mocks (Phase 7)
4. **E2E Tests**: Complete user flows (Phase 7)

#### Critical E2E Flows
- [ ] Login → Dashboard → Weeks → Confirm week with payment
- [ ] Login → Swaps → Create swap → Accept swap with €10 payment
- [ ] Login → Weeks → Convert to credits → Use credits
- [ ] Guest: Access with token → Request service → Payment
- [ ] Staff: Login → View services → Update status
- [ ] Admin: Login → View users → View logs

---

## 🚀 Deployment

### Recommended Platforms

#### **Vercel** (Recommended #1)
- ✅ Zero-config for Vite + React
- ✅ Automatic deploy from Git (main branch)
- ✅ Automatic PR previews
- ✅ Edge functions available
- ✅ Integrated analytics
- ✅ Free tier: 100GB bandwidth/month
- 🔗 [vercel.com](https://vercel.com)

**Vercel Setup**:
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd frontend
vercel

# Production
vercel --prod
```

#### **Netlify** (Alternative)
- ✅ Similar to Vercel
- ✅ Integrated forms
- ✅ Serverless functions
- ✅ Continuous deploy from Git
- ✅ Free tier: 100GB bandwidth/month
- 🔗 [netlify.com](https://netlify.com)

### Production Build

```bash
# Optimized build
npm run build

# Output in /dist
# - index.html
# - assets/
#   - index-[hash].js
#   - index-[hash].css
#   - vendor chunks

# Local build preview
npm run preview
```

### Production Environment Variables

```env
# Vercel/Netlify Environment Variables
VITE_API_URL=https://api.sw2platform.com
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
VITE_ENV=production
VITE_ENABLE_WEBVIEW_BRIDGE=true
VITE_ENABLE_EXPO_NOTIFICATIONS=true
```

### Build Optimizations

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['lucide-react'],
          'i18n-vendor': ['react-i18next', 'i18next'],
          'data-vendor': ['axios', '@tanstack/react-query', 'zustand'],
          'stripe-vendor': ['@stripe/react-stripe-js', '@stripe/stripe-js']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
});
```

### CI/CD (GitHub Actions - To Implement)

```yaml
# .github/workflows/deploy.yml
name: Deploy Frontend
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run build
      - run: npm run test
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
```

---

## 🤝 Contributing

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/owner-swaps-page

# Semantic commits
git commit -m "feat: add swaps page with filters"
git commit -m "fix: correct swap payment flow"
git commit -m "docs: update README with swaps section"

# Push and create PR
git push origin feature/owner-swaps-page
```

### Code Conventions

#### TypeScript
- ✅ **Strict mode**: Don't use `any` (use `unknown` if necessary)
- ✅ **Interfaces vs Types**: Prefer `interface` for objects, `type` for unions
- ✅ **Naming**: PascalCase for components/interfaces, camelCase for functions/variables

#### React
- ✅ **Functional components**: Always functional components with hooks
- ✅ **Props**: Destructure props in parameters
- ✅ **Custom hooks**: `use` prefix mandatory
- ✅ **Memo**: Use `React.memo()` only when necessary (avoid premature optimization)

#### Files
- ✅ **Components**: PascalCase (`OwnerDashboard.tsx`)
- ✅ **Utilities**: camelCase (`bridge.ts`, `constants.ts`)
- ✅ **Hooks**: camelCase with `use` prefix (`useAuth.ts`)

#### CSS/Tailwind
- ✅ **Tailwind classes only**: Avoid custom CSS when possible
- ✅ **Responsive**: Mobile-first (`md:`, `lg:` for desktop)
- ✅ **Spacing**: Use Tailwind scale (4, 8, 12, 16, 24, 32, etc.)
- ✅ **Colors**: Use palette defined in `tailwind.config.js`

---

## 📞 Support & Resources

### Related Documentation
- **Backend**: `/backend/README.md` - Setup, API, testing
- **API Reference**: `/backend/API_DOCUMENTATION.md` - Complete endpoints
- **Testing Guide**: `/backend/README_TESTS.md` - Backend testing strategy

### Stack Documentation
- [React 18 Docs](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Guide](https://vitejs.dev/guide/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [React Query](https://tanstack.com/query/latest)
- [Zustand](https://github.com/pmndrs/zustand)
- [react-i18next](https://react.i18next.com/)
- [Stripe React](https://stripe.com/docs/stripe-js/react)

### Troubleshooting

#### Error: "Cannot find module '@/...' "
**Cause**: Path aliases not configured correctly
**Solution**: Verify `vite.config.ts` and `tsconfig.json` have alias `@/*`

#### Error: "i18next not initialized"
**Cause**: i18n not imported in `main.tsx`
**Solution**: Verify that `import './i18n'` exists in `main.tsx`

#### Error: 401 on all API calls
**Cause**: JWT token expired or invalid
**Solution**: Logout and login again. Verify backend is running.

#### WebView bridge not working
**Cause**: Not in webview context
**Solution**: Use `useBridge().isWebView` to detect context and fallback to desktop

---

## 📄 License

Private - SW2 Platform © 2025

---

## 📝 Changelog

### [0.2.0] - 2025-12-05

#### Added (Phase 2 - Authentication System)
- ✅ Complete authentication system with form validation
- ✅ Login page with react-hook-form + zod validation
- ✅ Register page with password confirmation
- ✅ Toast notifications with react-hot-toast
- ✅ Password visibility toggle
- ✅ Remember me functionality
- ✅ Role-based authentication and redirection
- ✅ Guest dashboard with WebView support
- ✅ Guest info page for token-based access
- ✅ SSO integration via WebView bridge
- ✅ CORS configuration with Vite proxy
- ✅ Protected routes with role checking
- ✅ Auth state persistence with Zustand
- ✅ Comprehensive error handling
- ✅ Multi-language support for all auth flows

### [0.1.0] - 2025-12-05

#### Added (Phase 1 - Setup & Infrastructure)
- ✅ Vite + React + TypeScript project initialization
- ✅ Tailwind CSS + PostCSS configuration
- ✅ Complete i18n setup with 4 languages (ES, EN, DE, FR)
- ✅ WebView bridge utilities for Secret World integration
- ✅ Zustand stores for auth and user preferences
- ✅ API clients with Axios (auth, timeshare, hotel, payments)
- ✅ Custom hooks (useAuth, useWeeks, useSwaps, useBridge)
- ✅ Routing with lazy loading for all pages
- ✅ Base UI components (LoadingSpinner, ErrorMessage, ProtectedRoute)
- ✅ 9 placeholder pages (Login, Owner Dashboard/Weeks/Swaps/Credits, Guest Booking/Services, Staff Dashboard, Admin Dashboard)
- ✅ Complete TypeScript types for API, models, bridge
- ✅ Complete README with comprehensive documentation

---

**Last update**: December 5, 2025  
**Version**: 0.2.0 (Alpha)  
**Total Progress**: 43%  
**Next Milestone**: Phase 3 - Owner Dashboard & Week Management
