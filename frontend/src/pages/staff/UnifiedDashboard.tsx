import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { 
  Clock, CheckCircle, Users, Calendar, Bed, Search, Filter, 
  XCircle, AlertTriangle, ArrowRight, User, LayoutDashboard,
  ClipboardList, CalendarCheck, History as HistoryIcon
} from 'lucide-react';
import apiClient from '@/api/client';
import { timeshareApi } from '@/api/timeshare';
import toast from 'react-hot-toast';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ModernCard, CardHeader, CardFooter, StatBadge } from '@/components/ui/ModernCard';
import { KanbanColumn, KanbanContainer } from '@/components/ui/ModernKanban';
import { ModernTabs } from '@/components/ui/ModernTabs';

type TabType = 'summary' | 'services' | 'bookings' | 'history';

export default function UnifiedDashboard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedBooking, setSelectedBooking] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Fetch hotel services
  const { data: servicesData, isLoading: servicesLoading } = useQuery({
    queryKey: ['staff-services', statusFilter],
    queryFn: async () => {
      const url = statusFilter === 'all' 
        ? '/hotel-staff/services' 
        : `/hotel-staff/services?status=${statusFilter}`;
      const { data } = await apiClient.get(url);
      return data;
    }
  });

  // Fetch rooms
  const { data: roomsData } = useQuery({
    queryKey: ['staff-rooms'],
    queryFn: async () => {
      const { data } = await apiClient.get('/hotel-staff/rooms');
      return data;
    }
  });

  // Fetch bookings
  const { data: bookingsData } = useQuery({
    queryKey: ['staff-bookings'],
    queryFn: async () => {
      const { data } = await apiClient.get('/dashboard/bookings');
      return data;
    }
  });

  // Fetch pending approval bookings
  const { data: pendingBookingsData } = useQuery({
    queryKey: ['staff-pending-approvals'],
    queryFn: timeshareApi.getPendingApprovals
  });

  // Update service status mutation
  const updateServiceMutation = useMutation({
    mutationFn: async ({ serviceId, status }: { serviceId: number; status: string }) => {
      const { data } = await apiClient.patch(`/hotel-staff/services/${serviceId}`, { status });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-services'] });
      toast.success(t('staff.services.updateSuccess'));
    },
    onError: () => {
      toast.error(t('common.error'));
    }
  });

  // Approve booking mutation
  const approveMutation = useMutation({
    mutationFn: (bookingId: number) => timeshareApi.approveBooking(bookingId),
    onSuccess: () => {
      toast.success('Booking aprobado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['staff-pending-approvals'] });
      setSelectedBooking(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al aprobar el booking');
    }
  });

  // Reject booking mutation
  const rejectMutation = useMutation({
    mutationFn: ({ bookingId, reason }: { bookingId: number; reason: string }) => 
      timeshareApi.rejectBooking(bookingId, reason),
    onSuccess: () => {
      toast.success('Booking rechazado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['staff-pending-approvals'] });
      setSelectedBooking(null);
      setRejectReason('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al rechazar el booking');
    }
  });

  // Calculate stats
  const services = Array.isArray(servicesData?.services) ? servicesData.services : [];
  const pendingServices = services.filter((s: any) => s.status === 'pending').length;
  const confirmedServices = services.filter((s: any) => s.status === 'confirmed').length;
  
  const bookings = Array.isArray(bookingsData?.bookings) ? bookingsData.bookings : [];
  const today = new Date().toISOString().split('T')[0];
  const todayCheckIns = bookings.filter((b: any) => b.check_in_date?.startsWith(today)).length;
  const todayCheckOuts = bookings.filter((b: any) => b.check_out_date?.startsWith(today)).length;

  const rooms = Array.isArray(roomsData?.rooms) ? roomsData.rooms : [];
  const totalRooms = rooms.length;
  const availableRooms = rooms.filter((r: any) => r.status === 'available' || r.status === 'disponible').length;

  const pendingBookings = Array.isArray(pendingBookingsData) 
    ? pendingBookingsData.filter((b: any) => b.status === 'pending_approval')
    : [];

  // Filter services for search
  const filteredServices = services.filter((service: any) => {
    const matchesSearch = 
      (service.service_type || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (service.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (service.Booking?.room_number || '').toString().includes(searchQuery);
    return matchesSearch;
  });

  // Get completed services for history
  const completedServices = services.filter((s: any) => 
    s.status === 'completed' || s.status === 'cancelled'
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const renderSummaryTab = () => (
    <div className="space-y-6">
      {/* Stats Overview - Kanban Style */}
      <KanbanContainer columns={4}>
        {/* Pending Services */}
        <KanbanColumn
          title="Servicios"
          total={pendingServices}
          count={services.length}
          color="yellow"
          icon={<Clock className="h-5 w-5" />}
        >
          {pendingServices > 0 ? (
            <ModernCard statusColor="yellow" onClick={() => setActiveTab('services')}>
              <CardHeader
                title={`${pendingServices} Pendientes`}
                subtitle="Requieren atención"
                badge={<StatBadge value={pendingServices} variant="warning" />}
              />
              <div className="text-sm text-gray-600 mt-2">
                Click para revisar →
              </div>
            </ModernCard>
          ) : (
            <ModernCard statusColor="green">
              <div className="text-center py-4">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
                <p className="text-sm text-gray-600">Todo al día</p>
              </div>
            </ModernCard>
          )}
        </KanbanColumn>

        {/* Pending Bookings */}
        <KanbanColumn
          title="Aprobaciones"
          total={pendingBookings.length}
          count={pendingBookings.length}
          color="purple"
          icon={<AlertTriangle className="h-5 w-5" />}
        >
          {pendingBookings.length > 0 ? (
            <ModernCard statusColor="purple" onClick={() => setActiveTab('bookings')}>
              <CardHeader
                title={`${pendingBookings.length} Bookings`}
                subtitle="Esperando aprobación"
                badge={<StatBadge value={pendingBookings.length} variant="danger" />}
              />
              <div className="text-sm text-gray-600 mt-2">
                Click para aprobar →
              </div>
            </ModernCard>
          ) : (
            <ModernCard statusColor="green">
              <div className="text-center py-4">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
                <p className="text-sm text-gray-600">Sin pendientes</p>
              </div>
            </ModernCard>
          )}
        </KanbanColumn>

        {/* Check-ins Today */}
        <KanbanColumn
          title="Check-ins"
          total={todayCheckIns}
          count={todayCheckIns}
          color="green"
          icon={<Calendar className="h-5 w-5" />}
        >
          <ModernCard statusColor="green">
            <CardHeader
              title="Hoy"
              subtitle={`${todayCheckIns} llegadas programadas`}
            />
            <div className="mt-4">
              <div className="text-3xl font-bold text-green-600">{todayCheckIns}</div>
              <p className="text-sm text-gray-500 mt-1">Check-ins del día</p>
            </div>
          </ModernCard>
        </KanbanColumn>

        {/* Rooms Status */}
        <KanbanColumn
          title="Habitaciones"
          total={`${availableRooms}/${totalRooms}`}
          count={totalRooms}
          color="blue"
          icon={<Bed className="h-5 w-5" />}
        >
          <ModernCard statusColor="blue">
            <CardHeader
              title="Disponibilidad"
              subtitle={`${availableRooms} disponibles`}
            />
            <div className="space-y-3 mt-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Disponibles</span>
                <StatBadge value={availableRooms} variant="success" />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Ocupadas</span>
                <StatBadge value={totalRooms - availableRooms} variant="default" />
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${totalRooms > 0 ? ((totalRooms - availableRooms) / totalRooms) * 100 : 0}%` }}
                />
              </div>
            </div>
          </ModernCard>
        </KanbanColumn>
      </KanbanContainer>
    </div>
  );

  const renderServicesTab = () => (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar servicios..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none transition-all"
            >
              <option value="all">Todos los estados</option>
              <option value="pending">Pendiente</option>
              <option value="confirmed">Confirmado</option>
              <option value="completed">Completado</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>
        </div>
      </div>

      {/* Services Kanban */}
      {servicesLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-12 text-center">
          <ClipboardList className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">No hay servicios</p>
        </div>
      ) : (
        <KanbanContainer columns={3}>
          {/* Pending */}
          <KanbanColumn
            title="Pendientes"
            total={filteredServices.filter((s: any) => s.status === 'pending').length}
            count={filteredServices.filter((s: any) => s.status === 'pending').length}
            color="yellow"
            icon={<Clock className="h-5 w-5" />}
          >
            {filteredServices
              .filter((s: any) => s.status === 'pending')
              .map((service: any) => (
                <ModernCard key={service.id} statusColor="yellow">
                  <CardHeader
                    title={service.service_type}
                    subtitle={service.description}
                    badge={<StatBadge value="Pendiente" variant="warning" />}
                  />
                  <div className="flex items-center gap-2 text-sm text-gray-500 mt-2 mb-4">
                    <Bed className="h-4 w-4" />
                    <span>Hab. {service.Booking?.room_number || 'N/A'}</span>
                    <span>•</span>
                    <span>{new Date(service.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateServiceMutation.mutate({ serviceId: service.id, status: 'confirmed' })}
                      disabled={updateServiceMutation.isPending}
                      className="flex-1 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      ✓ Confirmar
                    </button>
                    <button
                      onClick={() => updateServiceMutation.mutate({ serviceId: service.id, status: 'cancelled' })}
                      disabled={updateServiceMutation.isPending}
                      className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    >
                      × Cancelar
                    </button>
                  </div>
                </ModernCard>
              ))}
          </KanbanColumn>

          {/* Confirmed */}
          <KanbanColumn
            title="Confirmados"
            total={filteredServices.filter((s: any) => s.status === 'confirmed').length}
            count={filteredServices.filter((s: any) => s.status === 'confirmed').length}
            color="blue"
            icon={<CalendarCheck className="h-5 w-5" />}
          >
            {filteredServices
              .filter((s: any) => s.status === 'confirmed')
              .map((service: any) => (
                <ModernCard key={service.id} statusColor="blue">
                  <CardHeader
                    title={service.service_type}
                    subtitle={service.description}
                    badge={<StatBadge value="Confirmado" variant="info" />}
                  />
                  <div className="flex items-center gap-2 text-sm text-gray-500 mt-2 mb-4">
                    <Bed className="h-4 w-4" />
                    <span>Hab. {service.Booking?.room_number || 'N/A'}</span>
                    <span>•</span>
                    <span>{new Date(service.created_at).toLocaleDateString()}</span>
                  </div>
                  <button
                    onClick={() => updateServiceMutation.mutate({ serviceId: service.id, status: 'completed' })}
                    disabled={updateServiceMutation.isPending}
                    className="w-full px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    ✓ Completar
                  </button>
                </ModernCard>
              ))}
          </KanbanColumn>

          {/* Completed */}
          <KanbanColumn
            title="Completados"
            total={filteredServices.filter((s: any) => s.status === 'completed' || s.status === 'cancelled').length}
            count={filteredServices.filter((s: any) => s.status === 'completed' || s.status === 'cancelled').length}
            color="green"
            icon={<CheckCircle className="h-5 w-5" />}
          >
            {filteredServices
              .filter((s: any) => s.status === 'completed' || s.status === 'cancelled')
              .map((service: any) => (
                <ModernCard key={service.id} statusColor={service.status === 'completed' ? 'green' : 'gray'}>
                  <CardHeader
                    title={service.service_type}
                    subtitle={service.description}
                    badge={
                      <StatBadge
                        value={service.status === 'completed' ? 'Completado' : 'Cancelado'}
                        variant={service.status === 'completed' ? 'success' : 'default'}
                      />
                    }
                  />
                  <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
                    <Bed className="h-4 w-4" />
                    <span>Hab. {service.Booking?.room_number || 'N/A'}</span>
                    <span>•</span>
                    <span>{new Date(service.created_at).toLocaleDateString()}</span>
                  </div>
                </ModernCard>
              ))}
          </KanbanColumn>
        </KanbanContainer>
      )}
    </div>
  );

  const renderBookingsTab = () => (
    <div className="space-y-6">
      {pendingBookings.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-12 text-center">
          <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">¡Todo aprobado!</h3>
          <p className="text-gray-500">No hay bookings pendientes de aprobación</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {pendingBookings.map((booking: any) => {
            const metadata = typeof booking.raw === 'string' 
              ? JSON.parse(booking.raw) 
              : (booking.metadata || booking.raw || {});
            
            const nights = differenceInDays(
              parseISO(booking.check_out),
              parseISO(booking.check_in)
            );

            return (
              <ModernCard key={booking.id} statusColor="purple">
                <CardHeader
                  title={booking.guest_name}
                  subtitle={booking.guest_email}
                  icon={<User className="h-4 w-4" />}
                  badge={<StatBadge value="Pendiente" variant="warning" />}
                />

                <div className="grid grid-cols-2 gap-3 my-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Check-in</p>
                    <p className="font-semibold text-gray-900">
                      {format(parseISO(booking.check_in), 'dd/MM/yyyy')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Check-out</p>
                    <p className="font-semibold text-gray-900">
                      {format(parseISO(booking.check_out), 'dd/MM/yyyy')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Noches</p>
                    <p className="font-semibold text-gray-900">{nights}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Habitación</p>
                    <p className="font-semibold text-gray-900">{booking.room_type}</p>
                  </div>
                </div>

                {metadata.estimated_credits && (
                  <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 mb-4">
                    <p className="text-sm text-purple-900">
                      <span className="font-semibold">Créditos:</span> {metadata.estimated_credits}
                      {metadata.season_type && (
                        <span className="ml-2 text-xs opacity-75">({metadata.season_type})</span>
                      )}
                    </p>
                  </div>
                )}

                {selectedBooking === booking.id ? (
                  <div className="space-y-3">
                    <textarea
                      placeholder="Razón del rechazo (opcional)"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 text-sm"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedBooking(null);
                          setRejectReason('');
                        }}
                        className="flex-1 px-3 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => rejectMutation.mutate({ bookingId: booking.id, reason: rejectReason })}
                        disabled={rejectMutation.isPending}
                        className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium transition-colors"
                      >
                        Confirmar Rechazo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => approveMutation.mutate(booking.id)}
                      disabled={approveMutation.isPending}
                      className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium transition-colors"
                    >
                      ✓ Aprobar
                    </button>
                    <button
                      onClick={() => setSelectedBooking(booking.id)}
                      disabled={rejectMutation.isPending}
                      className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium transition-colors"
                    >
                      × Rechazar
                    </button>
                  </div>
                )}
              </ModernCard>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderHistoryTab = () => (
    <div className="space-y-6">
      {completedServices.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-12 text-center">
          <HistoryIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">No hay historial de servicios</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {completedServices.map((service: any) => (
            <ModernCard 
              key={service.id} 
              statusColor={service.status === 'completed' ? 'green' : 'gray'}
            >
              <CardHeader
                title={service.service_type}
                subtitle={service.description}
                badge={
                  <StatBadge
                    value={service.status === 'completed' ? 'Completado' : 'Cancelado'}
                    variant={service.status === 'completed' ? 'success' : 'default'}
                  />
                }
              />
              <div className="space-y-2 mt-4 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Bed className="h-4 w-4" />
                  <span>Habitación: {service.Booking?.room_number || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Creado: {new Date(service.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  <span>Actualizado: {new Date(service.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
            </ModernCard>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">{/* Modern Header */}
      <div className="bg-white border-b border-gray-200 mb-6">
        <div className="px-6 py-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Staff Dashboard</h1>
              <p className="text-sm text-gray-500">Gestiona operaciones diarias del hotel</p>
            </div>
          </div>

          {/* Modern Tabs */}
          <ModernTabs
            tabs={[
              { id: 'summary', label: 'Resumen', icon: <LayoutDashboard className="h-4 w-4" /> },
              { id: 'services', label: 'Servicios', count: pendingServices, icon: <ClipboardList className="h-4 w-4" /> },
              { id: 'bookings', label: 'Bookings', count: pendingBookings.length, icon: <CalendarCheck className="h-4 w-4" /> },
              { id: 'history', label: 'Historial', icon: <HistoryIcon className="h-4 w-4" /> }
            ]}
            activeTab={activeTab}
            onChange={(tabId) => setActiveTab(tabId as TabType)}
            variant="default"
          />
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-6 pb-6">
        {activeTab === 'summary' && renderSummaryTab()}
        {activeTab === 'services' && renderServicesTab()}
        {activeTab === 'bookings' && renderBookingsTab()}
        {activeTab === 'history' && renderHistoryTab()}

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'summary' && renderSummaryTab()}
          {activeTab === 'services' && renderServicesTab()}
          {activeTab === 'bookings' && renderBookingsTab()}
          {activeTab === 'history' && renderHistoryTab()}
        </div>
      </div>
    </div>
  );
}
