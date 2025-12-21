import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSwaps } from '@/hooks/useSwaps';
import type { SwapRequest, Week } from '@/types/models';
import { Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface SwapFilter {
  status: 'all' | 'pending' | 'matched' | 'completed' | 'cancelled';
}

interface SwapsMyRequestsTabProps {
  swaps: SwapRequest[];
  weeks: Week[];
  onCreateRequest: () => void;
  getStatusColor: (status: string) => string;
  getStatusIcon: (status: string) => string;
}

export function SwapsMyRequestsTab({
  swaps,
  weeks,
  onCreateRequest,
  getStatusColor,
  getStatusIcon
}: SwapsMyRequestsTabProps) {
  const { t } = useTranslation();
  const { rejectSwap, isRejecting } = useSwaps();
  const [requestFilters, setRequestFilters] = useState<SwapFilter>({
    status: 'all'
  });
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const filteredSwaps = swaps.filter((swap) => {
    if (requestFilters.status !== 'all' && swap.status !== requestFilters.status) return false;
    return true;
  });

  const handleCancelSwap = async (swapId: number) => {
    if (!window.confirm('¿Estás seguro de que quieres cancelar esta solicitud de intercambio?')) {
      return;
    }
    
    setCancellingId(swapId);
    rejectSwap(swapId, {
      onSuccess: () => {
        toast.success('Solicitud de intercambio cancelada');
      }
    } as any);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Estado
            </label>
            <select
              value={requestFilters.status}
              onChange={(e) =>
                setRequestFilters({
                  status: e.target.value as SwapFilter['status']
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todas las solicitudes</option>
              <option value="pending">⏳ Pendiente</option>
              <option value="matched">✓ Con respuesta</option>
              <option value="completed">✓✓ Completado</option>
              <option value="cancelled">✗ Cancelado</option>
            </select>
          </div>

          <button
            onClick={() => setRequestFilters({ status: 'all' })}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg font-semibold transition"
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      {/* My Requests */}
      {filteredSwaps.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-600 mb-4 text-lg">📭 Sin solicitudes de intercambio</p>
          <p className="text-sm text-gray-500 mb-6">Aún no has creado ninguna solicitud de intercambio.</p>
          <button
            onClick={onCreateRequest}
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition"
          >
            ➕ Crear nueva solicitud
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
          {filteredSwaps.map((swap) => (
            <div
              key={swap.id}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition border-l-4"
              style={{
                borderLeftColor:
                  swap.status === 'pending'
                    ? '#fbbf24'
                    : swap.status === 'matched'
                    ? '#3b82f6'
                    : swap.status === 'completed'
                    ? '#10b981'
                    : '#ef4444'
              }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                        swap.status
                      )}`}
                    >
                      {getStatusIcon(swap.status)} {swap.status === 'pending' ? 'Pendiente' : swap.status === 'matched' ? 'Con respuesta' : swap.status === 'completed' ? 'Completado' : 'Cancelado'}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {swap.RequesterWeek?.Property?.name}
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* What I'm offering */}
                <div className="bg-blue-50 p-3 rounded">
                  <p className="text-xs text-blue-700 font-semibold mb-1">Ofrezco:</p>
                  <p className="text-sm font-medium text-gray-900">
                    {swap.accommodation_type}
                  </p>
                  {swap.RequesterWeek && (
                    <p className="text-xs text-gray-600 mt-1">
                      {new Date(swap.RequesterWeek.start_date).toLocaleDateString('es-ES')} -{' '}
                      {new Date(swap.RequesterWeek.end_date).toLocaleDateString('es-ES')}
                    </p>
                  )}
                  <p className="text-xs text-gray-600 mt-1">
                    {swap.RequesterWeek && (
                      Math.ceil(
                        (new Date(swap.RequesterWeek.end_date).getTime() -
                          new Date(swap.RequesterWeek.start_date).getTime()) /
                          (1000 * 60 * 60 * 24)
                      )
                    )}{' '}
                    noches
                  </p>
                </div>

                {/* Fee */}
                <div className="bg-yellow-50 p-3 rounded">
                  <p className="text-xs text-yellow-700 font-semibold mb-1">Comisión:</p>
                  <p className="text-lg font-bold text-yellow-700">€{swap.swap_fee}</p>
                  <p className="text-xs text-gray-600 mt-2">
                    {swap.status === 'pending'
                      ? 'Se cobra si alguien acepta'
                      : swap.status === 'matched'
                      ? 'Pendiente de pago'
                      : 'Pagado'}
                  </p>
                </div>
              </div>

              {/* What they're looking for */}
              {swap.ResponderWeek && (
                <div className="bg-green-50 p-3 rounded mb-4">
                  <p className="text-xs text-green-700 font-semibold mb-1">Respuesta recibida:</p>
                  <p className="text-sm font-medium text-gray-900">
                    {swap.ResponderWeek?.Property?.name}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {new Date(swap.ResponderWeek.start_date).toLocaleDateString('es-ES')} -{' '}
                    {new Date(swap.ResponderWeek.end_date).toLocaleDateString('es-ES')}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t">
                <p className="text-xs text-gray-500">
                  Creado: {new Date(swap.created_at).toLocaleDateString('es-ES')}
                </p>
                <div className="flex gap-2">
                  {swap.status === 'pending' && (
                    <button
                      onClick={() => handleCancelSwap(swap.id)}
                      disabled={cancellingId === swap.id}
                      className="text-red-600 hover:text-red-800 disabled:text-gray-400 transition flex items-center gap-1"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="text-sm">Cancelar</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
