import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api/dashboard';
import { 
  Calendar, 
  Repeat, 
  CreditCard, 
  TrendingUp,
  Clock,
  ArrowRight,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { es, enUS, fr, de, it } from 'date-fns/locale';

const localeMap: Record<string, Locale> = {
  es,
  en: enUS,
  fr,
  de,
  it
};

export default function DashboardNew() {
  const { t, i18n } = useTranslation();
  const currentLocale = localeMap[i18n.language] || enUS;

  // Helper function to get translated status
  const getStatusLabel = (status: string): string => {
    const statusKey = `common.statusValues.${status}`;
    const translated = t(statusKey);
    // If translation doesn't exist, return original status
    return translated === statusKey ? status : translated;
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['ownerDashboard'],
    queryFn: dashboardApi.getOwnerDashboard
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-3" />
          <p className="text-red-800 text-center">{t('common.error')}</p>
        </div>
      </div>
    );
  }

  const stats = data?.stats || { totalWeeks: 0, availableWeeks: 0, activeSwaps: 0, upcomingBookings: 0 };
  const credits = data?.credits || null;
  const recentActivity = data?.recentActivity || { weeks: [], swaps: [] };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">
            {t('owner.dashboard.welcome')}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {t('owner.dashboard.subtitle')}
          </p>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Weeks */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('owner.dashboard.totalWeeks')}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalWeeks}</p>
              </div>
              <div className="bg-blue-100 rounded-lg p-3">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <Link 
              to="/owner/weeks" 
              className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              {t('owner.dashboard.viewAll')} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Available Weeks */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('owner.dashboard.availableWeeks')}</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{stats.availableWeeks}</p>
              </div>
              <div className="bg-green-100 rounded-lg p-3">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-500">
              {t('owner.dashboard.readyToUse')}
            </p>
          </div>

          {/* Active Swaps */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('owner.dashboard.activeSwaps')}</p>
                <p className="text-3xl font-bold text-purple-600 mt-2">{stats.activeSwaps}</p>
              </div>
              <div className="bg-purple-100 rounded-lg p-3">
                <Repeat className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <Link 
              to="/owner/swaps" 
              className="mt-4 text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
            >
              {t('owner.dashboard.manageSwaps')} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Upcoming Bookings */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('owner.dashboard.upcomingBookings')}</p>
                <p className="text-3xl font-bold text-orange-600 mt-2">{stats.upcomingBookings}</p>
              </div>
              <div className="bg-orange-100 rounded-lg p-3">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-500">
              {t('owner.dashboard.fromMarketplace')}
            </p>
          </div>
        </div>

        {/* Credits Widget */}
        {credits && (
          <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-lg shadow-lg p-6 mb-8 text-white">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{t('owner.dashboard.myCredits')}</h2>
              <CreditCard className="h-6 w-6" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-purple-200 text-sm">{t('owner.dashboard.totalCredits')}</p>
                <p className="text-3xl font-bold mt-1">{credits.total.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-purple-200 text-sm">{t('owner.dashboard.available')}</p>
                <p className="text-3xl font-bold mt-1">{credits.available.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-purple-200 text-sm">{t('owner.dashboard.expiringSoon')}</p>
                <p className="text-3xl font-bold mt-1">{credits.expiringSoon}</p>
              </div>
            </div>
            <Link 
              to="/owner/credits" 
              className="mt-6 inline-flex items-center gap-2 bg-white text-purple-700 px-4 py-2 rounded-lg hover:bg-purple-50 transition font-medium"
            >
              {t('owner.dashboard.manageCredits')} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Weeks */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{t('owner.dashboard.recentWeeks')}</h2>
            </div>
            <div className="p-6">
              {recentActivity.weeks.length === 0 ? (
                <p className="text-gray-500 text-center py-8">{t('owner.dashboard.noWeeksYet')}</p>
              ) : (
                <div className="space-y-4">
                  {recentActivity.weeks.map((week: any) => (
                    <div key={week.id} className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg">
                      <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{week.Property?.name}</p>
                        <p className="text-sm text-gray-600">
                          {week.Property?.city && week.Property?.country 
                            ? `${week.Property.city}, ${week.Property.country}`
                            : week.Property?.location || 'N/A'
                          }
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {week.start_date && format(new Date(week.start_date), 'PPP', { locale: currentLocale })}
                        </p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        week.status === 'available' ? 'bg-green-100 text-green-800' :
                        week.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {getStatusLabel(week.status)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Swaps */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{t('owner.dashboard.recentSwaps')}</h2>
            </div>
            <div className="p-6">
              {recentActivity.swaps.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">{t('owner.dashboard.noSwapsYet')}</p>
                  <Link 
                    to="/owner/swaps" 
                    className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium"
                  >
                    {t('owner.dashboard.createFirstSwap')} <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentActivity.swaps.map((swap: any) => (
                    <div key={swap.id} className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg">
                      <Repeat className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">Swap #{swap.id}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {swap.createdAt && format(new Date(swap.createdAt), 'PPP', { locale: currentLocale })}
                        </p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        swap.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        swap.status === 'accepted' ? 'bg-green-100 text-green-800' :
                        swap.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {getStatusLabel(swap.status)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('owner.dashboard.quickActions')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to="/owner/weeks"
              className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
            >
              <Calendar className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-gray-900">{t('owner.dashboard.viewMyWeeks')}</span>
            </Link>
            <Link
              to="/owner/swaps"
              className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition"
            >
              <Repeat className="h-5 w-5 text-purple-600" />
              <span className="font-medium text-gray-900">{t('owner.dashboard.createSwap')}</span>
            </Link>
            <Link
              to="/owner/credits"
              className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition"
            >
              <TrendingUp className="h-5 w-5 text-green-600" />
              <span className="font-medium text-gray-900">{t('owner.dashboard.depositWeek')}</span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
