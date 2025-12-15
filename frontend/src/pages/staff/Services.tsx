import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Clock, CheckCircle, XCircle, Filter, Search } from 'lucide-react';
import apiClient from '@/api/client';
import toast from 'react-hot-toast';

export default function StaffServices() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch services
  const { data: servicesData, isLoading } = useQuery({
    queryKey: ['staff-services', statusFilter],
    queryFn: async () => {
      const url = statusFilter === 'all' 
        ? '/hotel-staff/services' 
        : `/hotel-staff/services?status=${statusFilter}`;
      const { data } = await apiClient.get(url);
      return data;
    }
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

  const services = Array.isArray(servicesData?.services) ? servicesData.services : [];

  // Filter services
  const filteredServices = services.filter((service: any) => {
    const matchesSearch = 
      (service.service_type || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (service.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (service.Booking?.room_number || '').toString().includes(searchQuery);

    return matchesSearch;
  });

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('staff.services.title')}</h1>
        <p className="text-gray-600 mt-1">{t('staff.services.manageRequests')}</p>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder={t('common.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
            >
              <option value="all">{t('common.allStatuses')}</option>
              <option value="pending">{t('staff.services.pending')}</option>
              <option value="confirmed">{t('staff.services.confirmed')}</option>
              <option value="completed">{t('staff.services.completed')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Services Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-20 bg-gray-200 rounded"></div>
              <div className="h-20 bg-gray-200 rounded"></div>
              <div className="h-20 bg-gray-200 rounded"></div>
            </div>
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-gray-900">{t('staff.services.noServices')}</h3>
            <p className="text-sm text-gray-500 mt-1">{t('staff.services.allProcessed')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('staff.services.serviceType')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('common.description')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('staff.services.room')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('common.status')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredServices.map((service: any) => (
                  <tr key={service.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {service.service_type || service.serviceType}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{service.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {service.Booking?.room_number || service.Booking?.roomNumber || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(service.status)}`}>
                        {t(`staff.services.${service.status}`)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex space-x-2">
                        {service.status === 'pending' && (
                          <>
                            <button
                              onClick={() => updateServiceMutation.mutate({ serviceId: service.id, status: 'confirmed' })}
                              disabled={updateServiceMutation.isPending}
                              className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                              title={t('staff.services.confirm')}
                            >
                              <CheckCircle className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => updateServiceMutation.mutate({ serviceId: service.id, status: 'cancelled' })}
                              disabled={updateServiceMutation.isPending}
                              className="text-red-600 hover:text-red-900 disabled:opacity-50"
                              title={t('common.cancel')}
                            >
                              <XCircle className="h-5 w-5" />
                            </button>
                          </>
                        )}
                        {service.status === 'confirmed' && (
                          <button
                            onClick={() => updateServiceMutation.mutate({ serviceId: service.id, status: 'completed' })}
                            disabled={updateServiceMutation.isPending}
                            className="text-green-600 hover:text-green-900 disabled:opacity-50"
                            title={t('staff.services.complete')}
                          >
                            <CheckCircle className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">{t('common.total')}</div>
          <div className="text-2xl font-bold text-gray-900">{services.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">{t('staff.services.pending')}</div>
          <div className="text-2xl font-bold text-yellow-600">
            {services.filter((s: any) => s.status === 'pending').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">{t('staff.services.confirmed')}</div>
          <div className="text-2xl font-bold text-blue-600">
            {services.filter((s: any) => s.status === 'confirmed').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">{t('staff.services.completed')}</div>
          <div className="text-2xl font-bold text-green-600">
            {services.filter((s: any) => s.status === 'completed').length}
          </div>
        </div>
      </div>
    </div>
  );
}
