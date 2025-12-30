import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, User as UserIcon, Home, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import apiClient from '@/api/client';

interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  Role?: {
    name: string;
  };
}

interface Property {
  id: number;
  name: string;
  location: string;
}

export default function AssignPeriod() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [accommodationType, setAccommodationType] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch users (guests and owners)
  const { data: usersData } = useQuery({
    queryKey: ['adminUsers', 'guest', 'owner'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/users');
      return data;
    }
  });

  // Fetch properties
  const { data: propertiesData } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const { data } = await apiClient.get('/public/properties');
      return data;
    }
  });

  // Assign period mutation
  const assignMutation = useMutation({
    mutationFn: async (data: {
      owner_id: number;
      property_id: number;
      start_date: string;
      end_date: string;
      accommodation_type: string;
    }) => {
      const response = await apiClient.post('/admin/assign-period', data);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || t('admin.assignPeriod.success'));
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      // Reset form
      setSelectedUserId(null);
      setSelectedPropertyId(null);
      setStartDate('');
      setEndDate('');
      setAccommodationType('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('admin.assignPeriod.error'));
    }
  });

  const users: User[] = usersData?.users || [];
  const properties: Property[] = propertiesData?.data || [];

  // Filter users by search term
  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedUser = users.find(u => u.id === selectedUserId);
  const selectedProperty = properties.find(p => p.id === selectedPropertyId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUserId || !selectedPropertyId || !startDate || !endDate || !accommodationType) {
      toast.error(t('admin.assignPeriod.fillAllFields'));
      return;
    }

    assignMutation.mutate({
      owner_id: selectedUserId,
      property_id: selectedPropertyId,
      start_date: startDate,
      end_date: endDate,
      accommodation_type: accommodationType
    });
  };

  // Calculate nights
  const calculateNights = () => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = end.getTime() - start.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const nights = calculateNights();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Calendar className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {t('admin.assignPeriod.title')}
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                {t('admin.assignPeriod.subtitle')}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Info Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-blue-900 mb-1">
                {t('admin.assignPeriod.autoConversion')}
              </h3>
              <p className="text-sm text-blue-800">
                {t('admin.assignPeriod.autoConversionDesc')}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
          {/* Select User */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center gap-2 mb-2">
                <UserIcon className="h-4 w-4" />
                {t('admin.assignPeriod.selectUser')}
              </div>
            </label>
            
            {/* Search Input */}
            <input
              type="text"
              placeholder={t('admin.assignPeriod.searchUser')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent mb-3"
            />

            {/* User List */}
            <div className="border border-gray-300 rounded-lg max-h-60 overflow-y-auto">
              {filteredUsers.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  {t('admin.assignPeriod.noUsersFound')}
                </div>
              ) : (
                filteredUsers.map(user => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setSelectedUserId(user.id)}
                    className={`w-full p-3 text-left hover:bg-gray-50 transition border-b border-gray-100 last:border-b-0 ${
                      selectedUserId === user.id ? 'bg-primary/10 border-l-4 border-l-primary' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-sm text-gray-600">{user.email}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        user.Role?.name === 'owner' 
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {user.Role?.name || 'guest'}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>

            {selectedUser && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-900">
                    {t('admin.assignPeriod.selectedUser')}: {selectedUser.firstName} {selectedUser.lastName}
                    {selectedUser.Role?.name === 'guest' && (
                      <span className="ml-2 text-xs text-green-700">
                        ({t('admin.assignPeriod.willConvertToOwner')})
                      </span>
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Select Property */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                {t('admin.assignPeriod.selectProperty')}
              </div>
            </label>
            <select
              value={selectedPropertyId || ''}
              onChange={(e) => setSelectedPropertyId(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            >
              <option value="">{t('admin.assignPeriod.chooseProperty')}</option>
              {properties.map(property => (
                <option key={property.id} value={property.id}>
                  {property.name} - {property.location}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('admin.assignPeriod.startDate')}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('admin.assignPeriod.endDate')}
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Show nights calculation */}
          {nights > 0 && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-600" />
                <span className="text-sm text-gray-700">
                  {t('admin.assignPeriod.totalNights')}: <strong>{nights} {t('common.nights')}</strong>
                </span>
              </div>
            </div>
          )}

          {/* Accommodation Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('admin.assignPeriod.accommodationType')}
            </label>
            <select
              value={accommodationType}
              onChange={(e) => setAccommodationType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            >
              <option value="">{t('admin.assignPeriod.chooseType')}</option>
              <option value="studio">Studio</option>
              <option value="1bedroom">1 Bedroom</option>
              <option value="2bedroom">2 Bedroom</option>
              <option value="3bedroom">3 Bedroom</option>
              <option value="penthouse">Penthouse</option>
            </select>
          </div>

          {/* Summary */}
          {selectedUser && selectedProperty && nights > 0 && accommodationType && (
            <div className="p-4 bg-green-50 border-2 border-green-200 rounded-lg">
              <h3 className="text-sm font-semibold text-green-900 mb-3">
                {t('admin.assignPeriod.summary')}
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-700">{t('admin.assignPeriod.user')}:</span>
                  <span className="font-medium text-gray-900">
                    {selectedUser.firstName} {selectedUser.lastName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">{t('admin.assignPeriod.property')}:</span>
                  <span className="font-medium text-gray-900">{selectedProperty.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">{t('admin.assignPeriod.duration')}:</span>
                  <span className="font-medium text-gray-900">{nights} {t('common.nights')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">{t('admin.assignPeriod.type')}:</span>
                  <span className="font-medium text-gray-900">{accommodationType}</span>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={assignMutation.isPending || !selectedUserId || !selectedPropertyId || !startDate || !endDate || !accommodationType}
            className="w-full bg-primary hover:bg-primary/90 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition flex items-center justify-center gap-2"
          >
            {assignMutation.isPending && (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
            )}
            {t('admin.assignPeriod.assignPeriod')}
          </button>
        </form>
      </main>
    </div>
  );
}
