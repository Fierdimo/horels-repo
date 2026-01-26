import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Filter, Calendar, MapPin, Star, Coins, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import * as marketplaceApi from '@/api/marketplace';
import type { InventoryItem, SearchFilters } from '@/api/marketplace';

export function InventorySearchPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState<SearchFilters>({
    page: 1,
    pageSize: 12
  });

  useEffect(() => {
    searchInventory();
  }, [filters.page]);

  const searchInventory = async () => {
    setIsLoading(true);
    try {
      const result = await marketplaceApi.searchInventory(filters);
      setItems(result.items);
      setTotalPages(result.totalPages);
      setCurrentPage(result.page);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al buscar semanas');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    setFilters({ ...filters, page: 1 });
    searchInventory();
  };

  const handleReset = () => {
    setFilters({ page: 1, pageSize: 12 });
    searchInventory();
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Flexible';
    return new Date(date).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short'
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
      case 'RED': return 'Alta';
      case 'WHITE': return 'Media';
      case 'BLUE': return 'Baja';
      default: return season;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-4xl font-bold mb-2">Marketplace de Créditos</h1>
          <p className="text-emerald-100 text-lg">
            Busca y reserva semanas disponibles con tus créditos
          </p>

          {/* Quick Stats */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white bg-opacity-20 rounded-lg p-4">
              <div className="text-2xl font-bold">{items.length}</div>
              <div className="text-emerald-100 text-sm">Semanas disponibles</div>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-4">
              <div className="text-2xl font-bold">{totalPages}</div>
              <div className="text-emerald-100 text-sm">Páginas de resultados</div>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-4">
              <div className="text-2xl font-bold">24/7</div>
              <div className="text-emerald-100 text-sm">Reserva instantánea</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Bar */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Dates */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha de inicio
              </label>
              <input
                type="date"
                value={filters.startDate || ''}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha de fin
              </label>
              <input
                type="date"
                value={filters.endDate || ''}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            {/* Season */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Temporada
              </label>
              <select
                value={filters.seasonType || ''}
                onChange={(e) => setFilters({ ...filters, seasonType: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="">Todas</option>
                <option value="RED">Alta</option>
                <option value="WHITE">Media</option>
                <option value="BLUE">Baja</option>
              </select>
            </div>

            {/* Actions */}
            <div className="flex gap-2 items-end">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Filter className="h-5 w-5" />
              </button>
              <button
                onClick={handleSearch}
                className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all font-medium flex items-center gap-2"
              >
                <Search className="h-5 w-5" />
                Buscar
              </button>
            </div>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="mt-6 pt-6 border-t border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Alojamiento
                </label>
                <select
                  value={filters.accommodationType || ''}
                  onChange={(e) => setFilters({ ...filters, accommodationType: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Todos</option>
                  <option value="studio">Studio</option>
                  <option value="1bedroom">1 Habitación</option>
                  <option value="2bedroom">2 Habitaciones</option>
                  <option value="suite">Suite</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Créditos Mínimos
                </label>
                <input
                  type="number"
                  value={filters.minCredits || ''}
                  onChange={(e) => setFilters({ ...filters, minCredits: parseInt(e.target.value) || undefined })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="Mín"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Créditos Máximos
                </label>
                <input
                  type="number"
                  value={filters.maxCredits || ''}
                  onChange={(e) => setFilters({ ...filters, maxCredits: parseInt(e.target.value) || undefined })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="Máx"
                />
              </div>

              <div className="md:col-span-3 flex gap-2">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Limpiar Filtros
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-2 border-emerald-600"></div>
            <p className="mt-4 text-gray-600">Buscando semanas disponibles...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow">
            <Search className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No se encontraron semanas</h3>
            <p className="text-gray-600">Intenta ajustar los filtros de búsqueda</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow cursor-pointer overflow-hidden"
                  onClick={() => navigate(`/marketplace/${item.id}`)}
                >
                  {/* Image Placeholder */}
                  <div className="h-48 bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                    <MapPin className="h-16 w-16 text-white opacity-50" />
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-lg font-bold text-gray-900">
                        {item.property?.name || 'Propiedad'}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeasonBadgeColor(item.season_type)}`}>
                        {getSeasonLabel(item.season_type)}
                      </span>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-gray-600 text-sm">
                        <Calendar className="h-4 w-4" />
                        {item.start_date ? (
                          <span>{formatDate(item.start_date)} - {formatDate(item.end_date)}</span>
                        ) : (
                          <span>{item.nights} noches (flexible)</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-gray-600 text-sm">
                        <MapPin className="h-4 w-4" />
                        <span className="capitalize">{item.accommodation_type}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                      <div>
                        <div className="text-2xl font-bold text-emerald-600 flex items-center gap-1">
                          <Coins className="h-5 w-5" />
                          {item.credit_price.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">créditos</div>
                      </div>

                      <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 text-sm font-medium">
                        Ver detalles
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex justify-center gap-2">
                <button
                  onClick={() => setFilters({ ...filters, page: Math.max(1, currentPage - 1) })}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Anterior
                </button>
                
                <div className="flex items-center gap-2">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = i + 1;
                    return (
                      <button
                        key={page}
                        onClick={() => setFilters({ ...filters, page })}
                        className={`px-4 py-2 rounded-lg ${
                          currentPage === page
                            ? 'bg-emerald-600 text-white'
                            : 'border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setFilters({ ...filters, page: Math.min(totalPages, currentPage + 1) })}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Siguiente
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
