import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, TrendingUp, Calendar, MapPin, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import * as marketplaceApi from '@/api/marketplace';
import type { Week, ReleaseEstimate } from '@/api/marketplace';

interface ReleaseWeekModalProps {
  week: Week;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ReleaseWeekModal({ week, isOpen, onClose, onSuccess }: ReleaseWeekModalProps) {
  const { t } = useTranslation();
  const [estimate, setEstimate] = useState<ReleaseEstimate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);

  // Fetch estimate when modal opens
  useEffect(() => {
    if (isOpen && week) {
      loadEstimate();
    }
  }, [isOpen, week]);

  const loadEstimate = async () => {
    setIsLoading(true);
    try {
      const est = await marketplaceApi.estimateWeekValue(week.id);
      setEstimate(est);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al calcular créditos');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRelease = async () => {
    if (!window.confirm('¿Estás seguro de que quieres liberar esta semana al marketplace?')) {
      return;
    }

    setIsReleasing(true);
    try {
      const result = await marketplaceApi.releaseWeek(week.id);
      toast.success(`¡Semana liberada! Ganaste ${result.creditsEarned} créditos.`);
      onSuccess?.();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al liberar semana');
    } finally {
      setIsReleasing(false);
    }
  };

  if (!isOpen) return null;

  const formatDate = (date: string | null) => {
    if (!date) return 'Fecha flexible';
    return new Date(date).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getSeasonBadgeColor = (season: string) => {
    switch (season) {
      case 'RED': return 'bg-red-100 text-red-800';
      case 'WHITE': return 'bg-blue-100 text-blue-800';
      case 'BLUE': return 'bg-cyan-100 text-cyan-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeasonLabel = (season: string) => {
    switch (season) {
      case 'RED': return 'Alta Temporada';
      case 'WHITE': return 'Media Temporada';
      case 'BLUE': return 'Baja Temporada';
      default: return season;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold">Liberar Semana al Marketplace</h2>
              <p className="text-emerald-100 mt-1">Convierte tu semana en créditos</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Week Info */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-lg text-gray-900">Detalles de la Semana</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-gray-700">
                <Calendar className="h-5 w-5 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-500">Fechas</div>
                  <div className="font-medium">
                    {formatDate(week.start_date)} - {formatDate(week.end_date)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-gray-700">
                <MapPin className="h-5 w-5 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-500">Tipo</div>
                  <div className="font-medium capitalize">{week.accommodation_type}</div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getSeasonBadgeColor(week.season_type)}`}>
                {getSeasonLabel(week.season_type)}
              </span>
            </div>
          </div>

          {/* Credit Estimate */}
          {isLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
              <p className="mt-4 text-gray-600">Calculando valor...</p>
            </div>
          ) : estimate ? (
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg p-6 border-2 border-emerald-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-emerald-600 rounded-full p-3">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Créditos que Recibirás</h3>
                  <p className="text-sm text-gray-600">Calculado dinámicamente</p>
                </div>
              </div>

              <div className="text-center mb-6">
                <div className="text-5xl font-bold text-emerald-600">
                  {estimate.estimatedCredits.toLocaleString()}
                </div>
                <div className="text-gray-600 mt-1">créditos</div>
              </div>

              {/* Breakdown */}
              {estimate.breakdown && (
                <div className="bg-white rounded-lg p-4 space-y-2">
                  <h4 className="font-semibold text-sm text-gray-700 mb-3">Cálculo Detallado</h4>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Base ({estimate.breakdown.seasonType})</span>
                      <div className="font-semibold">{estimate.breakdown.baseValue}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Categoría Hotel</span>
                      <div className="font-semibold">×{estimate.breakdown.tierMultiplier}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Ubicación</span>
                      <div className="font-semibold">×{estimate.breakdown.locationMultiplier}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Tipo Habitación</span>
                      <div className="font-semibold">×{estimate.breakdown.roomTypeMultiplier}</div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 font-medium">Total</span>
                      <span className="text-xl font-bold text-emerald-600">
                        {estimate.estimatedCredits.toLocaleString()} créditos
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Information */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">ℹ️ Información Importante</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Los créditos se añadirán inmediatamente a tu wallet</li>
              <li>• Tu semana estará disponible para que otros owners la reserven</li>
              <li>• Otros owners podrán buscar y reservar tu semana</li>
              <li>• Una vez reservada, el intercambio es final</li>
              <li>• Puedes retirar la semana del marketplace si aún no está reservada</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              disabled={isReleasing}
            >
              Cancelar
            </button>
            <button
              onClick={handleRelease}
              disabled={isReleasing || isLoading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {isReleasing ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Liberando...
                </span>
              ) : (
                `Liberar y Ganar ${estimate?.estimatedCredits.toLocaleString() || '...'} Créditos`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
