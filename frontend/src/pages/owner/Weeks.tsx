
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
    confirmInvitationBooking,
    convertInvitationBookingToCredits,
    isConfirming,
    isConfirmingInvitation,
    isConvertingInvitation
  } = useWeeks();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<any>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);

  // Stats
  const stats = useMemo(() => {
    const total = weeks.length;
    const timeshareWeeks = weeks.filter(w => w.source !== 'booking').length;
    
    // Count invitation bookings vs marketplace bookings
    const invitationBookings = weeks.filter(w => {
      if (w.source !== 'booking') return false;
      const bookingType = (w as any).booking_type;
      return bookingType === 'owner_invitation';
    }).length;
    
    const marketplaceBookings = weeks.filter(w => {
      if (w.source !== 'booking') return false;
      const bookingType = (w as any).booking_type;
      return !bookingType || bookingType !== 'owner_invitation';
    }).length;
    
    const used = weeks.filter(w => w.status === 'used' || w.status === 'checked_out').length;
    return { total, timeshareWeeks, invitationBookings, marketplaceBookings, used };
  }, [weeks]);

  // Filtered weeks
  const filteredWeeks = useMemo(() => {
    return weeks.filter(w =>
      (statusFilter === 'all' || w.status === statusFilter) &&
      (
        w.Property?.name?.toLowerCase().includes(search.toLowerCase()) ||
        w.Property?.city?.toLowerCase().includes(search.toLowerCase()) ||
        w.Property?.country?.toLowerCase().includes(search.toLowerCase())
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
          <span className="text-xs text-gray-500">{t('owner.weeks.totalReservations')}</span>
        </div>
        <div className="bg-purple-50 rounded-lg shadow p-4 flex flex-col items-center">
          <span className="text-lg font-semibold text-purple-700">{stats.timeshareWeeks}</span>
          <span className="text-xs text-purple-700">{t('owner.weeks.timeshareWeeks')}</span>
        </div>
        <div className="bg-orange-50 rounded-lg shadow p-4 flex flex-col items-center">
          <span className="text-lg font-semibold text-orange-700">{stats.invitationBookings}</span>
          <span className="text-xs text-orange-700">{t('owner.weeks.invitationBookings')}</span>
        </div>
        <div className="bg-blue-50 rounded-lg shadow p-4 flex flex-col items-center">
          <span className="text-lg font-semibold text-blue-700">{stats.marketplaceBookings}</span>
          <span className="text-xs text-blue-700">{t('owner.weeks.marketplaceBookings')}</span>
        </div>
      </div>

      {/* Usage Chart - parte inferior */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <WeeksUsageChart data={usageData} />
      </div>

      {/* Filters and search */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 flex flex-col md:flex-row md:items-center gap-4">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded px-2 py-1 text-sm bg-white">
          <option value="all">{t('owner.weeks.allReservations')}</option>
          <option value="available">{t('owner.weeks.available')}</option>
          <option value="confirmed">{t('owner.weeks.confirmed')}</option>
          <option value="used">{t('owner.weeks.used')}</option>
          <option value="checked_out">{t('owner.weeks.checkedOut')}</option>
        </select>
        <div className="flex items-center border rounded px-2 py-1 w-full md:w-64 bg-white">
          <Search className="h-4 w-4 text-gray-400 mr-2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('owner.weeks.searchProperty')}
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
                  {t('owner.weeks.type')}
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
                    <div className="text-sm font-medium text-gray-900">
                      {week.Property?.name}
                      {(week as any).acquired_via_swap && (
                        <span className="ml-2 inline-block px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                          📦 {t('owner.weeks.acquiredViaSwap')}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {week.Property?.city && week.Property?.country 
                        ? `${week.Property.city}, ${week.Property.country}`
                        : week.Property?.location || 'N/A'
                      }
                    </div>
                    {(week as any).guest_name && (
                      <div className="text-xs text-gray-600 mt-1">{t('common.guest')}: {(week as any).guest_name}</div>
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
                      week.status === 'pending_approval' ? 'bg-purple-100 text-purple-800' :
                      week.status === 'used' || week.status === 'checked_out' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {week.status === 'used' ? t('owner.weeks.used') : 
                       week.status === 'checked_out' ? t('owner.weeks.checkedOut') :
                       week.status === 'confirmed' ? t('common.statusValues.confirmed') :
                       week.status === 'pending_approval' ? t('common.statusValues.pending_approval') :
                       week.status === 'pending' ? t('common.statusValues.pending') :
                       week.status === 'available' ? t('common.statusValues.available') : week.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {/* Pending invitation booking - owner must decide */}
                    {week.status === 'pending' && (week as any).booking_type === 'owner_invitation' && (
                      <div className="flex gap-2">
                        <button
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-xs"
                          onClick={() => {
                            setSelectedBooking(week);
                            setConfirmModalOpen(true);
                          }}
                          disabled={isConfirmingInvitation || isConvertingInvitation}
                        >
                          ✓ {t('owner.weeks.confirmBooking')}
                        </button>
                        <button
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-xs"
                          onClick={() => {
                            setSelectedBooking(week);
                            setConvertModalOpen(true);
                          }}
                          disabled={isConfirmingInvitation || isConvertingInvitation}
                        >
                          💳 {t('owner.weeks.convertToCredits')}
                        </button>
                      </div>
                    )}
                    
                    {/* Regular available week */}
                    {week.status === 'available' && !((week as any).source === 'booking') && (
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
                    
                    {/* Confirmed booking from marketplace */}
                    {((week as any).source === 'booking') && week.status !== 'pending' && (
                      <a href={`/owner/bookings/${(week as any).booking_id}`} className="text-primary hover:text-primary/80 mr-3">
                        {t('owner.weeks.viewDetails')}
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
          <ActivityFeed activity={[
            ...(dashboardData?.recentActivity?.weeks?.map((w: any) => ({
              type: 'week_confirmed',
              description: `${w.Property?.name || 'Week'} - ${w.accommodation_type}`,
              timestamp: w.created_at
            })) || []),
            ...(dashboardData?.recentActivity?.swaps?.map((s: any) => ({
              type: s.status === 'accepted' ? 'swap_accepted' : 'swap_created',
              description: `Swap request ${s.status}`,
              timestamp: s.created_at
            })) || [])
          ]} />
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

      {/* Confirm Booking Modal */}
      {confirmModalOpen && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Confirmar Booking
            </h3>
            <p className="text-gray-600 mb-6">
              ¿Estás seguro de que deseas confirmar este booking?
            </p>
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm font-medium text-gray-700">
                <strong>Propiedad:</strong> {selectedBooking.Property?.name}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Fechas:</strong> {new Date(selectedBooking.start_date).toLocaleDateString()} - {new Date(selectedBooking.end_date).toLocaleDateString()}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Tipo:</strong> {selectedBooking.accommodation_type}
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                onClick={() => {
                  setConfirmModalOpen(false);
                  setSelectedBooking(null);
                }}
                disabled={isConfirmingInvitation}
              >
                Cancelar
              </button>
              <button
                className="px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                onClick={() => {
                  confirmInvitationBooking(selectedBooking.booking_id);
                  setConfirmModalOpen(false);
                  setSelectedBooking(null);
                }}
                disabled={isConfirmingInvitation}
              >
                {isConfirmingInvitation ? 'Confirmando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert to Credits Modal */}
      {convertModalOpen && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Convertir a Créditos
            </h3>
            <p className="text-gray-600 mb-4">
              ¿Estás seguro de que deseas convertir este booking a créditos?
            </p>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
              <p className="text-sm text-yellow-700">
                <strong>⚠️ Importante:</strong> Esta acción no se puede deshacer. El booking será cancelado y recibirás créditos en tu cuenta.
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm font-medium text-gray-700">
                <strong>Propiedad:</strong> {selectedBooking.Property?.name}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Fechas:</strong> {new Date(selectedBooking.start_date).toLocaleDateString()} - {new Date(selectedBooking.end_date).toLocaleDateString()}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Tipo:</strong> {selectedBooking.accommodation_type}
              </p>
              {selectedBooking.raw?.estimated_credits && (
                <p className="text-sm text-blue-600 font-medium mt-2">
                  <strong>Créditos estimados:</strong> {selectedBooking.raw.estimated_credits}
                </p>
              )}
            </div>
            <div className="flex gap-3 justify-end">
              <button
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                onClick={() => {
                  setConvertModalOpen(false);
                  setSelectedBooking(null);
                }}
                disabled={isConvertingInvitation}
              >
                Cancelar
              </button>
              <button
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                onClick={() => {
                  convertInvitationBookingToCredits(selectedBooking.booking_id);
                  setConvertModalOpen(false);
                  setSelectedBooking(null);
                }}
                disabled={isConvertingInvitation}
              >
                {isConvertingInvitation ? 'Convirtiendo...' : 'Convertir a Créditos'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
