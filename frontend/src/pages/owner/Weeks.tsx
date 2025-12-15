
import { useTranslation } from 'react-i18next';
import { useWeeks } from '@/hooks/useWeeks';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { ArrowLeft, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useState, useMemo } from 'react';
import ConfirmWeekModal from '@/components/common/ConfirmWeekModal';
import { useOwnerDashboard } from '@/hooks/useOwnerDashboard';
import ActivityFeed from '@/components/common/ActivityFeed';
import WeeksUsageChart from '@/components/common/WeeksUsageChart';
import { endOfMonth, format } from 'date-fns';
import { es } from 'date-fns/locale';




export default function Weeks(){
  const { t } = useTranslation();
  const {
    weeks,
    isLoading,
    error,
    confirmWeek,
    isConfirming
  } = useWeeks();
  const [search, setSearch] = useState('');
  const [colorFilter, setColorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<any>(null);

  // Stats
  const stats = useMemo(() => {
    const total = weeks.length;
    const available = weeks.filter(w => w.status === 'available').length;
    const confirmed = weeks.filter(w => w.status === 'confirmed').length;
    const converted = weeks.filter(w => w.status === 'converted').length;
    return { total, available, confirmed, converted };
  }, [weeks]);

  // Filtered weeks
  const filteredWeeks = useMemo(() => {
    return weeks.filter(w =>
      (colorFilter === 'all' || w.color === colorFilter) &&
      (statusFilter === 'all' || w.status === statusFilter) &&
      (
        w.Property?.name?.toLowerCase().includes(search.toLowerCase()) ||
        w.Property?.location?.toLowerCase().includes(search.toLowerCase())
      )
    );
  }, [weeks, colorFilter, statusFilter, search]);
// Feed de actividad reciente
const { data: dashboardData, isLoading: loadingDashboard } = useOwnerDashboard();
  // Datos para gráfico de uso mensual (semanas confirmadas por mes)
  const usageData = useMemo(() => {
    const counts: Record<string, number> = {};
    weeks.forEach(w => {
      if (w.status === 'confirmed') {
        const month = format(new Date(w.start_date), 'MMM yyyy', { locale: es });
        counts[month] = (counts[month] || 0) + 1;
      }
    });
    // Ordenar por fecha
    return Object.entries(counts).sort((a, b) => new Date('1 ' + a[0]).getTime() - new Date('1 ' + b[0]).getTime()).map(([month, confirmed]) => ({ month, confirmed }));
  }, [weeks]);
  
  if (isLoading) return <LoadingSpinner size="lg" />;
  if (error) return <ErrorMessage error={error as Error} />;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <Link to="/owner/dashboard" className="text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{t('owner.weeks.title')}</h1>
        </div>
      </header>

      {/* Stats bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 flex flex-col items-center">
          <span className="text-lg font-semibold text-gray-700">{stats.total}</span>
          <span className="text-xs text-gray-500">{t('owner.weeks.total')}</span>
        </div>
        <div className="bg-green-50 rounded-lg shadow p-4 flex flex-col items-center">
          <span className="text-lg font-semibold text-green-700">{stats.available}</span>
          <span className="text-xs text-green-700">{t('owner.weeks.available')}</span>
        </div>
        <div className="bg-yellow-50 rounded-lg shadow p-4 flex flex-col items-center">
          <span className="text-lg font-semibold text-yellow-700">{stats.confirmed}</span>
          <span className="text-xs text-yellow-700">{t('owner.weeks.confirmed')}</span>
        </div>
        <div className="bg-blue-50 rounded-lg shadow p-4 flex flex-col items-center">
          <span className="text-lg font-semibold text-blue-700">{stats.converted}</span>
          <span className="text-xs text-blue-700">{t('owner.weeks.converted')}</span>
        </div>
      </div>

      {/* Usage Chart - parte inferior */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <WeeksUsageChart data={usageData} />
      </div>

      {/* Filters and search */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex gap-2">
          <select value={colorFilter} onChange={e => setColorFilter(e.target.value)} className="border rounded px-2 py-1 text-sm">
            <option value="all">{t('owner.weeks.allColors')}</option>
            <option value="red">{t('owner.weeks.red')}</option>
            <option value="blue">{t('owner.weeks.blue')}</option>
            <option value="white">{t('owner.weeks.white')}</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded px-2 py-1 text-sm">
            <option value="all">{t('owner.weeks.allStatuses')}</option>
            <option value="available">{t('owner.weeks.available')}</option>
            <option value="confirmed">{t('owner.weeks.confirmed')}</option>
            <option value="converted">{t('owner.weeks.converted')}</option>
          </select>
        </div>
        <div className="flex items-center border rounded px-2 py-1 w-full md:w-64 bg-white">
          <Search className="h-4 w-4 text-gray-400 mr-2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('owner.weeks.searchPlaceholder')}
            className="outline-none w-full text-sm bg-transparent"
          />
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('owner.weeks.property')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('owner.weeks.dates')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('owner.weeks.color')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('owner.weeks.status')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('owner.weeks.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredWeeks.map((week) => (
                <tr key={week.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{week.Property?.name}</div>
                    <div className="text-sm text-gray-500">{week.Property?.location}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(week.start_date).toLocaleDateString()} - {new Date(week.end_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      week.color === 'red' ? 'bg-red-100 text-red-800' :
                      week.color === 'blue' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {t(`owner.weeks.${week.color}`)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      week.status === 'available' ? 'bg-green-100 text-green-800' :
                      week.status === 'confirmed' ? 'bg-yellow-100 text-yellow-800' :
                      week.status === 'converted' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {t(`owner.weeks.${week.status}`)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {week.status === 'available' && (
                      <button
                        className="text-primary hover:text-primary/80 mr-3"
                        onClick={() => {
                          setSelectedWeek(week);
                          setModalOpen(true);
                        }}
                      >
                        {t('owner.weeks.confirm')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* Activity Feed - parte inferior */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <h2 className="text-lg font-bold text-gray-900 mt-8 mb-2">{t('owner.dashboard.activityFeed', 'Actividad reciente')}</h2>
        {loadingDashboard ? (
          <LoadingSpinner size="md" />
        ) : (
          <ActivityFeed activity={dashboardData?.recentActivity || []} />
        )}
      </div>
      {/* Confirm Week Modal */}
      <ConfirmWeekModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        week={selectedWeek}
        onConfirm={(extraNights: number, paymentIntentId?: string) => {
          if (!selectedWeek) return;
          // Pasa ambos datos al backend
          confirmWeek({ weekId: selectedWeek.id, data: paymentIntentId ? { extraNights, paymentIntentId } : { extraNights } });
          setModalOpen(false);
        }}
      />
    </div>
  );
}
