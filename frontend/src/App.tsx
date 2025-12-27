import { Suspense, lazy } from 'react';
import StaffLayout from '@/components/staff/StaffLayout';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useBridge } from '@/hooks/useBridge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';
import { MainLayout } from '@/components/layout/MainLayout';

// Lazy load pages
const Welcome = lazy(() => import('@/pages/auth/Welcome'));
const Login = lazy(() => import('@/pages/auth/LoginNew'));
const Register = lazy(() => import('@/pages/auth/RegisterWizard'));
const PendingApproval = lazy(() => import('@/pages/auth/PendingApproval'));
const AccountSuspended = lazy(() => import('@/pages/auth/AccountSuspended'));
const OwnerDashboard = lazy(() => import('@/pages/owner/Dashboard'));
const Weeks = lazy(() => import('@/pages/owner/Weeks'));
const ConvertWeek = lazy(() => import('@/pages/owner/ConvertWeek'));
const BookingDetails = lazy(() => import('@/pages/owner/BookingDetails'));
const Swaps = lazy(() => import('@/pages/owner/Swaps'));
const Credits = lazy(() => import('@/pages/owner/Credits'));
const OwnerProfile = lazy(() => import('@/pages/owner/Profile'));
const CreateNightCreditRequest = lazy(() => import('@/pages/owner/NightCreditRequests'));
const MyNightCreditRequests = lazy(() => import('@/pages/owner/MyNightCreditRequests'));
const GuestBooking = lazy(() => import('@/pages/guest/BookingAccess'));
const GuestDetails = lazy(() => import('@/pages/guest/BookingDetails'));
const GuestServices = lazy(() => import('@/pages/guest/Services'));
const GuestDashboard = lazy(() => import('@/pages/guest/GuestDashboard'));
const GuestBookings = lazy(() => import('@/pages/guest/GuestBookings'));
const GuestServiceRequest = lazy(() => import('@/pages/guest/GuestServiceRequest'));
const GuestPayments = lazy(() => import('@/pages/guest/GuestPayments'));
const GuestProfile = lazy(() => import('@/pages/guest/GuestProfile'));
const GuestDestinations = lazy(() => import('@/pages/guest/GuestDestinations'));
const GuestInfo = lazy(() => import('@/pages/guest/GuestInfo'));
const StaffDashboard = lazy(() => import('@/pages/staff/Dashboard'));
const StaffServices = lazy(() => import('@/pages/staff/Services'));
const StaffRooms = lazy(() => import('@/pages/staff/Rooms'));
const StaffProducts = lazy(() => import('@/pages/staff/Products'));
const StaffNightCreditRequests = lazy(() => import('@/pages/staff/NightCreditRequests'));
const StaffPendingBookings = lazy(() => import('@/pages/staff/PendingBookings'));
const StaffHistory = lazy(() => import('@/pages/staff/History'));
const StaffAvailability = lazy(() => import('@/pages/staff/Availability'));
const StaffProfile = lazy(() => import('@/pages/staff/Profile'));
const StaffMarketplaceSettings = lazy(() => import('@/pages/staff/MarketplaceSettings'));
const StaffSwapApprovals = lazy(() => import('@/pages/staff/SwapApprovals'));
const StaffAssignPeriod = lazy(() => import('@/pages/staff/AssignPeriod'));
const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'));
const AdminPendingApprovals = lazy(() => import('@/pages/admin/PendingApprovals'));
const AdminUsers = lazy(() => import('@/pages/admin/Users'));
const AdminLogs = lazy(() => import('@/pages/admin/ActivityLogs'));
const AdminSettings = lazy(() => import('@/pages/admin/Settings'));
const AdminRooms = lazy(() => import('@/pages/admin/Rooms'));
// Marketplace pages
const MarketplaceHome = lazy(() => import('@/pages/marketplace/MarketplaceHome'));
const PropertyDetails = lazy(() => import('@/pages/marketplace/PropertyDetails'));
const BookingForm = lazy(() => import('@/pages/marketplace/BookingForm'));
const MarketplaceCheckout = lazy(() => import('@/pages/marketplace/MarketplaceCheckout'));
const BookingSuccess = lazy(() => import('@/pages/marketplace/BookingSuccess'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000 // 5 minutes
    }
  }
});

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingSpinner size="lg" />}>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Welcome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/pending-approval" element={<PendingApproval />} />
        <Route path="/account-suspended" element={<AccountSuspended />} />
        <Route path="/guest/:token" element={<GuestBooking />} />
        <Route path="/guest-info" element={<GuestInfo />} />
        <Route path="/guest/booking-details" element={<GuestDetails />} />
        <Route path="/guest/services" element={<GuestServices />} />
        
        {/* Guest routes */}
        <Route
          path="/guest/dashboard"
          element={
            <ProtectedRoute allowedRoles={['guest']}>
              <MainLayout>
                <GuestDashboard />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/guest/bookings"
          element={
            <ProtectedRoute allowedRoles={['guest']}>
              <MainLayout>
                <GuestBookings />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/guest/bookings/:bookingId/services"
          element={
            <ProtectedRoute allowedRoles={['guest']}>
              <MainLayout>
                <GuestServiceRequest />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/guest/payments"
          element={
            <ProtectedRoute allowedRoles={['guest']}>
              <MainLayout>
                <GuestPayments />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/guest/profile"
          element={
            <ProtectedRoute allowedRoles={['guest']}>
              <MainLayout>
                <GuestProfile />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/guest/destinations"
          element={
            <ProtectedRoute allowedRoles={['guest']}>
              <MainLayout>
                <GuestDestinations />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/guest/marketplace"
          element={
            <ProtectedRoute allowedRoles={['guest']}>
              <MainLayout>
                <MarketplaceHome />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/guest/marketplace/properties/:id"
          element={
            <ProtectedRoute allowedRoles={['guest']}>
              <MainLayout>
                <PropertyDetails />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/guest/marketplace/properties/:propertyId/rooms/:roomId/book"
          element={
            <ProtectedRoute allowedRoles={['guest']}>
              <MainLayout>
                <BookingForm />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/guest/marketplace/properties/:propertyId/rooms/:roomId/checkout"
          element={
            <ProtectedRoute allowedRoles={['guest']}>
              <MainLayout>
                <MarketplaceCheckout />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/guest/marketplace/booking-success"
          element={
            <ProtectedRoute allowedRoles={['guest']}>
              <MainLayout>
                <BookingSuccess />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        
        {/* Owner routes */}
        <Route
          path="/owner/dashboard"
          element={
            <ProtectedRoute allowedRoles={['owner']}>
              <MainLayout>
                <OwnerDashboard />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner/weeks"
          element={
            <ProtectedRoute allowedRoles={['owner']}>
              <MainLayout>
                <Weeks />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner/weeks/:weekId/convert"
          element={
            <ProtectedRoute allowedRoles={['owner']}>
              <MainLayout>
                <ConvertWeek />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner/bookings/:bookingId"
          element={
            <ProtectedRoute allowedRoles={['owner']}>
              <MainLayout>
                <BookingDetails />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner/swaps"
          element={
            <ProtectedRoute allowedRoles={['owner']}>
              <MainLayout>
                <Swaps />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner/credits"
          element={
            <ProtectedRoute allowedRoles={['owner']}>
              <MainLayout>
                <Credits />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner/night-credit-requests/new"
          element={
            <ProtectedRoute allowedRoles={['owner']}>
              <MainLayout>
                <CreateNightCreditRequest />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner/night-credit-requests"
          element={
            <ProtectedRoute allowedRoles={['owner']}>
              <MainLayout>
                <MyNightCreditRequests />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner/profile"
          element={
            <ProtectedRoute allowedRoles={['owner']}>
              <MainLayout>
                <OwnerProfile />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner/marketplace"
          element={
            <ProtectedRoute allowedRoles={['owner']}>
              <MainLayout>
                <MarketplaceHome />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner/marketplace/properties/:id"
          element={
            <ProtectedRoute allowedRoles={['owner']}>
              <MainLayout>
                <PropertyDetails />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner/marketplace/properties/:propertyId/rooms/:roomId/book"
          element={
            <ProtectedRoute allowedRoles={['owner']}>
              <MainLayout>
                <BookingForm />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner/marketplace/properties/:propertyId/rooms/:roomId/checkout"
          element={
            <ProtectedRoute allowedRoles={['owner']}>
              <MainLayout>
                <MarketplaceCheckout />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner/marketplace/booking-success"
          element={
            <ProtectedRoute allowedRoles={['owner']}>
              <MainLayout>
                <BookingSuccess />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        

        {/* Staff routes */}
        <Route
          path="/staff"
          element={
            <ProtectedRoute allowedRoles={['staff']}>
              <StaffLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<StaffDashboard />} />
          <Route path="services" element={<StaffServices />} />
          <Route path="rooms" element={<StaffRooms />} />
          <Route path="products" element={<StaffProducts />} />
          <Route path="night-credits" element={<StaffNightCreditRequests />} />
          <Route path="bookings" element={<StaffPendingBookings />} />
          <Route path="history" element={<StaffHistory />} />
          <Route path="availability" element={<StaffAvailability />} />
          <Route path="profile" element={<StaffProfile />} />
          <Route path="marketplace-settings" element={<StaffMarketplaceSettings />} />
          <Route path="swaps" element={<StaffSwapApprovals />} />
          <Route path="assign-period" element={<StaffAssignPeriod />} />
          <Route path="marketplace" element={<MarketplaceHome />} />
          <Route path="marketplace/properties/:id" element={<PropertyDetails />} />
          <Route path="marketplace/properties/:propertyId/rooms/:roomId/book" element={<BookingForm />} />
          <Route path="marketplace/properties/:propertyId/rooms/:roomId/checkout" element={<MarketplaceCheckout />} />
          <Route path="marketplace/booking-success" element={<BookingSuccess />} />
        </Route>
        
        {/* Admin routes */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <MainLayout>
                <AdminDashboard />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/pending-approvals"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <MainLayout>
                <AdminPendingApprovals />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <MainLayout>
                <AdminUsers />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/logs"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <MainLayout>
                <AdminLogs />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <MainLayout>
                <AdminSettings />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/rooms"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <MainLayout>
                <AdminRooms />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/marketplace"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <MainLayout>
                <MarketplaceHome />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/marketplace/properties/:id"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <MainLayout>
                <PropertyDetails />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/marketplace/properties/:propertyId/rooms/:roomId/book"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <MainLayout>
                <BookingForm />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/marketplace/properties/:propertyId/rooms/:roomId/checkout"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <MainLayout>
                <MarketplaceCheckout />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/marketplace/booking-success"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <MainLayout>
                <BookingSuccess />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        
        {/* Default redirect to welcome */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  useBridge(); // Initialize WebView bridge

  const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Elements stripe={stripePromise}>
          <BrowserRouter>
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
                success: {
                  duration: 3000,
                  iconTheme: {
                    primary: '#10b981',
                    secondary: '#fff',
                  },
                },
                error: {
                  duration: 4000,
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#fff',
                  },
                },
              }}
            />
            <AppRoutes />
          </BrowserRouter>
        </Elements>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
