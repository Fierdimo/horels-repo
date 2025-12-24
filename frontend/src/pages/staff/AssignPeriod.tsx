import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, User, Home, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '@/api/client';

interface AssignPeriodFormData {
  owner_id: string;
  nights: string;
  valid_until: string;
  accommodation_type: string;
}

export default function AssignPeriod() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<AssignPeriodFormData>({
    owner_id: '',
    nights: '',
    valid_until: '',
    accommodation_type: 'Standard'
  });

  const [ownerSearch, setOwnerSearch] = useState('');

  // Fetch owners
  const { data: ownersData, isLoading: loadingOwners, error: ownersError } = useQuery({
    queryKey: ['staff-owners'],
    queryFn: async () => {
      const { data } = await apiClient.get('/staff/owners');
      return data?.data || [];
    },
    retry: false
  });

  // Assign period mutation
  const assignPeriodMutation = useMutation({
    mutationFn: async (data: AssignPeriodFormData) => {
      const response = await apiClient.post('/staff/assign-period', data);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(t('staff.assignPeriod.success'));
      queryClient.invalidateQueries({ queryKey: ['weeks'] });
      // Reset form
      setFormData({
        owner_id: '',
        nights: '',
        valid_until: '',
        accommodation_type: 'Standard'
      });
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || t('common.error');
      toast.error(message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate nights
    const nightsNum = parseInt(formData.nights);
    if (isNaN(nightsNum) || nightsNum < 1) {
      toast.error(t('staff.assignPeriod.invalidNights'));
      return;
    }

    // Validate valid_until date
    const validUntilDate = new Date(formData.valid_until);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (validUntilDate <= today) {
      toast.error(t('staff.assignPeriod.invalidValidUntil'));
      return;
    }

    assignPeriodMutation.mutate(formData);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {t('staff.assignPeriod.title')}
        </h1>
        <p className="text-gray-600">
          {t('staff.assignPeriod.subtitle')}
        </p>
      </div>

      {/* Loading State */}
      {loadingOwners && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-center text-gray-600 mt-4">{t('common.loading')}...</p>
        </div>
      )}

      {/* Error State */}
      {ownersError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">
            {t('common.error')}: {ownersError?.message}
          </p>
        </div>
      )}

      {/* Form */}
      {!loadingOwners && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="space-y-6">
          {/* Owner Selection */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <User className="w-4 h-4" />
              {t('staff.assignPeriod.selectOwner')}
            </label>
            
            {/* Search input */}
            <input
              type="text"
              placeholder={t('common.search')}
              value={ownerSearch}
              onChange={(e) => setOwnerSearch(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
            />
            
            <select
              value={formData.owner_id}
              onChange={(e) => setFormData({ ...formData, owner_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              size={5}
            >
              <option value="">{t('common.select')}...</option>
              {Array.isArray(ownersData) && ownersData
                .filter((owner: any) => {
                  if (!ownerSearch) return true;
                  const search = ownerSearch.toLowerCase();
                  const fullName = `${owner.firstName || ''} ${owner.lastName || ''}`.toLowerCase();
                  const email = (owner.email || '').toLowerCase();
                  return fullName.includes(search) || email.includes(search);
                })
                .map((owner: any) => (
                <option key={owner.id} value={owner.id}>
                  {owner.firstName} {owner.lastName} ({owner.email})
                </option>
              ))}
            </select>
          </div>

          {/* Nights and Validity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Clock className="w-4 h-4" />
                {t('staff.assignPeriod.nights')}
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={formData.nights}
                onChange={(e) => setFormData({ ...formData, nights: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="7"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                {t('staff.assignPeriod.nightsHelp')}
              </p>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4" />
                {t('staff.assignPeriod.validUntil')}
              </label>
              <input
                type="date"
                value={formData.valid_until}
                onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min={new Date().toISOString().split('T')[0]}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                {t('staff.assignPeriod.validUntilHelp')}
              </p>
            </div>
          </div>

          {/* Accommodation Type */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Home className="w-4 h-4" />
              {t('owner.weeks.accommodationType')}
            </label>
            <select
              value={formData.accommodation_type}
              onChange={(e) => setFormData({ ...formData, accommodation_type: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">-- {t('common.select')} --</option>
              <option value="Standard">🛏️ Standard</option>
              <option value="Suite">🏨 Suite</option>
              <option value="Deluxe">✨ Deluxe</option>
              <option value="Premium">💎 Premium</option>
              <option value="Studio">🏠 Studio</option>
            </select>
          </div>

          {/* Nights Summary */}
          {formData.nights && parseInt(formData.nights) > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900">
                    {t('staff.assignPeriod.periodSummary')}
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    {formData.nights} {t('common.nights')} • {formData.nights} {t('owner.credits.nightCredits')} {t('staff.assignPeriod.afterConversion')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium mb-1">{t('staff.assignPeriod.important')}</p>
                <ul className="space-y-1">
                  <li>• {t('staff.assignPeriod.floatingInfo1')}</li>
                  <li>• {t('staff.assignPeriod.floatingInfo2')}</li>
                  <li>• {t('staff.assignPeriod.floatingInfo3')}</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={() => setFormData({
                owner_id: '',
                nights: '',
                valid_until: '',
                accommodation_type: 'Standard'
              })}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
            >
              {t('common.clear')}
            </button>
            <button
              type="submit"
              disabled={assignPeriodMutation.isPending || !formData.nights || parseInt(formData.nights) === 0}
              className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              {assignPeriodMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  {t('staff.assignPeriod.assigning')}
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  {t('staff.assignPeriod.assignPeriod')}
                </>
              )}
            </button>
          </div>
        </div>
      </form>
      )}
    </div>
  );
}
