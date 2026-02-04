import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Calendar, MapPin, Users, Filter, ChevronRight, Star, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import * as unifiedSearchApi from '@/api/unifiedSearch';
import type { UnifiedSearchFilters, UnifiedSearchResult } from '@/api/unifiedSearch';

export function UnifiedSearchPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const [filters, setFilters] = useState<UnifiedSearchFilters>({
    checkIn: '',
    checkOut: '',
    location: '',
    guests: 2,
    showAllOptions: false,
  });
  
  const [searchTriggered, setSearchTriggered] = useState(false);

  // Search query
  const { data: searchResponse, isLoading, refetch } = useQuery({
    queryKey: ['unified-search', filters],
    queryFn: () => unifiedSearchApi.unifiedSearch(filters),
    enabled: searchTriggered && !!filters.checkIn && !!filters.checkOut,
  });

  const handleSearch = () => {
    if (!filters.checkIn || !filters.checkOut) {
      toast.error('Por favor ingresa fechas de check-in y check-out');
      return;
    }
    setSearchTriggered(true);
    refetch();
  };

  const handleReset = () => {
    setFilters({
      checkIn: '',
      checkOut: '',
      location: '',
      guests: 2,
      showAllOptions: false,
    });
    setSearchTriggered(false);
  };

  const results = searchResponse?.data?.results || [];
  const analytics = searchResponse?.data?.analytics;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Búsqueda Inteligente
              </h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Priorizamos inventario prepagado para maximizar márgenes
              </p>
            </div>
            {analytics && (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium text-green-900 dark:text-green-300">
                  {analytics.avgMargin}% Margen Promedio
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <MapPin className="h-4 w-4 inline mr-1" />
                Ubicación
              </label>
              <input
                type="text"
                value={filters.location}
                onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                placeholder="Ciudad o país"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Check-in */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Calendar className="h-4 w-4 inline mr-1" />
                Check-in
              </label>
              <input
                type="date"
                value={filters.checkIn}
                onChange={(e) => setFilters({ ...filters, checkIn: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
            </div>

            {/* Check-out */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Calendar className="h-4 w-4 inline mr-1" />
                Check-out
              </label>
              <input
                type="date"
                value={filters.checkOut}
                onChange={(e) => setFilters({ ...filters, checkOut: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
            </div>

            {/* Guests */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Users className="h-4 w-4 inline mr-1" />
                Huéspedes
              </label>
              <input
                type="number"
                value={filters.guests}
                onChange={(e) => setFilters({ ...filters, guests: parseInt(e.target.value) })}
                min="1"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Search Button */}
            <div className="flex items-end">
              <button
                onClick={handleSearch}
                disabled={isLoading}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  'Buscando...'
                ) : (
                  <>
                    <Search className="h-4 w-4 inline mr-2" />
                    Buscar
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Advanced Filters */}
          <div className="mt-4 flex items-center gap-4">
            <label className="flex items-center text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={filters.showAllOptions}
                onChange={(e) => setFilters({ ...filters, showAllOptions: e.target.checked })}
                className="mr-2"
              />
              Mostrar todas las opciones (incluir PMS)
            </label>
            <button
              onClick={handleReset}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        {/* Analytics Summary */}
        {analytics && results.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">Prepagado</div>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {analytics.byPriority.prepaid}
              </div>
              <div className="text-xs text-gray-500">100% margen</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">Liberado</div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {analytics.byPriority.released}
              </div>
              <div className="text-xs text-gray-500">100% margen</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">PMS</div>
              <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                {analytics.byPriority.pms}
              </div>
              <div className="text-xs text-gray-500">~30% margen</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">Ingresos Potenciales</div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                €{Math.round(analytics.potentialRevenue)}
              </div>
              <div className="text-xs text-gray-500">Estimado</div>
            </div>
          </div>
        )}

        {/* Results */}
        {searchTriggered && (
          <div>
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-400">Buscando habitaciones disponibles...</p>
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
                <p className="text-gray-600 dark:text-gray-400">No se encontraron habitaciones disponibles</p>
              </div>
            ) : (
              <div className="space-y-4">
                {results.map((result) => (
                  <ResultCard key={result.id} result={result} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Result Card Component
function ResultCard({ result }: { result: UnifiedSearchResult }) {
  const navigate = useNavigate();
  const priorityLabel = unifiedSearchApi.getPriorityLabel(result.priority);
  const priorityColor = unifiedSearchApi.getPriorityColor(result.priority);
  const marginBadge = unifiedSearchApi.getMarginBadge(result._internal.marginPercent);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Priority and Margin Badges */}
          <div className="flex items-center gap-2 mb-3">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${priorityColor}`}>
              {priorityLabel}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${marginBadge.color}`}>
              {marginBadge.label}
            </span>
            {result.priority === 1 && (
              <Star className="h-4 w-4 text-yellow-500 fill-current" />
            )}
          </div>

          {/* Property Info */}
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {result.propertyName}
          </h3>
          <div className="flex items-center text-gray-600 dark:text-gray-400 text-sm mb-3">
            <MapPin className="h-4 w-4 mr-1" />
            {result.location}
          </div>

          {/* Room Details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Tipo:</span>
              <div className="font-medium text-gray-900 dark:text-white">{result.roomType}</div>
            </div>
            {result.roomNumber && (
              <div>
                <span className="text-gray-600 dark:text-gray-400">Habitación:</span>
                <div className="font-medium text-gray-900 dark:text-white">{result.roomNumber}</div>
              </div>
            )}
            <div>
              <span className="text-gray-600 dark:text-gray-400">Noches:</span>
              <div className="font-medium text-gray-900 dark:text-white">{result.nights}</div>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Precio:</span>
              <div className="font-medium text-gray-900 dark:text-white">
                {result.cashPrice ? `${result.currency} ${result.cashPrice}` : `${result.creditPrice} créditos`}
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={() => {
            // Navigate based on source
            if (result._internal.inventoryItemId) {
              navigate(`/marketplace/inventory/${result._internal.inventoryItemId}`);
            } else {
              toast('Reserva disponible próximamente');
            }
          }}
          className="ml-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium flex items-center gap-2"
        >
          Reservar
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default UnifiedSearchPage;
