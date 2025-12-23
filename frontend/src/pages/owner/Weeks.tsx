
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
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<any>(null);

  // Stats
  const stats = useMemo(() => {
    const total = weeks.length;
    const timeshareWeeks = weeks.filter(w => w.source !== 'booking').length;
    const marketplaceBookings = weeks.filter(w => w.source === 'booking').length;
    const used = weeks.filter(w => w.status === 'used' || w.status === 'checked_out').length;
    return { total, timeshareWeeks, marketplaceBookings, used };
  }, [weeks]);

  // Filtered weeks
  const filteredWeeks = useMemo(() => {
    return weeks.filter(w =>
      (statusFilter === 'all' || w.status === statusFilter) &&
      (
        w.Property?.name?.toLowerCase().includes(search.toLowerCase()) ||
        w.Property?.location?.toLowerCase().includes(search.toLowerCase())
      )
    );
  }, [weeks, statusFilter, search]);
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
          <span className="text-xs text-gray-500">Total de reservas</span>
        </div>
        <div className="bg-purple-50 rounded-lg shadow p-4 flex flex-col items-center">
          <span className="text-lg font-semibold text-purple-700">{stats.timeshareWeeks}</span>
          <span className="text-xs text-purple-700">Semanas Timeshare</span>
        </div>
        <div className="bg-blue-50 rounded-lg shadow p-4 flex flex-col items-center">
          <span className="text-lg font-semibold text-blue-700">{stats.marketplaceBookings}</span>
          <span className="text-xs text-blue-700">Reservas Marketplace</span>
        </div>
        <div className="bg-green-50 rounded-lg shadow p-4 flex flex-col items-center">
          <span className="text-lg font-semibold text-green-700">{stats.used}</span>
          <span className="text-xs text-green-700">Utilizadas</span>
        </div>
      </div>

      {/* Usage Chart - parte inferior */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <WeeksUsageChart data={usageData} />
      </div>

      {/* Filters and search */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 flex flex-col md:flex-row md:items-center gap-4">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded px-2 py-1 text-sm bg-white">
          <option value="all">Todas las reservas</option>
          <option value="available">Disponible</option>
          <option value="confirmed">Confirmado</option>
          <option value="used">Utilizado</option>
          <option value="checked_out">Finalizado</option>
        </select>
        <div className="flex items-center border rounded px-2 py-1 w-full md:w-64 bg-white">
          <Search className="h-4 w-4 text-gray-400 mr-2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar propiedad..."
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
                  Propiedad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fechas
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredWeeks.map((week) => (
                <tr key={week.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {week.Property?.name}
                      {(week as any).acquired_via_swap && (
                        <span className="ml-2 inline-block px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                          📦 Obtenido por Swap
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">{week.Property?.location}</div>
                    {(week as any).guest_name && (
                      <div className="text-xs text-gray-600 mt-1">Guest: {(week as any).guest_name}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(week.start_date).toLocaleDateString('es-ES')} - {new Date(week.end_date).toLocaleDateString('es-ES')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-3 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                      {(week as any).accommodation_type || 'Standard'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      week.status === 'available' ? 'bg-green-100 text-green-800' :
                      week.status === 'confirmed' ? 'bg-yellow-100 text-yellow-800' :
                      week.status === 'used' || week.status === 'checked_out' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {week.status === 'used' ? 'Utilizado' : 
                       week.status === 'checked_out' ? 'Finalizado' :
                       week.status === 'confirmed' ? 'Confirmado' :
                       week.status === 'available' ? 'Disponible' : week.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {week.status === 'available' && !((week as any).source === 'booking') && (
                      <button
                        className="text-primary hover:text-primary/80 mr-3"
                        onClick={() => {
                          setSelectedWeek(week);
                          setModalOpen(true);
                        }}
                      >
                        Confirmar
                      </button>
                    )}
                    {((week as any).source === 'booking') && (
                      <a href={`/owner/bookings/${(week as any).booking_id}`} className="text-primary hover:text-primary/80 mr-3">
                        Ver detalles
                      </a>
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
        <h2 className="text-lg font-bold text-gray-900 mt-8 mb-2">Actividad reciente</h2>
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
