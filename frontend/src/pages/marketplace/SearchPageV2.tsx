/**
 * Unified Search Page (V2)
 * 
 * Search across timeshare released weeks + hotel inventory
 * Uses /api/v2/search endpoint
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search,
  Calendar,
  MapPin,
  Users,
  ChevronRight,
  Loader2,
  Home,
  Hotel,
  Star,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import * as searchApi from '@/api/v2/search';
import type { SearchFilters, SearchResult } from '@/api/v2/search';

export function SearchPageV2() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Today and tomorrow as default dates
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 7); // Default: 1 week from now

  const [filters, setFilters] = useState<SearchFilters>({
    checkIn: today.toISOString().split('T')[0],
    checkOut: tomorrow.toISOString().split('T')[0],
    location: '',
    guests: 2,
    includeTimeshare: true,
    includeHotels: true,
    sortBy: 'credits',
    page: 1,
    limit: 20,
  });

  const [searchTriggered, setSearchTriggered] = useState(false);

  // Search query
  const {
    data: searchResponse,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['v2-search', filters],
    queryFn: () => searchApi.search(filters),
    enabled: searchTriggered && !!filters.checkIn && !!filters.checkOut,
    retry: 1,
  });

  const handleSearch = () => {
    if (!filters.checkIn || !filters.checkOut) {
      toast.error('Por favor ingresa fechas de check-in y check-out');
      return;
    }

    const checkInDate = new Date(filters.checkIn);
    const checkOutDate = new Date(filters.checkOut);

    if (checkOutDate <= checkInDate) {
      toast.error('La fecha de check-out debe ser posterior al check-in');
      return;
    }

    setSearchTriggered(true);
    refetch();
  };

  const handleReset = () => {
    setFilters({
      checkIn: today.toISOString().split('T')[0],
      checkOut: tomorrow.toISOString().split('T')[0],
      location: '',
      guests: 2,
      includeTimeshare: true,
      includeHotels: true,
      sortBy: 'credits',
      page: 1,
      limit: 20,
    });
    setSearchTriggered(false);
  };

  const results = searchResponse?.data?.results || [];
  const meta = searchResponse?.data?.meta;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Búsqueda de Alojamiento
              </h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Encuentra tu próxima escapada perfecta
              </p>
            </div>
            {meta && (
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <Home className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-blue-900 dark:text-blue-300">
                    {meta.timeshareResults} Timeshare
                  </span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <Hotel className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  <span className="text-gray-900 dark:text-gray-300">
                    {meta.hotelResults} Hoteles
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
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
                onChange={(e) =>
                  setFilters({ ...filters, location: e.target.value })
                }
                placeholder="Ciudad, región o país"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                onChange={(e) =>
                  setFilters({ ...filters, checkIn: e.target.value })
                }
                min={today.toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                onChange={(e) =>
                  setFilters({ ...filters, checkOut: e.target.value })
                }
                min={filters.checkIn}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                onChange={(e) =>
                  setFilters({ ...filters, guests: parseInt(e.target.value) || 1 })
                }
                min="1"
                max="20"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Search Button */}
            <div className="flex items-end">
              <button
                onClick={handleSearch}
                disabled={isLoading}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Buscar
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Advanced Filters */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap items-center gap-4">
              {/* Source Filters */}
              <div className="flex items-center gap-4">
                <label className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={filters.includeTimeshare}
                    onChange={(e) =>
                      setFilters({ ...filters, includeTimeshare: e.target.checked })
                    }
                    className="mr-2 rounded"
                  />
                  Incluir Timeshare
                </label>
                <label className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={filters.includeHotels}
                    onChange={(e) =>
                      setFilters({ ...filters, includeHotels: e.target.checked })
                    }
                    className="mr-2 rounded"
                  />
                  Incluir Hoteles
                </label>
              </div>

              {/* Sort */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700 dark:text-gray-300">
                  Ordenar por:
                </label>
                <select
                  value={filters.sortBy}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      sortBy: e.target.value as 'credits' | 'date' | 'relevance',
                    })
                  }
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="credits">Precio (créditos)</option>
                  <option value="date">Fecha</option>
                  <option value="relevance">Relevancia</option>
                </select>
              </div>

              {/* Reset Button */}
              <button
                onClick={handleReset}
                className="ml-auto text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Limpiar filtros
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-300">
              Error al buscar: {(error as Error).message}
            </p>
          </div>
        )}

        {/* Results */}
        {searchTriggered && (
          <div>
            {isLoading ? (
              <div className="text-center py-16">
                <Loader2 className="h-12 w-12 animate-spin text-blue-600 dark:text-blue-400 mx-auto" />
                <p className="mt-4 text-gray-600 dark:text-gray-400">
                  Buscando opciones disponibles...
                </p>
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-lg shadow">
                <Hotel className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No se encontraron resultados
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Intenta ajustar tus filtros de búsqueda
                </p>
              </div>
            ) : (
              <>
                {/* Results Count */}
                <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                  Mostrando {results.length} de {meta?.totalResults} resultados
                  {meta && meta.totalPages > 1 && ` (Página ${meta.page} de ${meta.totalPages})`}
                </div>

                {/* Results Grid */}
                <div className="space-y-4">
                  {results.map((result) => (
                    <ResultCard key={searchApi.getResultKey(result)} result={result} />
                  ))}
                </div>

                {/* Pagination */}
                {meta && meta.totalPages > 1 && (
                  <div className="mt-6 flex justify-center gap-2">
                    <button
                      onClick={() => setFilters({ ...filters, page: (filters.page || 1) - 1 })}
                      disabled={filters.page === 1}
                      className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Anterior
                    </button>
                    <span className="px-4 py-2 text-gray-700 dark:text-gray-300">
                      Página {meta.page} de {meta.totalPages}
                    </span>
                    <button
                      onClick={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })}
                      disabled={filters.page === meta.totalPages}
                      className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Siguiente
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== RESULT CARD COMPONENT ====================

interface ResultCardProps {
  result: SearchResult;
}

function ResultCard({ result }: ResultCardProps) {
  const navigate = useNavigate();
  const sourceLabel = searchApi.getSourceLabel(result.source);
  const sourceColor = searchApi.getSourceColor(result.source);

  const handleBook = () => {
    // Navigate to booking flow (Phase 5)
    const params = new URLSearchParams({
      source: result.source.toLowerCase(),
      checkIn: result.dates.checkIn,
      checkOut: result.dates.checkOut,
      guests: String(result.unit.capacity),
    });
    
    if (result.source === 'TIMESHARE' && result.meta?.weekAllocationId) {
      // Timeshare booking
      params.append('weekId', String(result.meta.weekAllocationId));
      navigate(`/booking/create?${params.toString()}`);
    } else if (result.source === 'HOTEL_PMS') {
      // Hotel booking
      params.append('propertyId', String(result.property.id));
      params.append('category', result.unit.category);
      navigate(`/booking/create?${params.toString()}`);
    } else {
      toast.error('Error: Información de reserva no disponible');
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow p-6">
      <div className="flex items-start justify-between gap-4">
        {/* Main Content */}
        <div className="flex-1 space-y-4">
          {/* Header with Badge */}
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${sourceColor}`}>
              {sourceLabel}
            </span>
            {result.source === 'TIMESHARE' && (
              <Star className="h-5 w-5 text-yellow-500 fill-current" />
            )}
          </div>

          {/* Property Name & Location */}
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
              {result.property.name}
            </h3>
            <div className="flex items-center text-gray-600 dark:text-gray-400 text-sm">
              <MapPin className="h-4 w-4 mr-1" />
              {result.property.location}
            </div>
          </div>

          {/* Room Details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Categoría:</span>
              <div className="font-medium text-gray-900 dark:text-white">
                {result.unit.category}
              </div>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Capacidad:</span>
              <div className="font-medium text-gray-900 dark:text-white">
                {result.unit.capacity} personas
              </div>
            </div>
            {result.unit.bedrooms && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Habitaciones:</span>
                <div className="font-medium text-gray-900 dark:text-white">
                  {result.unit.bedrooms}
                </div>
              </div>
            )}
            <div>
              <span className="text-gray-500 dark:text-gray-400">Noches:</span>
              <div className="font-medium text-gray-900 dark:text-white">
                {result.dates.nights}
              </div>
            </div>
          </div>

          {/* Amenities */}
          {result.unit.amenities.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {result.unit.amenities.slice(0, 5).map((amenity, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded"
                >
                  {amenity}
                </span>
              ))}
              {result.unit.amenities.length > 5 && (
                <span className="px-2 py-1 text-gray-500 dark:text-gray-400 text-xs">
                  +{result.unit.amenities.length - 5} más
                </span>
              )}
            </div>
          )}

          {/* Dates */}
          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>{searchApi.formatDate(result.dates.checkIn)}</span>
            </div>
            <span>→</span>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>{searchApi.formatDate(result.dates.checkOut)}</span>
            </div>
          </div>
        </div>

        {/* Price & Action */}
        <div className="flex flex-col items-end gap-4">
          {/* Price */}
          <div className="text-right">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {result.price.credits}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">créditos</div>
            {result.price.cash && (
              <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                ({result.price.cash} {result.price.currency})
              </div>
            )}
          </div>

          {/* Book Button */}
          <button
            onClick={handleBook}
            disabled={!result.availability.available}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            Reservar
            <ChevronRight className="h-4 w-4" />
          </button>

          {/* Availability */}
          {result.availability.quantity > 1 && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {result.availability.quantity} disponibles
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SearchPageV2;
