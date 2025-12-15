import { useState } from 'react';
import { Users, Settings, Activity, Shield, DollarSign, UserCheck, Plus, Trash2, Check, X, Clock, TrendingUp } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import apiClient from '@/api/client';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'pending' | 'logs' | 'users' | 'settings'>('pending');

  const tabs = [
    { id: 'pending', label: 'Pending Approvals', icon: UserCheck, badge: true },
    { id: 'logs', label: 'Activity Logs', icon: Activity },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'settings', label: 'Platform Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="text-sm text-gray-500">Platform management and monitoring</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`
                    flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm relative
                    ${activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.label}</span>
                  {tab.badge && <PendingBadge />}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'pending' && <PendingApprovalsTab />}
        {activeTab === 'logs' && <ActivityLogsTab />}
        {activeTab === 'users' && <UserManagementTab />}
        {activeTab === 'settings' && <PlatformSettingsTab />}
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
    onSuccess: (data, variables) => {
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
              <p className="text-sm font-medium text-gray-600">Pending Requests</p>
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
          <h2 className="text-lg font-semibold text-gray-900">Staff Approval Requests</h2>
          <p className="text-sm text-gray-600 mt-1">Review and approve staff member registrations</p>
        </div>

        {requests.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <UserCheck className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-gray-900">No pending requests</h3>
            <p className="text-sm text-gray-500 mt-1">All staff registrations have been processed</p>
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
                        Name: {request.firstName} {request.lastName}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1 ml-13">
                      Registered: {new Date(request.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => approveMutation.mutate({ userId: request.id, action: 'approve' })}
                      disabled={approveMutation.isPending}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Check className="h-4 w-4" />
                      <span>Approve</span>
                    </button>
                    <button
                      onClick={() => approveMutation.mutate({ userId: request.id, action: 'reject' })}
                      disabled={approveMutation.isPending}
                      className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <X className="h-4 w-4" />
                      <span>Reject</span>
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
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Activity Logs</h2>
      <p className="text-gray-600">System activity logs and audit trail</p>
      <p className="text-sm text-gray-500 mt-2">Coming soon...</p>
    </div>
  );
}

// User Management Tab - Placeholder
function UserManagementTab() {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">User Management</h2>
      <p className="text-gray-600">Manage all platform users</p>
      <p className="text-sm text-gray-500 mt-2">Coming soon...</p>
    </div>
  );
}

// Platform Settings Tab - Placeholder
function PlatformSettingsTab() {
  return (
    <div className="space-y-6">
      {/* Commission Settings */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center space-x-3 mb-4">
          <DollarSign className="h-6 w-6 text-green-600" />
          <h2 className="text-lg font-semibold text-gray-900">Commission Settings</h2>
        </div>
        <p className="text-gray-600">Configure marketplace commission rates</p>
        <p className="text-sm text-gray-500 mt-2">Coming soon...</p>
      </div>

      {/* Auto-Approval Settings */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center space-x-3 mb-4">
          <UserCheck className="h-6 w-6 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Staff Auto-Approval</h2>
        </div>
        <p className="text-gray-600">Configure staff registration auto-approval rules</p>
        <p className="text-sm text-gray-500 mt-2">Coming soon...</p>
      </div>
    </div>
  );
}
