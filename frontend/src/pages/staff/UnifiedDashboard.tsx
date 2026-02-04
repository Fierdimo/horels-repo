import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircle, Users, Calendar, User, LayoutDashboard,
  Mail, Clock, UserPlus, Ban, Bed, Home, AlertTriangle, Building2
} from 'lucide-react';
import apiClient from '@/api/client';
import toast from 'react-hot-toast';
import { ModernCard, CardHeader, StatBadge } from '@/components/ui/ModernCard';
import { KanbanColumn, KanbanContainer } from '@/components/ui/ModernKanban';
import { ModernTabs } from '@/components/ui/ModernTabs';

type TabType = 'summary' | 'invitations';

export default function UnifiedDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('summary');

  // Fetch invitations
  const { data: invitationsData } = useQuery({
    queryKey: ['staffInvitations'],
    queryFn: async () => {
      const response = await apiClient.get('/staff/invitations/my-invitations');
      return response.data;
    }
  });

  // Fetch dashboard stats
  const { data: statsData } = useQuery({
    queryKey: ['staff-dashboard-stats'],
    queryFn: async () => {
      const { data } = await apiClient.get('/hotel-staff/dashboard/stats');
      return data;
    }
  });

  // V2: Rooms not needed for timeshares
  // const { data: roomsData } = useQuery({
  //   queryKey: ['staff-rooms'],
  //   queryFn: async () => {
  //     const { data } = await apiClient.get('/hotel-staff/rooms');
  //     return data;
  //   }
  // });

  // Fetch pending bookings
  const { data: pendingBookingsData } = useQuery({
    queryKey: ['staff-pending-bookings'],
    queryFn: async () => {
      const { data } = await apiClient.get('/hotel-staff/bookings/pending');
      return data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
  });

  // Calculate stats
  const invitations = Array.isArray(invitationsData?.data?.invitations) 
    ? invitationsData.data.invitations 
    : (Array.isArray(invitationsData?.data) ? invitationsData.data : []);
  const pendingInvitations = invitations.filter((inv: any) => inv.status === 'pending').length;
  const acceptedInvitations = invitations.filter((inv: any) => inv.status === 'accepted').length;
  const cancelledInvitations = invitations.filter((inv: any) => inv.status === 'cancelled').length;
  const expiredInvitations = invitations.filter((inv: any) => inv.status === 'expired').length;
  const totalInvitations = invitations.length;

  // V2: Removed rooms data
  
  // V2 Stats Structure
  const bookingsStats = statsData?.data?.bookings || {};
  const weeksStats = statsData?.data?.weeks || {};
  const propertyStats = statsData?.data?.property || {};
  
  const totalBookings = bookingsStats.total || 0;
  const pendingBookingsCount = bookingsStats.pending || 0;
  const confirmedBookings = bookingsStats.confirmed || 0;
  const checkedInBookings = bookingsStats.checkedIn || 0;
  const checkedOutBookings = bookingsStats.checkedOut || 0;
  
  const availableWeeks = weeksStats.available || 0;
  const bookedWeeks = weeksStats.booked || 0;
  const assignedWeeks = weeksStats.assigned || 0;
  const totalWeeks = weeksStats.total || 0;
  
  const totalUnits = propertyStats.totalUnits || 0;
  const totalOwnerships = propertyStats.totalOwnerships || 0;
  
  // Check if using Mock PMS (V2: Removed roomsData)
  const isUsingMockPMS = statsData?.source === 'mock-pms';
  const mockPMSHotels = statsData?.data?.hotels || [];
  
  // Check if staff has property assigned (V2: Removed roomsData)
  const hasNoProperty = invitationsData?.message?.includes('No property assigned');

  const renderSummaryTab = () => (
    <div className="space-y-6">
      {/* Mock PMS Info Banner */}
      {hasNoProperty && isUsingMockPMS && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-blue-900 mb-1">
                Demo Mode - Mock PMS Data
              </h4>
              <p className="text-sm text-blue-700 mb-3">
                You're viewing demo data from our Mock Property Management System. 
                Contact an administrator to be assigned to a real property.
              </p>
              {mockPMSHotels.length > 0 && (
                <div className="bg-white rounded p-3 text-sm">
                  <p className="font-medium text-blue-900 mb-2">Available Demo Hotels:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {mockPMSHotels.map((hotel: any) => (
                      <div key={hotel.id} className="flex items-center gap-2 text-blue-700">
                        <Building2 className="h-4 w-4" />
                        <span>{hotel.name} ({hotel.city}) - {hotel.totalRooms} rooms</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pending Bookings Widget */}
      {pendingBookingsCount > 0 && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-lg p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="bg-yellow-500 rounded-full p-3">
                <AlertTriangle className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  {pendingBookingsCount} {pendingBookingsCount === 1 ? 'Booking' : 'Bookings'} Pending Approval
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Marketplace bookings awaiting your review and approval
                </p>
                <button
                  onClick={() => navigate('/staff/bookings')}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-2 rounded-lg font-medium transition-colors inline-flex items-center gap-2"
                >
                  <Calendar className="h-4 w-4" />
                  Review Bookings
                </button>
              </div>
            </div>
            <div className="text-right">
              <div className="bg-white rounded-lg px-4 py-2 border border-yellow-300">
                <p className="text-3xl font-bold text-yellow-600">
                  {pendingBookingsCount}
                </p>
                <p className="text-xs text-gray-600 uppercase tracking-wide">
                  Requires Action
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No Property Warning (when not using Mock PMS) */}
      {hasNoProperty && !isUsingMockPMS && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-yellow-600" />
            <div>
              <h4 className="font-medium text-yellow-900">
                {t('staff.dashboard.noPropertyAssigned') || 'No Property Assigned'}
              </h4>
              <p className="text-sm text-yellow-700 mt-1">
                {t('staff.dashboard.contactAdmin') || 'Please contact an administrator to assign you to a property.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards - Similar to StaffInvitationsList */}
      {/* <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 font-medium">
                {t('common.total')}
              </p>
              <p className="text-3xl font-bold text-blue-900 mt-1">
                {totalInvitations}
              </p>
            </div>
            <User className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-700 font-medium">
                {t('staff.invitations.statusPending')}
              </p>
              <p className="text-3xl font-bold text-yellow-900 mt-1">
                {pendingInvitations}
              </p>
            </div>
            <Clock className="h-8 w-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 font-medium">
                {t('staff.invitations.statusAccepted')}
              </p>
              <p className="text-3xl font-bold text-green-900 mt-1">
                {acceptedInvitations}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700 font-medium">
                {t('staff.invitations.other')}
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {cancelledInvitations + expiredInvitations}
              </p>
            </div>
            <Ban className="h-8 w-8 text-gray-600" />
          </div>
        </div>
      </div> */}

      {/* Timeshare Stats - V2 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Bookings Overview</h3>
          <button
            onClick={() => navigate('/staff/bookings')}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            View All →
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-700 font-medium">Pending</p>
                <p className="text-3xl font-bold text-yellow-900 mt-1">
                  {pendingBookingsCount}
                </p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700 font-medium">Confirmed</p>
                <p className="text-3xl font-bold text-blue-900 mt-1">
                  {confirmedBookings}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700 font-medium">Checked In</p>
                <p className="text-3xl font-bold text-green-900 mt-1">
                  {checkedInBookings}
                </p>
              </div>
              <Users className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-700 font-medium">Checked Out</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {checkedOutBookings}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-gray-600" />
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-700 font-medium">Total</p>
                <p className="text-3xl font-bold text-purple-900 mt-1">
                  {totalBookings}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Week Allocations (Inventory) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Week Allocations</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-700 font-medium">Available</p>
                <p className="text-3xl font-bold text-emerald-900 mt-1">
                  {availableWeeks}
                </p>
                <p className="text-xs text-emerald-600 mt-1">Ready to book</p>
              </div>
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            </div>
          </div>

          <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-indigo-700 font-medium">Booked</p>
                <p className="text-3xl font-bold text-indigo-900 mt-1">
                  {bookedWeeks}
                </p>
                <p className="text-xs text-indigo-600 mt-1">Reserved</p>
              </div>
              <Calendar className="h-8 w-8 text-indigo-600" />
            </div>
          </div>

          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-700 font-medium">Assigned</p>
                <p className="text-3xl font-bold text-orange-900 mt-1">
                  {assignedWeeks}
                </p>
                <p className="text-xs text-orange-600 mt-1">With owners</p>
              </div>
              <Users className="h-8 w-8 text-orange-600" />
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-700 font-medium">Total Weeks</p>
                <p className="text-3xl font-bold text-purple-900 mt-1">
                  {totalWeeks}
                </p>
                <p className="text-xs text-purple-600 mt-1">All allocations</p>
              </div>
              <LayoutDashboard className="h-8 w-8 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Property Info */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Property Overview</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700 font-medium">Units</p>
                <p className="text-3xl font-bold text-blue-900 mt-1">
                  {totalUnits}
                </p>
                <p className="text-xs text-blue-600 mt-1">Timeshare categories</p>
              </div>
              <Building2 className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-teal-50 rounded-lg p-4 border border-teal-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-teal-700 font-medium">Ownerships</p>
                <p className="text-3xl font-bold text-teal-900 mt-1">
                  {totalOwnerships}
                </p>
                <p className="text-xs text-teal-600 mt-1">Total owners</p>
              </div>
              <Users className="h-8 w-8 text-teal-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
      {/* Invitations Overview */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-100 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{t('staff.dashboard.invitationsManagement')}</h3>
            <p className="text-sm text-gray-600">{t('staff.dashboard.invitationsDescription')}</p>
          </div>
          <button
            onClick={() => navigate('/staff/invitations')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <UserPlus className="h-4 w-4" />
            {t('staff.dashboard.goToInvitations')}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ModernCard statusColor="blue">
          <div className="text-center py-4">
            <Mail className="h-8 w-8 mx-auto mb-2 text-blue-600" />
            <div className="text-3xl font-bold text-gray-900">{totalInvitations}</div>
            <p className="text-sm text-gray-600 mt-1">{t('staff.dashboard.totalInvitations')}</p>
          </div>
        </ModernCard>

        <ModernCard statusColor="yellow">
          <div className="text-center py-4">
            <Clock className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
            <div className="text-3xl font-bold text-gray-900">{pendingInvitations}</div>
            <p className="text-sm text-gray-600 mt-1">{t('staff.dashboard.pendingInvitations')}</p>
          </div>
        </ModernCard>

        <ModernCard statusColor="green">
          <div className="text-center py-4">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
            <div className="text-3xl font-bold text-gray-900">{acceptedInvitations}</div>
            <p className="text-sm text-gray-600 mt-1">{t('staff.dashboard.acceptedInvitations')}</p>
          </div>
        </ModernCard>
      </div>

      {/* Recent Invitations */}
      {invitations.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('staff.dashboard.recentInvitations')}</h3>
          <div className="space-y-3">
            {invitations.slice(0, 5).map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{inv.name}</p>
                    <p className="text-sm text-gray-500">{inv.email}</p>
                  </div>
                </div>
                <StatBadge
                  value={inv.status}
                  variant={inv.status === 'accepted' ? 'success' : inv.status === 'pending' ? 'warning' : 'default'}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>


      {/* Stats Overview - Kanban Style */}
      {/* <KanbanContainer columns={1}>
        <KanbanColumn
          title={t('staff.dashboard.invitations')}
          total={totalInvitations}
          count={totalInvitations}
          color="blue"
          icon={<Mail className="h-5 w-5" />}
        >
          <ModernCard 
            statusColor={pendingInvitations > 0 ? "blue" : "green"}
            onClick={() => navigate('/staff/invitations')}
            className="cursor-pointer hover:shadow-lg transition-shadow"
          >
            <CardHeader
              title={`${totalInvitations} ${t('staff.dashboard.totalInvitations')}`}
              subtitle={`${pendingInvitations} ${t('staff.dashboard.pending')}`}
              badge={<StatBadge value={pendingInvitations} variant="info" />}
            />
            <div className="space-y-2 mt-4 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">{t('staff.dashboard.pending')}</span>
                <StatBadge value={pendingInvitations} variant="warning" />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">{t('staff.dashboard.accepted')}</span>
                <StatBadge value={acceptedInvitations} variant="success" />
              </div>
            </div>
            <div className="text-sm text-blue-600 mt-4 flex items-center gap-1">
              <UserPlus className="h-4 w-4" />
              {t('staff.dashboard.manageInvitations')}
            </div>
          </ModernCard>
        </KanbanColumn>
      </KanbanContainer> */}
    </div>
  );

//   const renderInvitationsTab = () => (
//     <div className="space-y-6">
//       {/* Invitations Overview */}
//       <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-100 p-6">
//         <div className="flex items-center justify-between">
//           <div>
//             <h3 className="text-lg font-semibold text-gray-900 mb-1">{t('staff.dashboard.invitationsManagement')}</h3>
//             <p className="text-sm text-gray-600">{t('staff.dashboard.invitationsDescription')}</p>
//           </div>
//           <button
//             onClick={() => navigate('/staff/invitations')}
//             className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
//           >
//             <UserPlus className="h-4 w-4" />
//             {t('staff.dashboard.goToInvitations')}
//           </button>
//         </div>
//       </div>

//       {/* Stats Grid */}
//       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
//         <ModernCard statusColor="blue">
//           <div className="text-center py-4">
//             <Mail className="h-8 w-8 mx-auto mb-2 text-blue-600" />
//             <div className="text-3xl font-bold text-gray-900">{totalInvitations}</div>
//             <p className="text-sm text-gray-600 mt-1">{t('staff.dashboard.totalInvitations')}</p>
//           </div>
//         </ModernCard>

//         <ModernCard statusColor="yellow">
//           <div className="text-center py-4">
//             <Clock className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
//             <div className="text-3xl font-bold text-gray-900">{pendingInvitations}</div>
//             <p className="text-sm text-gray-600 mt-1">{t('staff.dashboard.pendingInvitations')}</p>
//           </div>
//         </ModernCard>

//         <ModernCard statusColor="green">
//           <div className="text-center py-4">
//             <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
//             <div className="text-3xl font-bold text-gray-900">{acceptedInvitations}</div>
//             <p className="text-sm text-gray-600 mt-1">{t('staff.dashboard.acceptedInvitations')}</p>
//           </div>
//         </ModernCard>
//       </div>

//       {/* Recent Invitations */}
//       {invitations.length > 0 && (
//         <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
//           <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('staff.dashboard.recentInvitations')}</h3>
//           <div className="space-y-3">
//             {invitations.slice(0, 5).map((inv: any) => (
//               <div key={inv.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
//                 <div className="flex items-center gap-3">
//                   <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
//                     <User className="h-5 w-5 text-blue-600" />
//                   </div>
//                   <div>
//                     <p className="font-medium text-gray-900">{inv.name}</p>
//                     <p className="text-sm text-gray-500">{inv.email}</p>
//                   </div>
//                 </div>
//                 <StatBadge
//                   value={inv.status}
//                   variant={inv.status === 'accepted' ? 'success' : inv.status === 'pending' ? 'warning' : 'default'}
//                 />
//               </div>
//             ))}
//           </div>
//         </div>
//       )}
//     </div>
//   );

  return (
    <div className="min-h-screen bg-gray-50">{/* Modern Header */}
      <div className="bg-white border-b border-gray-200 mb-6">
        <div className="px-6 py-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t('staff.dashboard.title')}</h1>
              <p className="text-sm text-gray-500">{t('staff.dashboard.subtitle')}</p>
            </div>
          </div>

          {/* Modern Tabs */}
          <ModernTabs
            tabs={[
              { id: 'summary', label: t('staff.dashboard.summary'), icon: <LayoutDashboard className="h-4 w-4" /> },
            //   { id: 'invitations', label: t('staff.dashboard.invitations'), count: pendingInvitations, icon: <Mail className="h-4 w-4" /> }
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
      </div>
    </div>
  );
}