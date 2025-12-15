import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { useBridge } from '@/hooks/useBridge';
import { useAuth } from '@/hooks/useAuth';
import { Calendar, MapPin, Bell, LogOut, ExternalLink } from 'lucide-react';

export default function GuestDashboard() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { isWebView } = useBridge();
  const { logout } = useAuth();

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
            <button
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition"
            >
              <LogOut className="h-4 w-4" />
              {t('auth.logout')}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* My Bookings Card */}
          <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition cursor-pointer">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">
                {t('guest.dashboard.myBookings') || 'My Bookings'}
              </h2>
            </div>
            <p className="text-sm text-gray-600">
              {t('guest.dashboard.viewBookings') || 'View your current and upcoming reservations'}
            </p>
            <div className="mt-4 text-sm text-primary font-medium flex items-center gap-1">
              {t('common.viewAll') || 'View all'}
              <ExternalLink className="h-4 w-4" />
            </div>
          </div>

          {/* Request Services Card */}
          <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition cursor-pointer">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <Bell className="h-6 w-6 text-green-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">
                {t('guest.dashboard.services') || 'Services'}
              </h2>
            </div>
            <p className="text-sm text-gray-600">
              {t('guest.dashboard.requestServices') || 'Request hotel services and amenities'}
            </p>
            <div className="mt-4 text-sm text-primary font-medium flex items-center gap-1">
              {t('guest.dashboard.request') || 'Request'}
              <ExternalLink className="h-4 w-4" />
            </div>
          </div>

          {/* Nearby Attractions Card */}
          <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition cursor-pointer">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <MapPin className="h-6 w-6 text-purple-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">
                {t('guest.dashboard.nearby') || 'Nearby'}
              </h2>
            </div>
            <p className="text-sm text-gray-600">
              {t('guest.dashboard.exploreNearby') || 'Explore attractions and activities nearby'}
            </p>
            <div className="mt-4 text-sm text-primary font-medium flex items-center gap-1">
              {t('common.explore') || 'Explore'}
              <ExternalLink className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* Info Section for WebView Users */}
        {isWebView && (
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">
              {t('guest.dashboard.webviewInfo') || 'Accessing from Secret World App'}
            </h3>
            <p className="text-sm text-blue-700">
              {t('guest.dashboard.webviewDescription') || 
                'You are accessing SW2 Platform through the Secret World mobile app. Enjoy seamless integration with your travel planning!'}
            </p>
          </div>
        )}

        {/* Quick Access Section */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {t('guest.dashboard.quickAccess') || 'Quick Access'}
          </h3>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-700">
                  {t('guest.dashboard.currentStay') || 'Current Stay'}
                </span>
                <span className="text-sm text-gray-500">
                  {t('guest.dashboard.noActiveBooking') || 'No active booking'}
                </span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-700">
                  {t('guest.dashboard.upcomingBookings') || 'Upcoming Bookings'}
                </span>
                <span className="text-sm text-gray-500">0</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-sm font-medium text-gray-700">
                  {t('guest.dashboard.pendingRequests') || 'Pending Service Requests'}
                </span>
                <span className="text-sm text-gray-500">0</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
