import { Clock, UserCheck, Check, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import apiClient from '@/api/client';

export default function PendingApprovals() {
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
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['staff-requests'] });
      toast.success(t('admin.pendingApprovals.requestProcessed', { action: t(`admin.pendingApprovals.${variables.action}d`) }));
    },
    onError: () => {
      toast.error(t('admin.pendingApprovals.failedToProcess'));
    }
  });

  const handleApprove = (request: any) => {
    if (!request.property_id) {
      toast.error('This staff member has no property assigned. Please contact support.');
      return;
    }
    approveMutation.mutate({ 
      userId: request.id, 
      action: 'approve'
    });
  };

  const handleReject = (userId: number) => {
    approveMutation.mutate({ 
      userId, 
      action: 'reject'
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const requests = data?.requests || [];
  const properties = propertiesData?.data || [];

  return (
    <div className="space-y-6">
      {/* Property Selection Modal */}
      {selectedStaff && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Assign Property to {selectedStaff.email}
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Property
              </label>
              <select
                value={selectedProperty}
                onChange={(e) => setSelectedProperty(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Choose a property...</option>
                {properties.map((property: any) => (
                  <option key={property.id} value={property.id}>
                    {property.name} - {property.city}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setSelectedStaff(null);
                  setSelectedProperty('');
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={!selectedProperty || approveMutation.isPending}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('admin.pendingApprovals.title')}</h1>
        <p className="text-gray-600 mt-1">{t('admin.pendingApprovals.subtitle')}</p>
      </div>

      {/* Stats Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{t('admin.pendingApprovals.pendingRequests')}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{requests.length}</p>
          </div>
          <div className="w-14 h-14 bg-yellow-100 rounded-lg flex items-center justify-center">
            <Clock className="h-7 w-7 text-yellow-600" />
          </div>
        </div>
      </div>

      {/* Requests List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{t('admin.pendingApprovals.staffRequests')}</h2>
        </div>

        {requests.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <UserCheck className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-gray-900">{t('admin.pendingApprovals.noPendingRequests')}</h3>
            <p className="text-sm text-gray-500 mt-1">{t('admin.pendingApprovals.allProcessed')}</p>
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
                          <p className="text-sm text-gray-500">
                            {request.Property.name} - {request.Property.city}, {request.Property.country}
                          </p>
                        )}
                      </div>
                    </div>
                    {request.firstName && request.lastName && (
                      <p className="text-sm text-gray-600 mt-2 ml-13">
                        {t('admin.users.name')}: {request.firstName} {request.lastName}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1 ml-13">
                      {t('admin.pendingApprovals.registeredOn')}: {new Date(request.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleApproveClick(request)}
                      disabled={approveMutation.isPending}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      <Check className="h-4 w-4" />
                      <span>{t('admin.pendingApprovals.approve')}</span>
                    </button>
                    <button
                      onClick={() => approveMutation.mutate({ userId: request.id, action: 'reject' })}
                      disabled={approveMutation.isPending}
                      className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <X className="h-4 w-4" />
                      <span>{t('admin.pendingApprovals.reject')}</span>
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
