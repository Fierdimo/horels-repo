import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Mail, Eye, QrCode, Calendar, User as UserIcon, CheckCircle, Clock, Building2, Search, Link2, Copy, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import apiClient from '@/api/client';

interface Ownership {
  id: number;
  owner_id: number;
  unit_id: number;
  type: string;
  fixed_week_number: number;
  contract_reference: string;
  contract_start_year: number;
  status: string; // 'ACTIVE' | 'CONVERTED_TO_CREDITS' | 'CANCELLED'
  created_at: string;
  owner: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
  };
  unit: {
    id: number;
    category: string;
    bedrooms: number;
    bathrooms: number;
    base_credit_value: number;
  };
  weekAllocations?: Array<{
    id: number;
    week_number: number;
    year: number;
    start_date: string;
    end_date: string;
    status: string;
  }>;
}

interface InvitationData {
  invitationLink: string;
  invitationToken: string;
  owner: {
    email: string;
    name: string;
  };
  ownership: {
    id: number;
    unit: string;
    property: string;
  };
}

export default function StaffInvitationsList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedOwnership, setSelectedOwnership] = useState<Ownership | null>(null);
  const [showInvitationModal, setShowInvitationModal] = useState(false);
  const [invitationData, setInvitationData] = useState<InvitationData | null>(null);
  const [isGeneratingInvitation, setIsGeneratingInvitation] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'IN_USE' | 'USED' | 'CONVERTED_TO_CREDITS' | 'CANCELLED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Fetch ownerships with server-side pagination and filtering
  const { data: ownershipsData, isLoading, refetch } = useQuery({
    queryKey: ['staffOwnerships', currentPage, itemsPerPage, statusFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      });
      
      if (statusFilter && statusFilter !== 'ALL') {
        params.append('status', statusFilter);
      }
      
      if (searchQuery) {
        params.append('search', searchQuery);
      }
      
      const response = await apiClient.get(`/hotel-staff/ownerships?${params.toString()}`);
      console.log('API Response:', response.data);
      return response.data;
    },
    staleTime: 0, // Always consider data stale, refetch immediately
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchOnMount: true, // Always refetch when component mounts
  });

  const ownerships: Ownership[] = (ownershipsData as any)?.data || [];
  const totalCount: number = (ownershipsData as any)?.pagination?.total || 0;
  const totalPages: number = (ownershipsData as any)?.pagination?.totalPages || 1;
  const currentPageFromServer: number = (ownershipsData as any)?.pagination?.page || 1;

  // Helper function to determine display status based on dates and ownership status
  const getDisplayStatus = (ownership: Ownership): string => {
    // Priorizar ownership.status si es CANCELLED o CONVERTED_TO_CREDITS
    if (ownership.status === 'CANCELLED') return 'CANCELLED';
    if (ownership.status === 'CONVERTED_TO_CREDITS') return 'CONVERTED_TO_CREDITS';
    
    // Revisar week allocations para determinar estado basado en fechas
    const currentWeek = ownership.weekAllocations?.[0];
    if (currentWeek) {
      const now = new Date();
      const startDate = new Date(currentWeek.start_date);
      const endDate = new Date(currentWeek.end_date);
      
      // Si la week allocation fue convertida a créditos
      if (currentWeek.status === 'RELEASED') return 'CONVERTED_TO_CREDITS';
      
      // Si estamos dentro del período de la semana
      if (now >= startDate && now <= endDate) return 'IN_USE';
      
      // Si ya pasó el período de la semana
      if (now > endDate) return 'USED';
      
      // Si es futuro y está asignada
      if (currentWeek.status === 'ASSIGNED') return 'ACTIVE';
    }
    
    // Fallback al status del ownership
    return ownership.status;
  };

  // Generate invitation for ownership
  const handleGenerateInvitation = async (ownership: Ownership) => {
    setSelectedOwnership(ownership);
    setShowInvitationModal(true);
    setIsGeneratingInvitation(true);
    
    try {
      const response = await apiClient.post(
        `/hotel-staff/ownerships/${ownership.id}/generate-invitation`
      );
      
      setInvitationData(response.data.data);
      setIsGeneratingInvitation(false);
      // Refetch the list to show updated data
      refetch();
    } catch (error: any) {
      console.error('Error generating invitation:', error);
      toast.error(error.response?.data?.message || 'Error generando la invitación');
      setShowInvitationModal(false);
      setIsGeneratingInvitation(false);
    }
  };

  // Send invitation email
  const handleSendEmail = async () => {
    if (!selectedOwnership) return;
    
    setIsSendingEmail(true);
    try {
      await apiClient.post(
        `/hotel-staff/ownerships/${selectedOwnership.id}/send-invitation-email`
      );
      
      toast.success('Email de invitación enviado exitosamente');
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast.error(error.response?.data?.message || 'Error enviando el email');
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Copy link to clipboard
  const handleCopyLink = () => {
    if (invitationData?.invitationLink) {
      navigator.clipboard.writeText(invitationData.invitationLink);
      toast.success('Link copiado al portapapeles');
    }
  };

  // Download QR code
  const handleDownloadQR = () => {
    const svg = document.getElementById('invitation-qr-code');
    if (svg) {
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        const pngFile = canvas.toDataURL('image/png');
        
        const downloadLink = document.createElement('a');
        downloadLink.download = `invitation-qr-${selectedOwnership?.id}.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
      };
      
      img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
    }
  };

  // Cancel ownership
  const cancelOwnershipMutation = useMutation({
    mutationFn: async (ownershipId: number) => {
      const response = await apiClient.patch(`/hotel-staff/ownerships/${ownershipId}/cancel`);
      return response.data;
    },
    onSuccess: () => {
      toast.success(t('staff.ownerships.ownershipCancelled'));
      queryClient.invalidateQueries({ queryKey: ['staffOwnerships'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('staff.ownerships.errorCancelling'));
    },
  });

  const handleCancelOwnership = (ownership: Ownership) => {
    if (confirm(t('staff.ownerships.confirmCancelOwnership', { owner: `${ownership.owner.first_name} ${ownership.owner.last_name}` }))) {
      cancelOwnershipMutation.mutate(ownership.id);
    }
  };

  // Count by status from backend
  const statusCounts = (ownershipsData as any)?.statusCounts || {};
  const activeCount = statusCounts.ACTIVE || 0;
  const inUseCount = statusCounts.IN_USE || 0;
  const usedCount = statusCounts.USED || 0;
  const convertedCount = statusCounts.CONVERTED_TO_CREDITS || 0;
  const cancelledCount = statusCounts.CANCELLED || 0;
  const totalOwnerships = statusCounts.TOTAL || 0;

  // Pagination info from backend
  const startIndex = (currentPageFromServer - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + ownerships.length, totalCount);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery, itemsPerPage]);

  const getStatusBadge = (status: string) => {
    if (status === 'ACTIVE') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
          <CheckCircle className="h-4 w-4" />
          <span>{t('staff.ownerships.activeStatus')}</span>
        </span>
      );
    } else if (status === 'IN_USE') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
          <Calendar className="h-4 w-4" />
          <span>{t('staff.ownerships.inUseStatusBadge')}</span>
        </span>
      );
    } else if (status === 'USED') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-900/20 dark:text-slate-400">
          <CheckCircle className="h-4 w-4" />
          <span>{t('staff.ownerships.usedStatusBadge')}</span>
        </span>
      );
    } else if (status === 'CONVERTED_TO_CREDITS') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
          <Clock className="h-4 w-4" />
          <span>{t('staff.ownerships.convertedToCreditsBadge')}</span>
        </span>
      );
    } else if (status === 'CANCELLED') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
          <Clock className="h-4 w-4" />
          <span>{t('staff.ownerships.cancelledStatusBadge')}</span>
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400">
          <Clock className="h-4 w-4" />
          <span>{t('staff.ownerships.inactiveStatus')}</span>
        </span>
      );
    }
  };

  const OwnershipRow = ({ ownership }: { ownership: Ownership }) => {
    // Get the most recent week allocation
    const currentWeek = ownership.weekAllocations && ownership.weekAllocations.length > 0 
      ? ownership.weekAllocations[0] 
      : null;

    // Check if can cancel:
    // - Week must be ASSIGNED (not converted/released)
    // - Ownership not already CANCELLED
    // - Either start date is in future OR ownership was just created (less than 1 hour ago)
    const isRecentlyCreated = new Date().getTime() - new Date(ownership.created_at).getTime() < 3600000; // 1 hour
    const canCancel = currentWeek && 
      currentWeek.status === 'ASSIGNED' && 
      ownership.status !== 'CANCELLED' &&
      (new Date(currentWeek.start_date) > new Date() || isRecentlyCreated);

    // Check if can invite:
    // - Display status must be ACTIVE (not converted, cancelled, in use, or used)
    const displayStatus = getDisplayStatus(ownership);
    const canInvite = displayStatus === 'ACTIVE';

    return (
      <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
        <td className="px-4 py-3">
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              {ownership.owner.first_name} {ownership.owner.last_name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{ownership.owner.email}</p>
          </div>
        </td>
        <td className="px-4 py-3">
          <p className="font-medium text-gray-900 dark:text-white">{ownership.unit.category}</p>
        </td>
        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
          {currentWeek ? (
            <div className="flex flex-col space-y-1">
              <div className="flex items-center space-x-1">
                <Calendar className="h-3 w-3" />
                <span className="text-xs">Inicio:</span>
                <span className="font-medium">{new Date(currentWeek.start_date).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Calendar className="h-3 w-3" />
                <span className="text-xs">Fin:</span>
                <span className="font-medium">{new Date(currentWeek.end_date).toLocaleDateString()}</span>
              </div>
            </div>
          ) : (
            <span className="text-gray-400">Sin fechas asignadas</span>
          )}
        </td>
        <td className="px-4 py-3">
          {getStatusBadge(getDisplayStatus(ownership))}
        </td>
        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
          {new Date(ownership.created_at).toLocaleDateString()}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center space-x-2">
            {canInvite && (
              <button
                onClick={() => handleGenerateInvitation(ownership)}
                className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                title="Generar invitación"
              >
                <Mail className="h-4 w-4" />
              </button>
            )}
            {canCancel && (
              <button
                onClick={() => handleCancelOwnership(ownership)}
                disabled={cancelOwnershipMutation.isPending}
                className="p-1.5 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                title="Cancelar timeshare"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {!canInvite && !canCancel && (
              <span className="text-xs text-gray-400">Sin acciones</span>
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
            {t('staff.ownerships.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('staff.ownerships.subtitle')}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/staff/ownerships/register')}
            className="flex items-center space-x-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>{t('staff.ownerships.registerTimeshare')}</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                {t('staff.ownerships.totalRegistered')}
              </p>
              <p className="text-3xl font-bold text-blue-900 dark:text-blue-100 mt-1">
                {totalOwnerships}
              </p>
            </div>
            <Building2 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                {t('staff.ownerships.inUse')}
              </p>
              <p className="text-3xl font-bold text-amber-900 dark:text-amber-100 mt-1">
                {inUseCount}
              </p>
            </div>
            <Calendar className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/20 rounded-lg p-4 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                {t('staff.ownerships.used')}
              </p>
              <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {usedCount}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-slate-600 dark:text-slate-400" />
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                {t('staff.ownerships.active')}
              </p>
              <p className="text-3xl font-bold text-green-900 dark:text-green-100 mt-1">
                {activeCount}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-700 dark:text-purple-300 font-medium">
                {t('staff.ownerships.converted')}
              </p>
              <p className="text-3xl font-bold text-purple-900 dark:text-purple-100 mt-1">
                {convertedCount}
              </p>
            </div>
            <Clock className="h-8 w-8 text-purple-600 dark:text-purple-400" />
          </div>
        </div>

        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                {t('staff.ownerships.cancelled')}
              </p>
              <p className="text-3xl font-bold text-red-900 dark:text-red-100 mt-1">
                {cancelledCount}
              </p>
            </div>
            <Clock className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder={t('staff.ownerships.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'ALL'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {t('staff.ownerships.all')} ({totalOwnerships})
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'ACTIVE'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {t('staff.ownerships.actives')} ({activeCount})
            </button>
            <button
              onClick={() => setStatusFilter('IN_USE')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'IN_USE'
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {t('staff.ownerships.inUseStatus')} ({inUseCount})
            </button>
            <button
              onClick={() => setStatusFilter('USED')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'USED'
                  ? 'bg-slate-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {t('staff.ownerships.usedStatus')} ({usedCount})
            </button>
            <button
              onClick={() => setStatusFilter('CONVERTED_TO_CREDITS')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'CONVERTED_TO_CREDITS'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {t('staff.ownerships.convertedToCredits')} ({convertedCount})
            </button>
            <button
              onClick={() => setStatusFilter('CANCELLED')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'CANCELLED'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {t('staff.ownerships.cancelledStatus')} ({cancelledCount})
            </button>
          </div>
          </div>

          {/* Pagination Info and Controls */}
          {totalCount > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {t('staff.ownerships.showing')} {startIndex + 1}-{endIndex} {t('staff.ownerships.of')} {totalCount}
                </span>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 dark:text-gray-400">
                    {t('staff.ownerships.itemsPerPage')}
                  </label>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              {/* Pagination Buttons */}
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    {t('staff.ownerships.first')}
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    {t('staff.ownerships.previous')}
                  </button>
                  
                  {/* Page Numbers */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1 rounded-lg text-sm font-medium ${
                            currentPage === pageNum
                              ? 'bg-primary text-white'
                              : 'border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    {t('staff.ownerships.next')}
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    {t('staff.ownerships.last')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      {ownerships.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('staff.ownerships.owner')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('staff.ownerships.unit')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('staff.ownerships.period')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('staff.ownerships.status')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('staff.ownerships.registered')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('staff.ownerships.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {ownerships.map(ownership => (
                  <OwnershipRow key={ownership.id} ownership={ownership} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <Building2 className="h-16 w-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {searchQuery || statusFilter !== 'ALL' 
              ? t('staff.ownerships.noRecordsFound')
              : t('staff.ownerships.noRecordsFound')
            }
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {searchQuery || statusFilter !== 'ALL'
              ? t('staff.ownerships.tryAdjustingFilters')
              : t('staff.ownerships.tryAdjustingFilters')
            }
          </p>
          {!searchQuery && statusFilter === 'ALL' && (
            <button
              onClick={() => navigate('/staff/ownerships/register')}
              className="inline-flex items-center space-x-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-5 w-5" />
              <span>{t('staff.ownerships.registerFirst')}</span>
            </button>
          )}
        </div>
      )}

      {/* Invitation Modal */}
      {showInvitationModal && selectedOwnership && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setShowInvitationModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                {t('staff.ownerships.invitationFor')} {selectedOwnership.owner.first_name} {selectedOwnership.owner.last_name}
              </h3>
              <button
                onClick={() => setShowInvitationModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <Copy className="h-6 w-6" />
              </button>
            </div>

            {isGeneratingInvitation ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">{t('staff.ownerships.generatingInvitation')}</p>
              </div>
            ) : invitationData ? (
              <div className="space-y-6">
                {/* Send Email Button */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                  <button
                    onClick={handleSendEmail}
                    disabled={isSendingEmail}
                    className="w-full flex items-center justify-center space-x-3 px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-lg"
                  >
                    <Mail className="h-6 w-6" />
                    <span>{isSendingEmail ? t('staff.ownerships.sending') : t('staff.ownerships.sendInvitationEmail')}</span>
                  </button>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 text-center">
                    {t('staff.ownerships.emailDescription')}
                  </p>
                </div>

                {/* Link Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center space-x-2">
                    <Link2 className="h-4 w-4" />
                    <span>{t('staff.ownerships.invitationLink')}</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={invitationData.invitationLink}
                      readOnly
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2"
                    >
                      <Copy className="h-4 w-4" />
                      <span>{t('staff.ownerships.copy')}</span>
                    </button>
                  </div>
                </div>

                {/* QR Code Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center space-x-2">
                    <QrCode className="h-4 w-4" />
                    <span>{t('staff.ownerships.qrCode')}</span>
                  </label>
                  <div className="bg-white dark:bg-gray-700 rounded-lg p-6 flex flex-col items-center space-y-4">
                    <QRCodeSVG 
                      id="invitation-qr-code"
                      value={invitationData.invitationLink}
                      size={200}
                      level="H"
                      includeMargin={true}
                    />
                    <button
                      onClick={handleDownloadQR}
                      className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      <QrCode className="h-4 w-4" />
                      <span>{t('staff.ownerships.downloadQR')}</span>
                    </button>
                  </div>
                </div>

                {/* Instructions */}
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 text-sm text-gray-600 dark:text-gray-400">
                  <p className="font-medium text-gray-900 dark:text-white mb-2">{t('staff.ownerships.instructions')}</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>{t('staff.ownerships.instruction1')}</li>
                    <li>{t('staff.ownerships.instruction2')}</li>
                    <li>{t('staff.ownerships.instruction3')}</li>
                  </ul>
                </div>

                {/* Close Button */}
                <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 pt-4 -mx-6 px-6 -mb-6 pb-6">
                  <button
                    onClick={() => setShowInvitationModal(false)}
                    className="w-full px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
                  >
                    {t('staff.ownerships.close')}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
