import { useState, useEffect } from 'react';
import { X, Wallet, Calendar, MapPin, Home, TrendingUp, AlertCircle } from 'lucide-react';
import { creditsApi } from '@/api/credits';
import type { SeasonType } from '@/types/credits';

interface DepositWeekModalProps {
  userId: number;
  weekId?: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (creditsEarned: number) => void;
  className?: string;
}

interface WeekData {
  id: number;
  property_name: string;
  start_date: string;
  end_date: string;
  room_type: string;
  season_type?: SeasonType;
}

export default function DepositWeekModal({
  userId,
  weekId,
  isOpen,
  onClose,
  onSuccess,
  className = ''
}: DepositWeekModalProps) {
  const [step, setStep] = useState<'select' | 'calculate' | 'confirm' | 'success'>('select');
  const [selectedWeekId, setSelectedWeekId] = useState<number | null>(weekId || null);
  const [seasonType, setSeasonType] = useState<SeasonType>('WHITE');
  const [locationMultiplier, setLocationMultiplier] = useState<number>(1.0);
  const [roomTypeMultiplier, setRoomTypeMultiplier] = useState<number>(1.0);
  const [estimatedCredits, setEstimatedCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weekData, setWeekData] = useState<WeekData | null>(null);

  useEffect(() => {
    if (isOpen && weekId) {
      setSelectedWeekId(weekId);
      setStep('calculate');
      // In a real implementation, fetch week data from API
      // For now, we'll use mock data
    }
  }, [isOpen, weekId]);

  useEffect(() => {
    if (!isOpen) {
      // Reset form when modal closes
      setStep('select');
      setSelectedWeekId(weekId || null);
      setSeasonType('WHITE');
      setLocationMultiplier(1.0);
      setRoomTypeMultiplier(1.0);
      setEstimatedCredits(null);
      setError(null);
    }
  }, [isOpen, weekId]);

  const handleEstimate = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await creditsApi.estimateCredits({
        seasonType,
        locationMultiplier,
        roomTypeMultiplier,
      });

      if (response.success) {
        setEstimatedCredits(response.estimatedCredits);
        setStep('confirm');
      }
    } catch (err: any) {
      console.error('Error estimating credits:', err);
      setError(err.response?.data?.message || 'Error al calcular créditos');
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async () => {
    if (!selectedWeekId || estimatedCredits === null) return;

    try {
      setLoading(true);
      setError(null);

      const response = await creditsApi.depositWeek({
        userId,
        weekId: selectedWeekId,
        seasonType,
        locationMultiplier,
        roomTypeMultiplier,
      });

      if (response.success) {
        setStep('success');
        if (onSuccess) {
          onSuccess(response.creditsEarned);
        }
        // Auto-close after 3 seconds
        setTimeout(() => {
          onClose();
        }, 3000);
      }
    } catch (err: any) {
      console.error('Error depositing week:', err);
      setError(err.response?.data?.message || 'Error al depositar semana');
    } finally {
      setLoading(false);
    }
  };

  const formatCredits = (amount: number): string => {
    return new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  };

  if (!isOpen) return null;

  const seasonOptions: { value: SeasonType; label: string; color: string }[] = [
    { value: 'RED', label: 'Temporada Alta', color: 'bg-red-500' },
    { value: 'WHITE', label: 'Temporada Media', color: 'bg-gray-400' },
    { value: 'BLUE', label: 'Temporada Baja', color: 'bg-blue-500' },
  ];

  const locationOptions = [
    { value: 1.5, label: 'DIAMOND' },
    { value: 1.3, label: 'GOLD HIGH' },
    { value: 1.2, label: 'GOLD' },
    { value: 1.1, label: 'SILVER PLUS' },
    { value: 1.0, label: 'STANDARD' },
  ];

  const roomOptions = [
    { value: 3.0, label: 'PRESIDENTIAL' },
    { value: 2.0, label: 'SUITE' },
    { value: 1.5, label: 'DELUXE' },
    { value: 1.2, label: 'SUPERIOR' },
    { value: 1.0, label: 'STANDARD' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto ${className}`}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Wallet className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Depositar Semana por Créditos</h2>
              <p className="text-sm text-gray-500">Convierte tu semana en créditos variables</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Step: Calculate */}
          {step === 'calculate' && (
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-3">Información de la Semana</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">Propiedad:</span>
                    <span className="font-medium">Propiedad seleccionada</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">Semana ID:</span>
                    <span className="font-medium">#{selectedWeekId}</span>
                  </div>
                </div>
              </div>

              {/* Season Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Temporada de la Semana
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {seasonOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSeasonType(option.value)}
                      className={`p-4 border-2 rounded-lg transition-all ${
                        seasonType === option.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className={`w-8 h-8 ${option.color} rounded-full mx-auto mb-2`}></div>
                      <p className="text-sm font-medium text-gray-900">{option.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Location Tier */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nivel de Ubicación
                </label>
                <select
                  value={locationMultiplier}
                  onChange={(e) => setLocationMultiplier(parseFloat(e.target.value))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {locationOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} ({option.value}x)
                    </option>
                  ))}
                </select>
              </div>

              {/* Room Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Habitación
                </label>
                <select
                  value={roomTypeMultiplier}
                  onChange={(e) => setRoomTypeMultiplier(parseFloat(e.target.value))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {roomOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} ({option.value}x)
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleEstimate}
                disabled={loading}
                className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Calculando...
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-5 h-5" />
                    Calcular Créditos
                  </>
                )}
              </button>
            </div>
          )}

          {/* Step: Confirm */}
          {step === 'confirm' && estimatedCredits !== null && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg border-2 border-green-200 text-center">
                <p className="text-sm text-green-700 mb-2">Recibirás</p>
                <p className="text-5xl font-bold text-green-900 mb-2">
                  {formatCredits(estimatedCredits)}
                </p>
                <p className="text-lg text-green-700">créditos</p>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2">Información Importante</h4>
                <ul className="text-sm text-blue-800 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">•</span>
                    <span>Los créditos expiran 6 meses después del depósito</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">•</span>
                    <span>Una vez depositada, la semana no puede ser recuperada</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">•</span>
                    <span>Los créditos pueden usarse para cualquier reserva en la plataforma</span>
                  </li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('calculate')}
                  disabled={loading}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Volver
                </button>
                <button
                  onClick={handleDeposit}
                  disabled={loading}
                  className="flex-1 bg-green-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Wallet className="w-5 h-5" />
                      Confirmar Depósito
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step: Success */}
          {step === 'success' && estimatedCredits !== null && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">¡Depósito Exitoso!</h3>
              <p className="text-gray-600 mb-6">
                Has recibido <span className="font-semibold text-green-600">{formatCredits(estimatedCredits)} créditos</span>
              </p>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
