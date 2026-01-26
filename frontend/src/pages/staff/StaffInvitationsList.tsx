import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Mail, Eye, QrCode, XCircle, Calendar, User as UserIcon, CheckCircle, Clock, Ban, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import apiClient from '@/api/client';

interface Invitation {
  id: number;
  token: string;
  email: string;
  first_name?: string;
  last_name?: string;
  property_id: number;
  rooms_count: number;
  rooms_data: Array<{
    room_id: number;
    start_date: string;
    end_date: string;
    room_type: string;
  }>;
  expires_at: string;
  invitation_link: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  created_at: string;
  property?: {
    id: number;
    name: string;
    location: string;
  };
  createdUser?: {
    id: number;
    email: string;
    first_name?: string;
    last_name?: string;
  };
}

export default function StaffInvitationsList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedInvitation, setSelectedInvitation] = useState<Invitation | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all invitations
  const { data: invitationsData, isLoading } = useQuery({
    queryKey: ['staffInvitations'],
    queryFn: async () => {
      const response = await apiClient.get('/staff/invitations/my-invitations');
      return response.data;
    },
  });

  const invitations: Invitation[] = invitationsData?.data?.invitations || [];
  
  // Filter invitations
  const filteredInvitations = invitations.filter(inv => {
    // Status filter
    if (statusFilter !== 'all' && inv.status !== statusFilter) {
      return false;
    }
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const fullName = `${inv.first_name || ''} ${inv.last_name || ''}`.toLowerCase();
      const email = inv.email.toLowerCase();
      return fullName.includes(query) || email.includes(query);
    }
    
    return true;
  });

  // Count by status
  const pendingCount = invitations.filter(inv => inv.status === 'pending').length;
  const acceptedCount = invitations.filter(inv => inv.status === 'accepted').length;
  const cancelledCount = invitations.filter(inv => inv.status === 'cancelled').length;
  const expiredCount = invitations.filter(inv => inv.status === 'expired').length;

  // Cancel invitation mutation
  const cancelMutation = useMutation({
    mutationFn: async (invitationId: number) => {
      const response = await apiClient.delete(`/staff/invitations/cancel-invitation/${invitationId}`);
      return response.data;
    },
    onSuccess: () => {
      toast.success(t('staff.invitations.invitationCancelled'));
      queryClient.invalidateQueries({ queryKey: ['staffInvitations'] });
      setSelectedInvitation(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || t('staff.invitations.cancelError'));
    },
  });

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async (invitationId: number) => {
      const response = await apiClient.post(`/staff/invitations/${invitationId}/send-email`);
      return response.data;
    },
    onSuccess: () => {
      toast.success(t('staff.invitations.emailSent'));
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || t('staff.invitations.emailError'));
    },
  });

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: {
        icon: <Clock className="h-4 w-4" />,
        text: t('staff.invitations.statusPending'),
        className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      },
      accepted: {
        icon: <CheckCircle className="h-4 w-4" />,
        text: t('staff.invitations.statusAccepted'),
        className: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      },
      cancelled: {
        icon: <Ban className="h-4 w-4" />,
        text: t('staff.invitations.statusCancelled'),
        className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
      },
      expired: {
        icon: <XCircle className="h-4 w-4" />,
        text: t('staff.invitations.statusExpired'),
        className: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      },
    };

    const badge = badges[status as keyof typeof badges] || badges.pending;
    
    return (
      <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${badge.className}`}>
        {badge.icon}
        <span>{badge.text}</span>
      </span>
    );
  };

  // Helper to safely parse rooms_data
  const getRoomsData = (invitation: Invitation): Array<{room_id: number; start_date: string; end_date: string; room_type: string}> => {
    if (!invitation.rooms_data) return [];
    if (Array.isArray(invitation.rooms_data)) return invitation.rooms_data;
    // If it's a string, try to parse it
    if (typeof invitation.rooms_data === 'string') {
      try {
        return JSON.parse(invitation.rooms_data);
      } catch (e) {
        console.error('Failed to parse rooms_data:', e);
        return [];
      }
    }
    return [];
  };

  const InvitationRow = ({ invitation }: { invitation: Invitation }) => {
    const isExpired = new Date(invitation.expires_at) < new Date();
    const roomsData = getRoomsData(invitation);
    
    return (
      <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
        <td className="px-4 py-3">
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              {invitation.first_name && invitation.last_name 
                ? `${invitation.first_name} ${invitation.last_name}`
                : invitation.email
              }
            </p>
            {invitation.first_name && invitation.last_name && (
              <p className="text-xs text-gray-500 dark:text-gray-400">{invitation.email}</p>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          {getStatusBadge(invitation.status)}
        </td>
        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
          {roomsData.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {roomsData.map((room, idx) => (
                <div key={idx} className="text-xs">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {room.room_type} (#{room.room_id})
                  </div>
                  <div className="text-gray-500 dark:text-gray-400">
                    {new Date(room.start_date).toLocaleDateString()} - {new Date(room.end_date).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <span>-</span>
          )}
        </td>
        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
          {new Date(invitation.created_at).toLocaleDateString()}
        </td>
        <td className={`px-4 py-3 text-sm ${isExpired ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
          {new Date(invitation.expires_at).toLocaleDateString()}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center space-x-2">
            {invitation.status === 'pending' && (
              <>
                <button
                  onClick={() => sendEmailMutation.mutate(invitation.id)}
                  disabled={sendEmailMutation.isPending}
                  className="p-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                  title={t('staff.invitations.sendEmail')}
                >
                  <Mail className="h-4 w-4" />
                </button>

                <button
                  onClick={() => setSelectedInvitation(invitation)}
                  className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  title={t('common.view')}
                >
                  <Eye className="h-4 w-4" />
                </button>

                <button
                  onClick={() => cancelMutation.mutate(invitation.id)}
                  disabled={cancelMutation.isPending}
                  className="p-1.5 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                  title={t('staff.invitations.cancel')}
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </>
            )}
            {invitation.status === 'accepted' && (
              <button
                onClick={() => setSelectedInvitation(invitation)}
                className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                title={t('common.view')}
              >
                <Eye className="h-4 w-4" />
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t('staff.invitations.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('staff.invitations.subtitle')}
          </p>
        </div>
        <button
          onClick={() => navigate('/staff/invitations/create')}
          className="flex items-center space-x-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span>{t('staff.invitations.createNew')}</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                {t('common.total')}
              </p>
              <p className="text-3xl font-bold text-blue-900 dark:text-blue-100 mt-1">
                {invitations.length}
              </p>
            </div>
            <UserIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 font-medium">
                {t('staff.invitations.statusPending')}
              </p>
              <p className="text-3xl font-bold text-yellow-900 dark:text-yellow-100 mt-1">
                {pendingCount}
              </p>
            </div>
            <Clock className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                {t('staff.invitations.statusAccepted')}
              </p>
              <p className="text-3xl font-bold text-green-900 dark:text-green-100 mt-1">
                {acceptedCount}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900/20 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                {t('staff.invitations.other')}
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {cancelledCount + expiredCount}
              </p>
            </div>
            <Ban className="h-8 w-8 text-gray-600 dark:text-gray-400" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder={t('common.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {t('common.all')} ({invitations.length})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'pending'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {t('staff.invitations.statusPending')} ({pendingCount})
            </button>
            <button
              onClick={() => setStatusFilter('accepted')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'accepted'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {t('staff.invitations.statusAccepted')} ({acceptedCount})
            </button>
            <button
              onClick={() => setStatusFilter('cancelled')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'cancelled'
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {t('staff.invitations.statusCancelled')} ({cancelledCount})
            </button>
            <button
              onClick={() => setStatusFilter('expired')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'expired'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {t('staff.invitations.statusExpired')} ({expiredCount})
            </button>
          </div>
        </div>
      </div>

      {/* Single Table */}
      {filteredInvitations.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('staff.invitations.name')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('common.status')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('staff.invitations.rooms')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('staff.invitations.created')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('staff.invitations.expires')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredInvitations.map(inv => (
                  <InvitationRow key={inv.id} invitation={inv} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <UserIcon className="h-16 w-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {searchQuery || statusFilter !== 'all' 
              ? t('staff.invitations.noResults')
              : t('staff.invitations.noInvitations')
            }
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {searchQuery || statusFilter !== 'all'
              ? t('staff.invitations.tryDifferentFilters')
              : t('staff.invitations.noInvitationsDescription')
            }
          </p>
          {!searchQuery && statusFilter === 'all' && (
            <button
              onClick={() => navigate('/staff/invitations/create')}
              className="inline-flex items-center space-x-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-5 w-5" />
              <span>{t('staff.invitations.createFirst')}</span>
            </button>
          )}
        </div>
      )}

      {/* Details Modal */}
      {selectedInvitation && (() => {
        const roomsData = getRoomsData(selectedInvitation);
        return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedInvitation(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                {t('staff.invitations.invitationDetails')} {getStatusBadge(selectedInvitation.status)}
              </h3>
              <button
                onClick={() => setSelectedInvitation(null)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">{t('common.email')}</p>
                    <p className="font-medium text-gray-900 dark:text-white">{selectedInvitation.email}</p>
                  </div>
                  {selectedInvitation.first_name && (
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">{t('common.name')}</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {selectedInvitation.first_name} {selectedInvitation.last_name}
                      </p>
                    </div>
                  )}
                  <div className="col-span-2">
                    <p className="text-gray-600 dark:text-gray-400 mb-2">{t('staff.invitations.rooms')}</p>
                    {roomsData.length > 0 ? (
                      <div className="space-y-2">
                        {roomsData.map((room, idx) => (
                          <div key={idx} className="bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white text-sm">
                                  {room.room_type}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {t('staff.invitations.roomId')}: #{room.room_id}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                              <Calendar className="h-3 w-3" />
                              <span>{new Date(room.start_date).toLocaleDateString()}</span>
                              <span>→</span>
                              <span>{new Date(room.end_date).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="font-medium text-gray-900 dark:text-white">-</p>
                    )}
                  </div> 
                </div>
              </div>

              {/* Invitation Link */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('staff.invitations.invitationLink')}
                </label>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mb-2">
                  <a 
                    href={selectedInvitation.invitation_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
                  >
                    {selectedInvitation.invitation_link}
                  </a>
                </div>
              </div>

              {/* QR Code Section */}
                <div className="flex justify-center bg-white dark:bg-gray-700 rounded-lg p-6">
                  <QRCodeSVG 
                    value={selectedInvitation.invitation_link}
                    size={200}
                    level="H"
                    includeMargin={true}
                  />
                </div> 
              {/* Action Buttons */}
              {selectedInvitation.status === 'pending' && (
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      sendEmailMutation.mutate(selectedInvitation.id);
                    }}
                    disabled={sendEmailMutation.isPending}
                    className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Mail className="h-5 w-5" />
                    <span>{sendEmailMutation.isPending ? t('common.sending') : t('staff.invitations.sendEmail')}</span>
                  </button>

                  <button
                    onClick={() => {
                      if (confirm(t('staff.invitations.confirmCancel'))) {
                        cancelMutation.mutate(selectedInvitation.id);
                      }
                    }}
                    disabled={cancelMutation.isPending}
                    className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <XCircle className="h-5 w-5" />
                    <span>{cancelMutation.isPending ? t('staff.invitations.cancelling') : t('staff.invitations.cancelInvitation')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
