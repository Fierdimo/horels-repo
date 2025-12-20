import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SwapRequest, Week } from '@/types/models';

interface SwapFilter {
  status: 'all' | 'pending' | 'matched' | 'completed' | 'cancelled';
  property: 'all' | number;
  type: 'all' | 'sent' | 'received';
}

interface SwapsMyRequestsTabProps {
  swaps: SwapRequest[];
  weeks: Week[];
  onSelectSwap: (swap: SwapRequest) => void;
  onCreateRequest: () => void;
  getStatusColor: (status: string) => string;
  getStatusIcon: (status: string) => string;
}

export function SwapsMyRequestsTab({
  swaps,
  weeks,
  onSelectSwap,
  onCreateRequest,
  getStatusColor,
  getStatusIcon
}: SwapsMyRequestsTabProps) {
  const { t } = useTranslation();
  const [requestFilters, setRequestFilters] = useState<SwapFilter>({
    status: 'all',
    property: 'all',
    type: 'all'
  });

  const filteredSwaps = swaps.filter((swap) => {
    if (requestFilters.status !== 'all' && swap.status !== requestFilters.status) return false;
    
    if (requestFilters.property !== 'all') {
      const matchesProperty = 
        swap.RequesterWeek?.property_id === requestFilters.property ||
        swap.ResponderWeek?.property_id === requestFilters.property;
      if (!matchesProperty) return false;
    }
    
    return true;
  });

  return (
    <div className="space-y-6">
      {/* My Requests Filters */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Status Filter */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {t('common.status')}
            </label>
            <select
              value={requestFilters.status}
              onChange={(e) =>
                setRequestFilters({
                  ...requestFilters,
                  status: e.target.value as SwapFilter['status']
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{t('common.all')}</option>
              <option value="pending">⏳ {t('common.pending')}</option>
              <option value="matched">✓ {t('common.matched')}</option>
              <option value="completed">✓✓ {t('common.completed')}</option>
              <option value="cancelled">✗ {t('common.cancelled')}</option>
            </select>
          </div>

          {/* Property Filter */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {t('common.property')}
            </label>
            <select
              value={requestFilters.property}
              onChange={(e) =>
                setRequestFilters({
                  ...requestFilters,
                  property: e.target.value === 'all' ? 'all' : Number(e.target.value)
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{t('common.all')}</option>
              {weeks
                .map((week) => week.Property)
                .filter((p, i, arr) => arr.findIndex((x) => x?.id === p?.id) === i)
                .map((property) => (
                  <option key={property?.id} value={property?.id || 0}>
                    {property?.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Clear Filters */}
          <div className="flex items-end">
            <button
              onClick={() =>
                setRequestFilters({ status: 'all', property: 'all', type: 'all' })
              }
              className="w-full bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg font-semibold transition"
            >
              ✕ {t('common.clearFilters')}
            </button>
          </div>
        </div>
      </div>

      {/* My Requests Table */}
      {filteredSwaps.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <p className="text-gray-600 mb-4">📭 {t('owner.swaps.noSwaps')}</p>
          <p className="text-sm text-gray-500 mb-6">Aún no has creado ninguna solicitud de intercambio.</p>
          <button
            onClick={onCreateRequest}
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition"
          >
            ➕ {t('owner.swaps.createYourRequest')}
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    {t('common.status')}
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    {t('owner.swaps.requesterProperty')}
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    {t('owner.swaps.dates')}
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    {t('owner.swaps.fee')}
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    {t('common.created')}
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredSwaps.map((swap) => (
                  <tr
                    key={swap.id}
                    className="border-b hover:bg-gray-50 transition"
                  >
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                          swap.status
                        )}`}
                      >
                        {getStatusIcon(swap.status)} {t(`common.${swap.status}`)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {swap.RequesterWeek?.Property?.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {swap.RequesterWeek && (
                        <>
                          {new Date(swap.RequesterWeek.start_date).toLocaleDateString()} -{' '}
                          {new Date(swap.RequesterWeek.end_date).toLocaleDateString()}
                        </>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      €{swap.swap_fee}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {new Date(swap.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => onSelectSwap(swap)}
                        className="text-blue-600 hover:text-blue-700 font-semibold transition"
                      >
                        {t('common.view')} →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
