import { Users, Activity, Shield, UserCheck, Clock, TrendingUp, ArrowRight, DollarSign, Check, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import apiClient from '@/api/client';
import  toast  from 'react-hot-toast';

export default function AdminDashboard() {
  const { t } = useTranslation();

  // Fetch pending staff requests
  const { data: pendingRequests } = useQuery({
    queryKey: ['staff-requests'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/staff-requests');
      return data;
    }
  });

  // Fetch users statistics
  const { data: usersData } = useQuery({
    queryKey: ['admin-users-stats'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/users');
      return data;
    }
  });

  // Fetch properties statistics
  const { data: propertiesData } = useQuery({
    queryKey: ['properties-stats'],
    queryFn: async () => {
      const { data } = await apiClient.get('/properties');
      return data;
    }
  });

  // Fetch rooms statistics
  const { data: roomsData } = useQuery({
    queryKey: ['rooms-stats'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/rooms');
      return data;
    }
  });

  const pendingCount = pendingRequests?.requests?.length || 0;
  
  // Calculate statistics
  const totalUsers = Array.isArray(usersData?.users) ? usersData.users.length : (Array.isArray(usersData) ? usersData.length : 0);
  const activeProperties = Array.isArray(propertiesData?.data) ? propertiesData.data.length : (Array.isArray(propertiesData) ? propertiesData.length : 0);
  const totalRooms = Array.isArray(roomsData?.data) ? roomsData.data.length : (Array.isArray(roomsData) ? roomsData.length : 0);

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center space-x-3 mb-2">
          <Shield className="h-8 w-8" />
          <h1 className="text-2xl font-bold">{t('admin.dashboard.title')}</h1>
        </div>
        <p className="text-purple-100">{t('admin.dashboard.subtitle')}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Pending Approvals */}
        <Link
          to="/admin/pending-approvals"
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            {pendingCount > 0 && (
              <span className="px-3 py-1 bg-red-100 text-red-600 text-sm font-semibold rounded-full">
                {pendingCount}
              </span>
            )}
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{t('admin.dashboard.pendingApprovals')}</h3>
          <p className="text-sm text-gray-600 mb-3">
            {pendingCount === 0 ? t('admin.dashboard.noPendingRequests') : `${pendingCount} ${t('admin.dashboard.staffWaiting')}`}
          </p>
          <div className="flex items-center text-blue-600 text-sm font-medium">
            <span>{t('admin.dashboard.reviewNow')}</span>
            <ArrowRight className="h-4 w-4 ml-1" />
          </div>
        </Link>

        {/* Users */}
        <Link
          to="/admin/users"
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{t('admin.dashboard.userManagement')}</h3>
          <p className="text-sm text-gray-600 mb-3">{t('admin.dashboard.managePlatformUsers')}</p>
          <div className="flex items-center text-blue-600 text-sm font-medium">
            <span>{t('admin.dashboard.manageUsers')}</span>
            <ArrowRight className="h-4 w-4 ml-1" />
          </div>
        </Link>

        {/* Activity Logs */}
        <Link
          to="/admin/logs"
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Activity className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{t('admin.dashboard.activityLogs')}</h3>
          <p className="text-sm text-gray-600 mb-3">{t('admin.dashboard.systemAuditTrail')}</p>
          <div className="flex items-center text-blue-600 text-sm font-medium">
            <span>{t('admin.dashboard.viewLogs')}</span>
            <ArrowRight className="h-4 w-4 ml-1" />
          </div>
        </Link>

        {/* Settings */}
        <Link
          to="/admin/settings"
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Shield className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{t('admin.dashboard.settings')}</h3>
          <p className="text-sm text-gray-600 mb-3">{t('admin.dashboard.platformSettings')}</p>
          <div className="flex items-center text-blue-600 text-sm font-medium">
            <span>{t('admin.dashboard.viewSettings')}</span>
            <ArrowRight className="h-4 w-4 ml-1" />
          </div>
        </Link>

        {/* Rooms */}
        <Link
          to="/admin/rooms"
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-indigo-600" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{t('admin.dashboard.rooms')}</h3>
          <p className="text-sm text-gray-600 mb-3">{t('admin.dashboard.roomManagement')}</p>
          <div className="flex items-center text-blue-600 text-sm font-medium">
            <span>{t('admin.dashboard.manageRooms')}</span>
            <ArrowRight className="h-4 w-4 ml-1" />
          </div>
        </Link>
      </div>

      {/* Quick Actions */}
      {pendingCount > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-lg">
          <div className="flex items-start">
            <UserCheck className="h-6 w-6 text-yellow-600 mt-0.5" />
            <div className="ml-4 flex-1">
              <h3 className="text-lg font-semibold text-yellow-800">{t('admin.dashboard.actionRequired')}</h3>
              <p className="text-sm text-yellow-700 mt-1">
                {t('admin.dashboard.staffWaitingApproval', { count: pendingCount })}
              </p>
              <Link
                to="/admin/pending-approvals"
                className="inline-flex items-center mt-3 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
              >
                <span>{t('admin.dashboard.reviewNow')}</span>
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity Preview */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{t('admin.dashboard.platformOverview')}</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-600 mb-1">{t('admin.dashboard.totalUsers')}</p>
              <p className="text-2xl font-bold text-gray-900">{totalUsers}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">{t('admin.dashboard.activeProperties')}</p>
              <p className="text-2xl font-bold text-gray-900">{activeProperties}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">{t('admin.dashboard.totalRooms')}</p>
              <p className="text-2xl font-bold text-gray-900">{totalRooms}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Badge component for pending approvals
function PendingBadge() {
  const { data } = useQuery({
    queryKey: ['staff-requests'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/staff-requests');
      return data;
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const count = data?.requests?.length || 0;
  
  if (count === 0) return null;

  return (
    <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-red-500 text-white rounded-full">
      {count}
    </span>
  );
}

// Pending Approvals Tab
function PendingApprovalsTab() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  
  const { data, isLoading } = useQuery({
    queryKey: ['staff-requests'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/staff-requests');
      return data;
    }
  });

  const approveMutation = useMutation({
    mutationFn: async ({ userId, action }: { userId: number; action: 'approve' | 'reject' }) => {
      const { data } = await apiClient.post(`/admin/staff-requests/${userId}`, { action });
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['staff-requests'] });
      toast.success(`Staff request ${variables.action}d successfully`);
    },
    onError: () => {
      toast.error('Failed to process staff request');
    }
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const requests = data?.requests || [];

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('admin.dashboard.pendingRequests')}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{requests.length}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Requests List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{t('admin.dashboard.staffApprovalRequests')}</h2>
          <p className="text-sm text-gray-600 mt-1">{t('admin.dashboard.reviewApproveStaff')}</p>
        </div>

        {requests.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <UserCheck className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-gray-900">{t('admin.dashboard.noPendingRequests')}</h3>
            <p className="text-sm text-gray-500 mt-1">{t('admin.dashboard.allStaffProcessed')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {requests.map((request: any) => (
              <div key={request.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-semibold text-sm">
                          {request.email.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{request.email}</p>
                        {request.Property && (
                          <p className="text-sm text-gray-500">{request.Property.name} - {request.Property.location}</p>
                        )}
                      </div>
                    </div>
                    {request.firstName && request.lastName && (
                      <p className="text-sm text-gray-600 mt-2 ml-13">
                        {t('common.name')}: {request.firstName} {request.lastName}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1 ml-13">
                      {t('common.registered')}: {new Date(request.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => approveMutation.mutate({ userId: request.id, action: 'approve' })}
                      disabled={approveMutation.isPending}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Check className="h-4 w-4" />
                      <span>{t('admin.dashboard.approve')}</span>
                    </button>
                    <button
                      onClick={() => approveMutation.mutate({ userId: request.id, action: 'reject' })}
                      disabled={approveMutation.isPending}
                      className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <X className="h-4 w-4" />
                      <span>{t('admin.dashboard.reject')}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Activity Logs Tab - Placeholder
function ActivityLogsTab() {
  const { t } = useTranslation();
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('admin.dashboard.activityLogs')}</h2>
      <p className="text-gray-600">{t('admin.dashboard.systemAuditTrail')}</p>
      <p className="text-sm text-gray-500 mt-2">{t('admin.dashboard.comingSoon')}</p>
    </div>
  );
}

// User Management Tab - Placeholder
function UserManagementTab() {
  const { t } = useTranslation();
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('admin.dashboard.userManagement')}</h2>
      <p className="text-gray-600">{t('admin.dashboard.managePlatformUsers')}</p>
      <p className="text-sm text-gray-500 mt-2">{t('admin.dashboard.comingSoon')}</p>
    </div>
  );
}

// Platform Settings Tab - Placeholder
function PlatformSettingsTab() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      {/* Commission Settings */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center space-x-3 mb-4">
          <DollarSign className="h-6 w-6 text-green-600" />
          <h2 className="text-lg font-semibold text-gray-900">{t('admin.dashboard.commissionSettings')}</h2>
        </div>
        <p className="text-gray-600">{t('admin.dashboard.configureCommission')}</p>
        <p className="text-sm text-gray-500 mt-2">{t('admin.dashboard.comingSoon')}</p>
      </div>

      {/* Auto-Approval Settings */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center space-x-3 mb-4">
          <UserCheck className="h-6 w-6 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">{t('admin.dashboard.staffAutoApproval')}</h2>
        </div>
        <p className="text-gray-600">{t('admin.dashboard.configureAutoApproval')}</p>
        <p className="text-sm text-gray-500 mt-2">{t('admin.dashboard.comingSoon')}</p>
      </div>
    </div>
  );
}
