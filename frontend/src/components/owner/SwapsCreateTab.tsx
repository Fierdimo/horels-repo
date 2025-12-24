import { useTranslation } from 'react-i18next';
import type { Week } from '@/types/models';
import type { CreateSwapRequest } from '@/types/api';

interface SwapsCreateTabProps {
  formData: CreateSwapRequest;
  onFormChange: (data: CreateSwapRequest) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  weeks: Week[];
  isCreating: boolean;
  hasPaymentMethod?: boolean;
  getAccommodationTypeName: (type: string) => string;
  getAccommodationTypeEmoji: (type: string) => string;
}

export function SwapsCreateTab({
  formData,
  onFormChange,
  onSubmit,
  onCancel,
  weeks,
  isCreating,
  hasPaymentMethod = false,
  getAccommodationTypeName,
  getAccommodationTypeEmoji
}: SwapsCreateTabProps) {
  const { t } = useTranslation();

  // Get unique properties
  const uniqueProperties = weeks
    .map((w) => w.Property)
    .filter((p, i, arr) => arr.findIndex((x) => x?.id === p?.id) === i);

  return (
    <div className="space-y-6">
      {/* Payment Method Warning */}
      {!hasPaymentMethod && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <span className="font-medium">Configuración requerida:</span> Debes agregar un método de pago en tu perfil antes de crear intercambios.
              </p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
        {/* Section 1: What You're Offering */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            💼 What week do you want to swap?
          </h3>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Select your week (required)
            </label>
            <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-300 rounded-lg p-3 bg-gray-50">
              {weeks.length === 0 ? (
                <p className="text-sm text-gray-600 italic">You don't have any weeks available</p>
              ) : (
                weeks.map((week) => {
                  // Handle both numeric IDs and string IDs like "booking_4"
                  const weekId = typeof week.id === 'string' && week.id.startsWith('booking_') 
                    ? week.id 
                    : week.id;
                  
                  return (
                  <label
                    key={weekId}
                    className="flex items-center p-3 rounded-lg hover:bg-white cursor-pointer transition"
                  >
                    <input
                      type="radio"
                      name="requester_week_id"
                      value={String(weekId)}
                      checked={String(formData.requester_week_id) === String(weekId)}
                      onChange={(e) =>
                        onFormChange({
                          ...formData,
                          requester_week_id: e.target.value as any
                        })
                      }
                      className="w-4 h-4 text-blue-600 cursor-pointer"
                    />
                    <div className="ml-3 flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {getAccommodationTypeEmoji(week.accommodation_type)} {getAccommodationTypeName(week.accommodation_type)}
                      </p>
                      <p className="text-xs text-gray-600">
                        {week.Property?.name} • {new Date(week.start_date).toLocaleDateString('es-ES')} to{' '}
                        {new Date(week.end_date).toLocaleDateString('es-ES')}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {Math.ceil(
                          (new Date(week.end_date).getTime() -
                            new Date(week.start_date).getTime()) /
                            (1000 * 60 * 60 * 24)
                        )}{' '}
                        nights
                      </p>
                      {(week as any).source === 'booking' && (
                        <p className="text-xs text-blue-600 mt-1 font-semibold">📱 Marketplace booking</p>
                      )}
                    </div>
                  </label>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* What They're Looking For */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🎯 What are you looking for?</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Desired property */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                🏨 {t('owner.swaps.desiredProperty')} (optional)
              </label>
              <select
                value={formData.desired_property_id}
                onChange={(e) =>
                  onFormChange({ ...formData, desired_property_id: Number(e.target.value) })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={0}>Any property</option>
                {uniqueProperties.map((property, index) => (
                  <option key={`property-${property?.id || index}`} value={property?.id || 0}>
                    {property?.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Desired start date */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                📅 {t('owner.swaps.desiredDate')} (optional)
              </label>
              <input
                type="date"
                value={formData.desired_start_date}
                onChange={(e) =>
                  onFormChange({ ...formData, desired_start_date: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-end">
              <p className="text-sm text-gray-600">💡 Leave blank if flexible</p>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-green-50 border-l-4 border-green-600 p-4 rounded">
          <p className="text-sm text-gray-700">
            ✅ <strong>Creating this request is 100% FREE</strong><br />
            <span className="text-xs text-gray-600 mt-1 block">
              Fee (€{formData.requester_week_id ? 'TBD' : '?'}) is only charged if someone accepts your swap.
            </span>
          </p>
        </div>

        <div className="flex gap-2 pt-4">
          <button
            type="submit"
            disabled={isCreating || !formData.requester_week_id}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-semibold transition"
          >
            {isCreating ? t('common.saving') : `✓ ${t('owner.swaps.createAndGoLive')}`}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-3 rounded-lg font-semibold transition"
          >
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}
