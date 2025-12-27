import { useState } from 'react';
import { Calculator, TrendingUp, Info } from 'lucide-react';
import { creditsApi } from '@/api/credits';
import type { SeasonType } from '@/types/credits';

interface EstimateCreditsToolProps {
  onEstimateComplete?: (estimatedCredits: number) => void;
  className?: string;
}

export default function EstimateCreditsTool({ onEstimateComplete, className = '' }: EstimateCreditsToolProps) {
  const [seasonType, setSeasonType] = useState<SeasonType>('WHITE');
  const [locationMultiplier, setLocationMultiplier] = useState<number>(1.0);
  const [roomTypeMultiplier, setRoomTypeMultiplier] = useState<number>(1.0);
  const [estimatedCredits, setEstimatedCredits] = useState<number | null>(null);
  const [breakdown, setBreakdown] = useState<any>(null);
  const [expirationDate, setExpirationDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seasonOptions: { value: SeasonType; label: string; color: string; baseValue: number }[] = [
    { value: 'RED', label: 'Temporada Alta (RED)', color: 'text-red-600', baseValue: 1000 },
    { value: 'WHITE', label: 'Temporada Media (WHITE)', color: 'text-gray-600', baseValue: 600 },
    { value: 'BLUE', label: 'Temporada Baja (BLUE)', color: 'text-blue-600', baseValue: 300 },
  ];

  const locationOptions = [
    { value: 1.5, label: 'DIAMOND (1.5x)' },
    { value: 1.3, label: 'GOLD HIGH (1.3x)' },
    { value: 1.2, label: 'GOLD (1.2x)' },
    { value: 1.1, label: 'SILVER PLUS (1.1x)' },
    { value: 1.0, label: 'STANDARD (1.0x)' },
  ];

  const roomOptions = [
    { value: 3.0, label: 'PRESIDENTIAL (3.0x)' },
    { value: 2.0, label: 'SUITE (2.0x)' },
    { value: 1.5, label: 'DELUXE (1.5x)' },
    { value: 1.2, label: 'SUPERIOR (1.2x)' },
    { value: 1.0, label: 'STANDARD (1.0x)' },
  ];

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
        setBreakdown(response.breakdown);
        setExpirationDate(response.expirationDate);
        
        if (onEstimateComplete) {
          onEstimateComplete(response.estimatedCredits);
        }
      }
    } catch (err: any) {
      console.error('Error estimating credits:', err);
      setError(err.response?.data?.message || 'Error al calcular créditos');
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

  const selectedSeason = seasonOptions.find(s => s.value === seasonType);

  return (
    <div className={`bg-white rounded-lg shadow-md ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Calculator className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Calculadora de Créditos</h3>
            <p className="text-sm text-gray-500">Estima cuántos créditos recibirás</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Season Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Temporada
          </label>
          <div className="grid grid-cols-1 gap-2">
            {seasonOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setSeasonType(option.value)}
                className={`p-3 border-2 rounded-lg text-left transition-all ${
                  seasonType === option.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-medium ${option.color}`}>
                    {option.label}
                  </span>
                  <span className="text-sm text-gray-600">
                    Base: {option.baseValue} créditos
                  </span>
                </div>
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {locationOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {roomOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Calculate Button */}
        <button
          onClick={handleEstimate}
          disabled={loading}
          className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
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

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Results */}
        {estimatedCredits !== null && breakdown && (
          <div className="border-t border-gray-200 pt-6 space-y-4">
            {/* Estimated Credits */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg border-2 border-green-200">
              <p className="text-sm text-green-700 mb-1">Créditos Estimados</p>
              <p className="text-4xl font-bold text-green-900">
                {formatCredits(estimatedCredits)}
              </p>
              <p className="text-sm text-green-700 mt-1">créditos</p>
            </div>

            {/* Breakdown */}
            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
              <h4 className="font-medium text-gray-900 flex items-center gap-2">
                <Info className="w-4 h-4" />
                Desglose del Cálculo
              </h4>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Valor base temporada ({selectedSeason?.label.split('(')[0]})</span>
                  <span className="font-medium">{formatCredits(breakdown.baseSeasonValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">× Multiplicador ubicación</span>
                  <span className="font-medium">{breakdown.locationMultiplier}x</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">× Multiplicador habitación</span>
                  <span className="font-medium">{breakdown.roomTypeMultiplier}x</span>
                </div>
                <div className="border-t border-gray-300 pt-2 flex justify-between">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="font-bold text-green-600">{formatCredits(estimatedCredits)}</span>
                </div>
              </div>
            </div>

            {/* Expiration Info */}
            {expirationDate && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-900">
                      Fecha de expiración estimada
                    </p>
                    <p className="text-blue-700 mt-1">
                      {new Date(expirationDate).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                    <p className="text-blue-600 text-xs mt-1">
                      Los créditos expiran 6 meses después del depósito
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Formula Info */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Fórmula</h4>
          <p className="text-xs text-gray-600 font-mono">
            Créditos = Base Temporada × Ubicación × Habitación
          </p>
        </div>
      </div>
    </div>
  );
}
