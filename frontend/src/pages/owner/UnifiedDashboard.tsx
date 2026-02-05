import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api/dashboard';
import { timeshareApi } from '@/api/timeshare';
import { useWeeks } from '@/hooks/useWeeks';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  Coins, 
  TrendingUp,
  AlertCircle,
  Plus,
  ArrowRight,
  MapPin,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export default function UnifiedDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<'weeks' | 'bookings' | 'credits'>('credits');

  // Fetch data
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ['ownerDashboard'],
    queryFn: dashboardApi.getOwnerDashboard
  });

  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ['creditWallet'],
    queryFn: timeshareApi.getCreditWallet
  });

  const { data: bookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ['myBookings'],
    queryFn: timeshareApi.getMyBookings
  });

  const { weeks, isLoading: weeksLoading } = useWeeks();

  const isLoading = dashboardLoading || walletLoading || bookingsLoading || weeksLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  // Process data
  const stats = dashboardData?.stats || { totalWeeks: 0, availableWeeks: 0, activeSwaps: 0, upcomingBookings: 0 };
  const credits = dashboardData?.credits || { total: 0, available: 0, expiringSoon: 0 };
  const totalBalance = wallet?.balance || credits.total || 0;
  const expiringIn30Days = credits.expiringSoon || 0;
  const allBookings = Array.isArray(bookings) ? bookings : [];
  const pendingBookings = allBookings.filter((b: any) => b.status === 'PENDING_APPROVAL');
  const confirmedBookings = allBookings.filter((b: any) => b.status === 'CONFIRMED');

  // Get available weeks for quick actions
  const availableWeeks = weeks.filter((w: any) => w.status === 'available').slice(0, 3);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-emerald-50">
      {/* Header Moderno */}
      <header className="relative overflow-hidden bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600">
        <div className="absolute inset-0 bg-black opacity-5"></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIxLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNCA0LTEuNzkgNC00em0wLTEwYzAtMi4yMS0xLjc5LTQtNC00cy00IDEuNzktNCA0IDEuNzkgNCA0IDQgNC0xLjc5IDQtNHptMC0xMGMwLTIuMjEtMS43OS00LTQtNHMtNCAxLjc5LTQgNCAxLjc5IDQgNCA0IDQtMS43OSA0LTR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
                <span className="inline-block w-2 h-12 bg-white rounded-full"></span>
                {t('owner.dashboard.welcome')}
              </h1>
              <p className="text-emerald-100 text-lg">{t('owner.dashboard.subtitle')}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 -mt-6">

        {/* Quick Actions Card - Más Moderna */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-500 to-emerald-500 rounded-2xl shadow-xl p-8 mb-8 border border-blue-400">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-40 h-40 bg-emerald-500/20 rounded-full blur-3xl"></div>
          <div className="relative">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-6">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                  <Calendar className="h-6 w-6" />
                  {t('owner.unified.manageYourWeeks2026')}
                </h2>
                <p className="text-blue-100">{t('owner.unified.viewConvertManageWeeks')}</p>
              </div>
              <Link
                to="/owner/my-weeks"
                className="group flex items-center gap-3 px-8 py-4 bg-white text-blue-600 rounded-xl hover:bg-blue-50 font-semibold shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
              >
                <span>{t('owner.unified.viewMyWeeks')}</span>
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/90 backdrop-blur-sm rounded-xl p-5 text-center hover:bg-white transition-colors">
                <div className="text-3xl font-bold text-blue-600 mb-1">{stats.totalWeeks}</div>
                <div className="text-xs text-gray-600 font-medium">{t('owner.unified.totalWeeks')}</div>
              </div>
              <div className="bg-white/90 backdrop-blur-sm rounded-xl p-5 text-center hover:bg-white transition-colors">
                <div className="text-3xl font-bold text-emerald-600 mb-1">{stats.availableWeeks}</div>
                <div className="text-xs text-gray-600 font-medium">{t('owner.unified.available')}</div>
              </div>
              <div className="bg-white/90 backdrop-blur-sm rounded-xl p-5 text-center hover:bg-white transition-colors">
                <div className="text-3xl font-bold text-purple-600 mb-1">{confirmedBookings.length}</div>
                <div className="text-xs text-gray-600 font-medium">{t('owner.unified.reserved')}</div>
              </div>
            </div>
          </div>
        </div>


        {/* Content Sections - Tabs Modernos */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
          {/* Section Tabs - Diseño Moderno */}
          <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex">
              <button
                onClick={() => setActiveSection('credits')}
                className={`relative px-8 py-5 font-semibold transition-all duration-300 ${
                  activeSection === 'credits'
                    ? 'text-emerald-600'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Coins className="h-5 w-5" />
                  {t('owner.unified.creditsHistory')}
                </span>
                {activeSection === 'credits' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-t-full"></div>
                )}
              </button>
              <button
                onClick={() => setActiveSection('weeks')}
                className={`relative px-8 py-5 font-semibold transition-all duration-300 ${
                  activeSection === 'weeks'
                    ? 'text-emerald-600'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {t('owner.unified.myWeeksTab', { count: weeks.length })}
                </span>
                {activeSection === 'weeks' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-t-full"></div>
                )}
              </button>
              <button
                onClick={() => setActiveSection('bookings')}
                className={`relative px-8 py-5 font-semibold transition-all duration-300 ${
                  activeSection === 'bookings'
                    ? 'text-emerald-600'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  {t('owner.unified.myBookingsTab', { count: allBookings.length })}
                </span>
                {activeSection === 'bookings' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-t-full"></div>
                )}
              </button>
            </div>
          </div>

          {/* Section Content */}
          <div className="p-8 bg-gradient-to-b from-white to-gray-50">
            {activeSection === 'credits' && (
              <div className="space-y-6">
                <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 rounded-2xl p-8 shadow-xl">
                  <div className="absolute top-0 right-0 -mt-4 -mr-4 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                  <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-40 h-40 bg-emerald-700/20 rounded-full blur-3xl"></div>
                  <div className="relative flex items-center justify-between">
                    <div>
                      <p className="text-emerald-100 mb-2 font-medium">{t('owner.unified.totalBalance')}</p>
                      <p className="text-6xl font-bold text-white mb-2">{totalBalance}</p>
                      <p className="text-emerald-100">{t('owner.unified.creditsAvailable')}</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                      <Coins className="h-20 w-20 text-white" />
                    </div>
                  </div>
                </div>

                <div className="text-center py-12 bg-gradient-to-b from-gray-50 to-white rounded-2xl border border-gray-200">
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">{t('owner.unified.detailedHistoryMessage')}</p>
                  <Link 
                    to="/owner/credits"
                    className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-semibold text-lg group"
                  >
                    {t('owner.unified.viewFullHistory')}
                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            )}

            {activeSection === 'weeks' && (
              <div className="space-y-4">
                {weeks.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                      <Calendar className="h-12 w-12 text-gray-400" />
                    </div>
                    <p className="text-gray-600 text-lg font-medium">{t('owner.dashboard.noWeeksYet')}</p>
                  </div>
                ) : (
                  weeks.slice(0, 10).map((week: any) => {
                    const property = week.Ownership?.Unit?.Property;
                    return (
                    <div key={week.id} className="group border border-gray-200 rounded-xl p-5 hover:border-emerald-400 hover:shadow-lg transition-all duration-300 bg-white">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900 mb-2 text-lg group-hover:text-emerald-600 transition-colors">
                            {property?.name || t('owner.unified.property')}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                            <div className="bg-emerald-50 rounded-lg p-2">
                              <MapPin className="h-4 w-4 text-emerald-600" />
                            </div>
                            <span className="font-medium">
                              {property?.city && property?.country
                                ? `${property.city}, ${property.country}`
                                : property?.location || t('owner.unified.locationNotAvailable')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <div className="bg-blue-50 rounded-lg p-2">
                              <Calendar className="h-4 w-4 text-blue-600" />
                            </div>
                            <span className="font-medium">
                              {week.start_date ? format(parseISO(week.start_date), 'dd MMM yyyy', { locale: es }) : t('owner.unified.flexible')}
                              {' - '}
                              {week.end_date ? format(parseISO(week.end_date), 'dd MMM yyyy', { locale: es }) : t('owner.unified.flexible')}
                            </span>
                          </div>
                        </div>
                        <span className={`px-4 py-2 rounded-full text-sm font-semibold shadow-sm ${
                          week.status === 'available' ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white' :
                          week.status === 'confirmed' ? 'bg-gradient-to-r from-blue-400 to-cyan-500 text-white' :
                          week.status === 'used' ? 'bg-gradient-to-r from-purple-400 to-indigo-500 text-white' :
                          'bg-gray-200 text-gray-700'
                        }`}>
                          {week.status}
                        </span>
                      </div>
                    </div>
                  )})
                )}
                {weeks.length > 10 && (
                  <Link 
                    to="/owner/weeks"
                    className="block text-center py-4 text-emerald-600 hover:text-emerald-700 font-semibold hover:bg-emerald-50 rounded-xl transition-all"
                  >
                    {t('owner.unified.viewAllWeeks', { count: weeks.length })} →
                  </Link>
                )}
              </div>
            )}

            {activeSection === 'bookings' && (
              <div className="space-y-4">
                {allBookings.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                      <Calendar className="h-12 w-12 text-gray-400" />
                    </div>
                    <p className="text-gray-600 text-lg font-medium mb-6">{t('owner.unified.noReservationsYet')}</p>
                    <Link 
                      to="/owner/marketplace"
                      className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 font-semibold shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
                    >
                      <TrendingUp className="h-5 w-5" />
                      {t('owner.unified.searchAvailableWeeks')}
                    </Link>
                  </div>
                ) : (
                  allBookings.map((booking: any) => (
                    <div key={booking.id} className="group border border-gray-200 rounded-xl p-5 hover:border-purple-400 hover:shadow-lg transition-all duration-300 bg-white">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900 mb-2 text-lg group-hover:text-purple-600 transition-colors">
                            {booking.property?.name || t('owner.unified.property')}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                            <div className="bg-purple-50 rounded-lg p-2">
                              <MapPin className="h-4 w-4 text-purple-600" />
                            </div>
                            <span className="font-medium">
                              {booking.property?.location || t('owner.unified.locationNotAvailable')}
                            </span>
                          </div>
                        </div>
                        <span className={`px-4 py-2 rounded-full text-sm font-semibold shadow-sm ${
                          booking.status === 'PENDING_APPROVAL' ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white' :
                          booking.status === 'CONFIRMED' ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white' :
                          booking.status === 'CANCELLED' ? 'bg-gradient-to-r from-red-400 to-rose-500 text-white' :
                          'bg-gray-200 text-gray-700'
                        }`}>
                          {booking.status === 'PENDING_APPROVAL' ? t('owner.unified.pending') :
                           booking.status === 'CONFIRMED' ? t('owner.unified.confirmed') :
                           booking.status === 'CANCELLED' ? t('owner.unified.cancelled') : booking.status}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <div className="bg-blue-50 rounded-lg p-2">
                            <Calendar className="h-4 w-4 text-blue-600" />
                          </div>
                          <span className="font-medium">
                            {format(parseISO(booking.checkIn), 'dd MMM yyyy', { locale: es })}
                            {' - '}
                            {format(parseISO(booking.checkOut), 'dd MMM yyyy', { locale: es })}
                          </span>
                        </div>
                        {booking.creditsUsed && parseFloat(booking.creditsUsed) > 0 && (
                          <div className="flex items-center gap-2">
                            <div className="bg-emerald-50 rounded-lg p-2">
                              <Coins className="h-4 w-4 text-emerald-600" />
                            </div>
                            <span className="text-sm text-emerald-700 font-semibold">
                              {booking.creditsUsed} {t('owner.unified.credits')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
