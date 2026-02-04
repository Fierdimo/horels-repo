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
  const [activeSection, setActiveSection] = useState<'weeks' | 'bookings' | 'credits'>('weeks');

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
  const pendingBookings = allBookings.filter((b: any) => b.status === 'pending_approval');
  const confirmedBookings = allBookings.filter((b: any) => b.status === 'confirmed');

  // Get available weeks for quick actions
  const availableWeeks = weeks.filter(w => w.status === 'available').slice(0, 3);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold mb-2">{t('owner.dashboard.welcome')}</h1>
          <p className="text-emerald-100">{t('owner.dashboard.subtitle')}</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="bg-emerald-100 rounded-lg p-3">
                <Coins className="h-6 w-6 text-emerald-600" />
              </div>
              <span className="text-3xl font-bold text-emerald-600">{totalBalance}</span>
            </div>
            <p className="text-sm text-gray-600 mb-3">{t('owner.credits.totalBalance')}</p>
            {expiringIn30Days > 0 && (
              <div className="bg-red-50 rounded p-2 flex items-center gap-1">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-xs text-red-700">{expiringIn30Days} {t('owner.unified.expiringSoon')}</span>
              </div>
            )}
          </div>

          {/* <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="bg-blue-100 rounded-lg p-3">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <span className="text-3xl font-bold text-blue-600">{stats.availableWeeks}</span>
            </div>
            <p className="text-sm text-gray-600 mb-3">{t('owner.dashboard.availableWeeks')}</p>
            <Link to="/owner/marketplace" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              {t('owner.unified.releaseForCredits')} <ArrowRight className="h-4 w-4" />
            </Link>
          </div> */}

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="bg-purple-100 rounded-lg p-3">
                <CheckCircle className="h-6 w-6 text-purple-600" />
              </div>
              <span className="text-3xl font-bold text-purple-600">{confirmedBookings.length}</span>
            </div>
            <p className="text-sm text-gray-600 mb-3">{t('owner.unified.confirmedBookings')}</p>
            <button 
              onClick={() => setActiveSection('bookings')}
              className="text-sm text-purple-600 hover:text-purple-700 font-medium"
            >
              {t('common.viewDetails')}
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="bg-orange-100 rounded-lg p-3">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
              <span className="text-3xl font-bold text-orange-600">{pendingBookings.length}</span>
            </div>
            <p className="text-sm text-gray-600 mb-3">{t('owner.unified.pendingBookings')}</p>
            {pendingBookings.length > 0 && (
              <button 
                onClick={() => setActiveSection('bookings')}
                className="text-sm text-orange-600 hover:text-orange-700 font-medium"
              >
                {t('owner.unified.review')}
              </button>
            )}
          </div>
        </div>

        {/* Quick Actions V2 */}
        <div className="bg-gradient-to-r from-blue-50 to-emerald-50 rounded-xl shadow-md p-6 mb-8 border-2 border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Gestiona tus Semanas 2026</h2>
              <p className="text-sm text-gray-600">Ver, convertir y gestionar todas tus semanas asignadas</p>
            </div>
            <Link
              to="/owner/my-weeks"
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-emerald-600 text-white rounded-lg hover:from-blue-700 hover:to-emerald-700 font-medium shadow-lg flex items-center gap-2 transition-all transform hover:scale-105"
            >
              <Calendar className="h-5 w-5" />
              Ver Mis Semanas
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <div className="text-2xl font-bold text-blue-600">{stats.totalWeeks}</div>
              <div className="text-xs text-gray-600 mt-1">Total Semanas</div>
            </div>
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <div className="text-2xl font-bold text-emerald-600">{stats.availableWeeks}</div>
              <div className="text-xs text-gray-600 mt-1">Disponibles</div>
            </div>
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <div className="text-2xl font-bold text-purple-600">{confirmedBookings.length}</div>
              <div className="text-xs text-gray-600 mt-1">Reservadas</div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        {/* <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">{t('owner.dashboard.quickActions')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to="/owner/marketplace"
              className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all"
            >
              <div className="bg-emerald-100 rounded-lg p-3">
                <TrendingUp className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">{t('owner.unified.releaseWeeks')}</div>
                <div className="text-sm text-gray-600">{t('owner.unified.earnCredits')}</div>
              </div>
            </Link>

            <Link
              to="/owner/marketplace"
              className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all"
            >
              <div className="bg-blue-100 rounded-lg p-3">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">{t('owner.unified.searchWeeks')}</div>
                <div className="text-sm text-gray-600">{t('owner.unified.bookWithCredits')}</div>
              </div>
            </Link>

            <button
              onClick={() => setActiveSection('weeks')}
              className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all"
            >
              <div className="bg-purple-100 rounded-lg p-3">
                <Calendar className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">{t('owner.dashboard.myWeeks')}</div>
                <div className="text-sm text-gray-600">{t('owner.unified.viewAll', { count: stats.totalWeeks })}</div>
              </div>
            </button>
          </div>
        </div> */}

        {/* Content Sections */}
        <div className="bg-white rounded-xl shadow-md">
          {/* Section Tabs */}
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveSection('weeks')}
                className={`px-6 py-4 font-medium border-b-2 transition-colors ${
                  activeSection === 'weeks'
                    ? 'border-emerald-600 text-emerald-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t('owner.unified.myWeeksTab', { count: weeks.length })}
              </button>
              <button
                onClick={() => setActiveSection('bookings')}
                className={`px-6 py-4 font-medium border-b-2 transition-colors ${
                  activeSection === 'bookings'
                    ? 'border-emerald-600 text-emerald-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t('owner.unified.myBookingsTab', { count: allBookings.length })}
              </button>
              <button
                onClick={() => setActiveSection('credits')}
                className={`px-6 py-4 font-medium border-b-2 transition-colors ${
                  activeSection === 'credits'
                    ? 'border-emerald-600 text-emerald-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t('owner.unified.creditsHistory')}
              </button>
            </div>
          </div>

          {/* Section Content */}
          <div className="p-6">
            {activeSection === 'weeks' && (
              <div className="space-y-4">
                {weeks.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">{t('owner.dashboard.noWeeksYet')}</p>
                  </div>
                ) : (
                  weeks.slice(0, 10).map((week) => (
                    <div key={week.id} className="border border-gray-200 rounded-lg p-4 hover:border-emerald-500 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 mb-1">
                            {week.Property?.name || 'Propiedad'}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                            <MapPin className="h-4 w-4" />
                            <span>{week.Property?.city}, {week.Property?.country}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="h-4 w-4" />
                            <span>
                              {week.start_date ? format(parseISO(week.start_date), 'dd MMM yyyy', { locale: es }) : 'Flexible'}
                              {' - '}
                              {week.end_date ? format(parseISO(week.end_date), 'dd MMM yyyy', { locale: es }) : 'Flexible'}
                            </span>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          week.status === 'available' ? 'bg-green-100 text-green-800' :
                          week.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {week.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
                {weeks.length > 10 && (
                  <Link 
                    to="/owner/weeks"
                    className="block text-center py-3 text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    Ver todas las semanas ({weeks.length})
                  </Link>
                )}
              </div>
            )}

            {activeSection === 'bookings' && (
              <div className="space-y-4">
                {allBookings.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No tienes reservas aún</p>
                    <Link 
                      to="/owner/marketplace"
                      className="mt-4 inline-block px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
                    >
                      Buscar semanas disponibles
                    </Link>
                  </div>
                ) : (
                  allBookings.map((booking: any) => (
                    <div key={booking.id} className="border border-gray-200 rounded-lg p-4 hover:border-emerald-500 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">{booking.propertyName}</h3>
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <MapPin className="h-4 w-4" />
                            <span>{booking.propertyCity}, {booking.propertyCountry}</span>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          booking.status === 'pending_approval' ? 'bg-yellow-100 text-yellow-800' :
                          booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                          booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {booking.status === 'pending_approval' ? 'Pendiente' :
                           booking.status === 'confirmed' ? 'Confirmada' :
                           booking.status === 'cancelled' ? 'Cancelada' : booking.status}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {format(parseISO(booking.checkIn), 'dd MMM yyyy', { locale: es })}
                            {' - '}
                            {format(parseISO(booking.checkOut), 'dd MMM yyyy', { locale: es })}
                          </span>
                        </div>
                        {booking.creditsUsed && booking.creditsUsed > 0 && (
                          <div className="flex items-center gap-2 text-emerald-600 font-medium">
                            <Coins className="h-4 w-4" />
                            <span>{booking.creditsUsed} créditos</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeSection === 'credits' && (
              <div className="space-y-4">
                <div className="bg-emerald-50 rounded-lg p-6 mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Balance Total</p>
                      <p className="text-4xl font-bold text-emerald-600">{totalBalance}</p>
                      <p className="text-sm text-gray-600 mt-1">créditos disponibles</p>
                    </div>
                    <Coins className="h-16 w-16 text-emerald-600 opacity-20" />
                  </div>
                </div>

                <div className="text-center py-8 text-gray-600">
                  <p>El historial detallado de transacciones se puede ver en la página completa de créditos</p>
                  <Link 
                    to="/owner/credits"
                    className="mt-4 inline-block text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    Ver historial completo <ArrowRight className="inline h-4 w-4" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
