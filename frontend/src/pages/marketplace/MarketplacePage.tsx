import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Calendar, MapPin, Coins, X, Check, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import * as marketplaceApi from '@/api/marketplace';
import type { InventoryItem, Week, ReleaseEstimate } from '@/api/marketplace';

export default function MarketplacePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  // State
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  
  // Filters (simplificado)
  const [startDate, setStartDate] = useState('');
  const [seasonType, setSeasonType] = useState('');
  
  // Week release state
  const [myWeeks, setMyWeeks] = useState<Week[]>([]);
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<Week | null>(null);
  const [releaseEstimate, setReleaseEstimate] = useState<ReleaseEstimate | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Cargar inventario disponible y mis semanas en paralelo
      const [inventory, eligible] = await Promise.all([
        marketplaceApi.searchInventory({ page: 1, pageSize: 20 }),
        marketplaceApi.getEligibleWeeks()
      ]);
      setItems(inventory.items);
      setMyWeeks(eligible.weeks);
    } catch (error: any) {
      console.error('Error loading data:', error);
    }
  };

  const handleSearch = async () => {
    setIsLoading(true);
    try {
      const result = await marketplaceApi.searchInventory({
        startDate: startDate || undefined,
        seasonType: seasonType as any || undefined,
        page: 1,
        pageSize: 20
      });
      setItems(result.items);
    } catch (error: any) {
      toast.error('Error al buscar semanas');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBookNow = (item: InventoryItem) => {
    setSelectedItem(item);
    setShowBookingModal(true);
  };

  const handleConfirmBooking = async () => {
    if (!selectedItem) return;

    const confirmed = window.confirm(
      `¿Confirmar reserva por ${selectedItem.credit_price} créditos?`
    );
    
    if (!confirmed) return;

    try {
      const result = await marketplaceApi.bookWithCredits({
        inventoryItemId: selectedItem.id,
        paymentType: 'credits_only',
        creditsToUse: selectedItem.credit_price
      });
      
      toast.success('¡Reserva confirmada!');
      setShowBookingModal(false);
      navigate(`/owner/bookings/${result.bookingId}`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al reservar');
    }
  };

  const handleReleaseWeek = async (week: Week) => {
    setSelectedWeek(week);
    try {
      const estimate = await marketplaceApi.estimateWeekValue(week.id);
      setReleaseEstimate(estimate);
      setShowReleaseModal(true);
    } catch (error: any) {
      toast.error('Error al calcular valor');
    }
  };

  const handleConfirmRelease = async () => {
    if (!selectedWeek) return;

    const confirmed = window.confirm(
      `¿Liberar semana por ${releaseEstimate?.estimatedCredits} créditos?`
    );
    
    if (!confirmed) return;

    try {
      const result = await marketplaceApi.releaseWeek(selectedWeek.id);
      toast.success(`¡Ganaste ${result.creditsEarned} créditos!`);
      setShowReleaseModal(false);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al liberar semana');
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Flexible';
    return new Date(date).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short'
    });
  };

  const getSeasonColor = (season: string) => {
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
        <div className="max-w-7xl mx-auto px-4 py-12">
          <h1 className="text-4xl font-bold mb-2">Marketplace de Semanas</h1>
          <p className="text-emerald-100 text-lg">
            Libera tus semanas o reserva con créditos
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Mis Semanas - Release Section */}
        {myWeeks.length > 0 && (
          <div className="bg-white rounded-xl shadow-md p-6 mb-8">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-emerald-600" />
              Libera tus Semanas
            </h2>
            <p className="text-gray-600 mb-6">
              Gana créditos liberando tus semanas al marketplace
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myWeeks.slice(0, 3).map((week) => (
                <div
                  key={week.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-emerald-500 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold text-gray-900">
                        Semana #{week.id}
                      </div>
                      <div className="text-sm text-gray-600">
                        {formatDate(week.start_date)} - {formatDate(week.end_date)}
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeasonColor(week.season_type)}`}>
                      {getSeasonLabel(week.season_type)}
                    </span>
                  </div>
                  
                  <button
                    onClick={() => handleReleaseWeek(week)}
                    className="w-full mt-3 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
                  >
                    Liberar por créditos
                  </button>
                </div>
              ))}
            </div>
            
            {myWeeks.length > 3 && (
              <button
                onClick={() => navigate('/owner/weeks')}
                className="mt-4 text-emerald-600 hover:text-emerald-700 font-medium text-sm"
              >
                Ver todas mis semanas ({myWeeks.length})
              </button>
            )}
          </div>
        )}

        {/* Búsqueda Simple */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4">Buscar Semanas Disponibles</h2>
          
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha de inicio
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Temporada
              </label>
              <select
                value={seasonType}
                onChange={(e) => setSeasonType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Todas</option>
                <option value="RED">Alta</option>
                <option value="WHITE">Media</option>
                <option value="BLUE">Baja</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleSearch}
                disabled={isLoading}
                className="px-8 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all font-medium flex items-center gap-2 disabled:opacity-50"
              >
                <Search className="h-5 w-5" />
                Buscar
              </button>
            </div>
          </div>
        </div>

        {/* Resultados */}
        <div>
          <h2 className="text-2xl font-bold mb-6">
            Semanas Disponibles ({items.length})
          </h2>
          
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl">
              <p className="text-gray-600">No hay semanas disponibles con estos filtros</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow"
                >
                  {/* Image placeholder */}
                  <div className="h-48 bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                    <MapPin className="h-12 w-12 text-white opacity-50" />
                  </div>

                  <div className="p-6">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-lg text-gray-900">
                        {item.property?.name || 'Propiedad'}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeasonColor(item.season_type)}`}>
                        {getSeasonLabel(item.season_type)}
                      </span>
                    </div>

                    <p className="text-gray-600 text-sm mb-4">
                      {item.property?.location || item.property?.city}
                    </p>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(item.start_date)} - {formatDate(item.end_date)}</span>
                      </div>
                      
                      {item.nights && (
                        <div className="text-sm text-gray-600">
                          {item.nights} noches • {item.accommodation_type}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                      <div className="flex items-center gap-2">
                        <Coins className="h-5 w-5 text-yellow-500" />
                        <span className="text-2xl font-bold text-emerald-600">
                          {item.credit_price}
                        </span>
                        <span className="text-sm text-gray-600">créditos</span>
                      </div>

                      <button
                        onClick={() => handleBookNow(item)}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                      >
                        Reservar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Booking Modal - Simplified */}
      {showBookingModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
              <h2 className="text-2xl font-bold">Confirmar Reserva</h2>
              <button
                onClick={() => setShowBookingModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Item Details */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-bold text-lg mb-2">{selectedItem.property?.name}</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {formatDate(selectedItem.start_date)} - {formatDate(selectedItem.end_date)}
                  </div>
                  <div>{selectedItem.nights} noches • {selectedItem.accommodation_type}</div>
                </div>
              </div>

              {/* Price */}
              <div className="bg-emerald-50 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Precio Total</div>
                    <div className="flex items-center gap-2">
                      <Coins className="h-6 w-6 text-yellow-500" />
                      <span className="text-3xl font-bold text-emerald-600">
                        {selectedItem.credit_price}
                      </span>
                      <span className="text-gray-600">créditos</span>
                    </div>
                  </div>
                  <Check className="h-12 w-12 text-emerald-600" />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <button
                  onClick={() => setShowBookingModal(false)}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmBooking}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all font-medium"
                >
                  Confirmar Reserva
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Release Modal - Simplified */}
      {showReleaseModal && selectedWeek && releaseEstimate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6 rounded-t-xl">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Liberar Semana</h2>
                <button
                  onClick={() => setShowReleaseModal(false)}
                  className="text-white hover:text-emerald-100"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Week Details */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-bold text-lg">Semana #{selectedWeek.id}</div>
                    <div className="text-sm text-gray-600">
                      {formatDate(selectedWeek.start_date)} - {formatDate(selectedWeek.end_date)}
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeasonColor(selectedWeek.season_type)}`}>
                    {getSeasonLabel(selectedWeek.season_type)}
                  </span>
                </div>
              </div>

              {/* Credits to Earn */}
              <div className="bg-emerald-50 rounded-lg p-6">
                <div className="text-center">
                  <div className="text-sm text-gray-600 mb-2">Ganarás</div>
                  <div className="flex items-center justify-center gap-2">
                    <Coins className="h-8 w-8 text-yellow-500" />
                    <span className="text-4xl font-bold text-emerald-600">
                      {releaseEstimate.estimatedCredits}
                    </span>
                    <span className="text-xl text-gray-600">créditos</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <button
                  onClick={() => setShowReleaseModal(false)}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmRelease}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all font-medium"
                >
                  Confirmar y Liberar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
