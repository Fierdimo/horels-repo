import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { useBridge } from '@/hooks/useBridge';
import { Calendar, Utensils, Coffee, Bell, QrCode, FileText, Loader2, MapPin, User, CreditCard, Search } from 'lucide-react';
import { bookingsApi } from '@/api/bookings';
import { ActiveStayCard } from '@/components/guest/ActiveStayCard';
import { useState, useEffect } from 'react';
import axios from 'axios';

export default function GuestDashboard() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { isWebView } = useBridge();
  const [hasProducts, setHasProducts] = useState(false);

  // Get active booking
  const { data: activeBookingData, isLoading: loadingActive } = useQuery({
    queryKey: ['activeBooking'],
    queryFn: bookingsApi.getActiveBooking,
    enabled: !!user?.id,
  });

  // Get upcoming bookings count
  const { data: upcomingData, isLoading: loadingUpcoming } = useQuery({
    queryKey: ['upcomingBookings'],
    queryFn: bookingsApi.getUpcomingBookings,
    enabled: !!user?.id,
  });

  const activeBooking = activeBookingData?.booking;
  const upcomingBookings = upcomingData?.bookings || [];
  const hasActiveBooking = !!activeBooking;

  // Check if property has products available
  useEffect(() => {
    const checkProducts = async () => {
      if (activeBooking?.property_id) {
        try {
          const response = await axios.get(`/api/public/properties/${activeBooking.property_id}/products`);
          setHasProducts(response.data.data && response.data.data.length > 0);
        } catch (error) {
          setHasProducts(false);
        }
      }
    };

    if (activeBooking) {
      checkProducts();
    }
  }, [activeBooking]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {t('guest.dashboard.welcome') || 'Welcome'}
              </h1>
              <p className="text-sm text-gray-600">{user?.email}</p>
              {isWebView && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                  WebView
                </span>
              )}
            </div>
           
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Active Booking Section */}
        {loadingActive ? (
          <div className="flex justify-center items-center py-12 mb-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : hasActiveBooking ? (
          <div className="mb-8">
            <ActiveStayCard 
              booking={activeBooking}
              hasProducts={hasProducts}
              onRequestService={() => {
                // Navigate to request service page
                window.location.href = `/guest/bookings/${activeBooking.id}/services`;
              }}
            />
          </div>
        ) : null}

        {/* Service Request Cards - Only show if has active booking AND has products */}
        {hasActiveBooking && hasProducts && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {t('guest.dashboard.quickServices') || 'Quick Service Requests'}
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <button
                onClick={() => window.location.href = `/guest/bookings/${activeBooking.id}/services?type=room_service`}
                className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition text-left"
              >
                <Utensils className="h-8 w-8 text-orange-600 mb-2" />
                <h3 className="font-semibold text-gray-900">Room Service</h3>
                <p className="text-xs text-gray-500 mt-1">Order food & drinks</p>
              </button>

              <button
                onClick={() => window.location.href = `/guest/bookings/${activeBooking.id}/services?type=housekeeping`}
                className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition text-left"
              >
                <Coffee className="h-8 w-8 text-blue-600 mb-2" />
                <h3 className="font-semibold text-gray-900">Housekeeping</h3>
                <p className="text-xs text-gray-500 mt-1">Request cleaning</p>
              </button>

              <button
                onClick={() => window.location.href = `/guest/bookings/${activeBooking.id}/services?type=maintenance`}
                className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition text-left"
              >
                <Bell className="h-8 w-8 text-red-600 mb-2" />
                <h3 className="font-semibold text-gray-900">Maintenance</h3>
                <p className="text-xs text-gray-500 mt-1">Report an issue</p>
              </button>

              <button
                onClick={() => window.location.href = `/guest/bookings/${activeBooking.id}/services?type=concierge`}
                className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition text-left"
              >
                <FileText className="h-8 w-8 text-purple-600 mb-2" />
                <h3 className="font-semibold text-gray-900">Concierge</h3>
                <p className="text-xs text-gray-500 mt-1">Get assistance</p>
              </button>
            </div>
          </div>
        )}

        {/* Main Navigation Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Browse Properties Card */}
          <a
            href="/guest/marketplace"
            className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition cursor-pointer"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Search className="h-6 w-6 text-blue-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">
                {t('guest.dashboard.browseProperties') || 'Browse Properties'}
              </h2>
            </div>
            <p className="text-sm text-gray-600">
              {t('guest.dashboard.exploreProperties') || 'Explore available properties and make a booking'}
            </p>
          </a>

          {/* My Bookings Card */}
          <a
            href="/guest/bookings"
            className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition cursor-pointer"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <Calendar className="h-6 w-6 text-green-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">
                {t('guest.dashboard.myBookings') || 'My Bookings'}
              </h2>
            </div>
            <p className="text-sm text-gray-600">
              {t('guest.dashboard.viewBookings') || 'View your current and upcoming reservations'}
            </p>
          </a>

          {/* Payment History Card */}
          <a
            href="/guest/payments"
            className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition cursor-pointer"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <CreditCard className="h-6 w-6 text-purple-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">
                {t('guest.dashboard.paymentHistory') || 'Payment History'}
              </h2>
            </div>
            <p className="text-sm text-gray-600">
              {t('guest.dashboard.viewPayments') || 'View your payment history and receipts'}
            </p>
          </a>

          {/* My Profile Card */}
          <a
            href="/guest/profile"
            className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition cursor-pointer"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-100 rounded-lg">
                <User className="h-6 w-6 text-orange-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">
                {t('guest.dashboard.profile') || 'My Profile'}
              </h2>
            </div>
            <p className="text-sm text-gray-600">
              {t('guest.dashboard.manageProfile') || 'Manage your account and preferences'}
            </p>
          </a>

          {/* Destinations Card */}
          <a
            href="/guest/destinations"
            className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition cursor-pointer"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-pink-100 rounded-lg">
                <MapPin className="h-6 w-6 text-pink-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">
                {t('guest.dashboard.destinations') || 'Destinations'}
              </h2>
            </div>
            <p className="text-sm text-gray-600">
              {t('guest.dashboard.exploreDestinations') || 'Discover amazing destinations around the world'}
            </p>
          </a>
        </div>

        {/* Quick Summary Section */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {t('guest.dashboard.summary') || 'Summary'}
          </h3>
          <div className="bg-white rounded-lg shadow-sm p-6">
            {loadingUpcoming ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <span className="text-sm font-medium text-gray-700">
                    {t('guest.dashboard.currentStay') || 'Current Stay'}
                  </span>
                  <span className={`text-sm font-medium ${hasActiveBooking ? 'text-green-600' : 'text-gray-500'}`}>
                    {hasActiveBooking ? activeBooking.Property?.name : t('guest.dashboard.noActiveBooking') || 'No active booking'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <span className="text-sm font-medium text-gray-700">
                    {t('guest.dashboard.upcomingBookings') || 'Upcoming Bookings'}
                  </span>
                  <span className="text-sm font-medium text-gray-900">{upcomingBookings.length}</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium text-gray-700">
                    {t('guest.dashboard.totalBookings') || 'Total Bookings'}
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {(hasActiveBooking ? 1 : 0) + upcomingBookings.length}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
