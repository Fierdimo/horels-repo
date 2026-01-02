import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Loader2, Save, Plus, Trash2, Edit, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Property {
  id: number;
  name: string;
  city: string;
  country: string;
  tier: 'DIAMOND' | 'GOLD' | 'SILVER_PLUS' | 'STANDARD';
  location_multiplier: number;
}

interface CreditCost {
  id: number;
  property_id: number;
  room_type: string;
  season_type: string;
  credits_per_night: number;
  effective_from: string;
  effective_until?: string;
  is_active: boolean;
  notes?: string;
  property?: {
    id: number;
    name: string;
    tier: string;
    location_multiplier: number;
  };
}

interface SystemDefaults {
  tiers: {
    [key: string]: {
      multiplier: number;
      description: string;
    };
  };
  room_types: {
    [key: string]: {
      multiplier: number;
      description: string;
    };
  };
  seasons: {
    [key: string]: {
      base_value: number;
      description: string;
    };
  };
}

interface SeasonalCalendar {
  id: number | null;
  property_id: number;
  season_type: 'RED' | 'WHITE' | 'BLUE';
  start_date: string;
  end_date: string;
  year: number;
  notes?: string;
  isDefault?: boolean;
}

const CreditConfiguration: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'properties' | 'costs' | 'defaults' | 'calendar'>('properties');

  // Properties state
  const [properties, setProperties] = useState<Property[]>([]);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);

  // Costs state
  const [costs, setCosts] = useState<CreditCost[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<number | null>(null);
  const [editingCost, setEditingCost] = useState<CreditCost | null>(null);

  // System defaults
  const [systemDefaults, setSystemDefaults] = useState<SystemDefaults | null>(null);
  const [editingDefault, setEditingDefault] = useState<{ category: string; key: string; value: number } | null>(null);

  // Seasonal calendar state
  const [seasonalCalendar, setSeasonalCalendar] = useState<SeasonalCalendar[]>([]);
  const [selectedPropertyForCalendar, setSelectedPropertyForCalendar] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [calendarForm, setCalendarForm] = useState({
    property_id: 0,
    season_type: 'WHITE' as 'RED' | 'WHITE' | 'BLUE',
    start_date: '',
    end_date: '',
    year: new Date().getFullYear(),
    notes: ''
  });

  // Form state for new/edit cost
  const [costForm, setCostForm] = useState({
    property_id: 0,
    room_type: 'STANDARD',
    season_type: 'WHITE',
    credits_per_night: 1,
    effective_from: new Date().toISOString().split('T')[0],
    effective_until: '',
    notes: ''
  });

  useEffect(() => {
    fetchProperties();
    fetchCosts();
    fetchDefaults();
  }, []);

  useEffect(() => {
    if (selectedPropertyForCalendar && selectedYear) {
      fetchSeasonalCalendar(selectedPropertyForCalendar, selectedYear);
    }
  }, [selectedPropertyForCalendar, selectedYear]);

  const fetchProperties = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('sw2_token');
      const response = await axios.get('/api/admin/credit-config/properties', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProperties(response.data.data);
    } catch (error: any) {
      console.error('Error fetching properties:', error);
      toast.error('Error al cargar propiedades');
    } finally {
      setLoading(false);
    }
  };

  const fetchCosts = async (propertyId?: number) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('sw2_token');
      const params = propertyId ? { property_id: propertyId } : {};
      const response = await axios.get('/api/admin/credit-config/costs', {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      setCosts(response.data.data);
    } catch (error: any) {
      console.error('Error fetching costs:', error);
      toast.error('Error al cargar configuraciones de créditos');
    } finally {
      setLoading(false);
    }
  };

  const fetchDefaults = async () => {
    try {
      const token = localStorage.getItem('sw2_token');
      const response = await axios.get('/api/admin/credit-config/defaults', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSystemDefaults(response.data.data);
    } catch (error: any) {
      console.error('Error fetching defaults:', error);
    }
  };

  const updateProperty = async (property: Property) => {
    try {
      const token = localStorage.getItem('sw2_token');
      await axios.put(
        `/api/admin/credit-config/properties/${property.id}`,
        {
          tier: property.tier,
          location_multiplier: property.location_multiplier
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      toast.success('Propiedad actualizada correctamente');
      fetchProperties();
      setEditingProperty(null);
    } catch (error: any) {
      console.error('Error updating property:', error);
      toast.error('Error al actualizar propiedad');
    }
  };

  const createCost = async () => {
    try {
      const token = localStorage.getItem('sw2_token');
      await axios.post(
        '/api/admin/credit-config/costs',
        costForm,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      toast.success('Configuración de créditos creada');
      fetchCosts(selectedProperty || undefined);
      setCostForm({
        property_id: 0,
        room_type: 'STANDARD',
        season_type: 'WHITE',
        credits_per_night: 1,
        effective_from: new Date().toISOString().split('T')[0],
        effective_until: '',
        notes: ''
      });
    } catch (error: any) {
      console.error('Error creating cost:', error);
      toast.error(error.response?.data?.message || 'Error al crear configuración');
    }
  };

  const updateCost = async (cost: CreditCost) => {
    try {
      const token = localStorage.getItem('sw2_token');
      await axios.put(
        `/api/admin/credit-config/costs/${cost.id}`,
        {
          credits_per_night: cost.credits_per_night,
          is_active: cost.is_active,
          notes: cost.notes
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      toast.success('Configuración actualizada');
      fetchCosts(selectedProperty || undefined);
      setEditingCost(null);
    } catch (error: any) {
      console.error('Error updating cost:', error);
      toast.error('Error al actualizar configuración');
    }
  };

  const deleteCost = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar esta configuración?')) return;
    
    try {
      const token = localStorage.getItem('sw2_token');
      await axios.delete(`/api/admin/credit-config/costs/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Configuración eliminada');
      fetchCosts(selectedProperty || undefined);
    } catch (error: any) {
      console.error('Error deleting cost:', error);
      toast.error('Error al eliminar configuración');
    }
  };

  const updateDefault = async () => {
    if (!editingDefault) return;

    try {
      const token = localStorage.getItem('sw2_token');
      await axios.put(
        '/api/admin/credit-config/defaults',
        editingDefault,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      toast.success('Valor actualizado correctamente');
      fetchDefaults();
      setEditingDefault(null);
    } catch (error: any) {
      console.error('Error updating default:', error);
      toast.error('Error al actualizar valor');
    }
  };

  const fetchSeasonalCalendar = async (propertyId: number, year: number) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('sw2_token');
      const response = await axios.get(`/api/credits/admin/seasonal-calendar/${propertyId}/${year}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSeasonalCalendar(response.data.data || []);
    } catch (error: any) {
      console.error('Error fetching seasonal calendar:', error);
      toast.error('Error al cargar calendario de temporadas');
    } finally {
      setLoading(false);
    }
  };

  const createCalendarEntry = async () => {
    if (!calendarForm.property_id || !calendarForm.start_date || !calendarForm.end_date) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    try {
      const token = localStorage.getItem('sw2_token');
      await axios.post(
        '/api/credits/admin/seasonal-calendar',
        {
          propertyId: calendarForm.property_id,
          seasonType: calendarForm.season_type,
          startDate: calendarForm.start_date,
          endDate: calendarForm.end_date,
          year: calendarForm.year
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      toast.success('Período de temporada creado');
      fetchSeasonalCalendar(calendarForm.property_id, calendarForm.year);
      setCalendarForm({
        property_id: calendarForm.property_id,
        season_type: 'WHITE',
        start_date: '',
        end_date: '',
        year: calendarForm.year,
        notes: ''
      });
    } catch (error: any) {
      console.error('Error creating calendar entry:', error);
      toast.error('Error al crear período');
    }
  };

  const deleteCalendarEntry = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este período?')) return;

    try {
      const token = localStorage.getItem('sw2_token');
      await axios.delete(`/api/credits/admin/seasonal-calendar/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Período eliminado');
      if (selectedPropertyForCalendar && selectedYear) {
        fetchSeasonalCalendar(selectedPropertyForCalendar, selectedYear);
      }
    } catch (error: any) {
      console.error('Error deleting calendar entry:', error);
      toast.error('Error al eliminar período');
    }
  };

  const getTierBadgeColor = (tier: string) => {
    const colors = {
      DIAMOND: 'bg-purple-100 text-purple-800',
      GOLD: 'bg-yellow-100 text-yellow-800',
      SILVER_PLUS: 'bg-gray-100 text-gray-800',
      STANDARD: 'bg-blue-100 text-blue-800'
    };
    return colors[tier as keyof typeof colors] || colors.STANDARD;
  };

  const getSeasonBadgeColor = (season: string) => {
    const colors = {
      RED: 'bg-red-100 text-red-800',
      WHITE: 'bg-gray-100 text-gray-800',
      BLUE: 'bg-blue-100 text-blue-800'
    };
    return colors[season as keyof typeof colors] || colors.WHITE;
  };

  if (loading && properties.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Configuración de Créditos</h1>
        <p className="text-gray-600 mt-1">
          Gestiona tiers de propiedades, multiplicadores y valores de créditos por noche
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('properties')}
            className={`${
              activeTab === 'properties'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Propiedades & Tiers
          </button>
          <button
            onClick={() => setActiveTab('costs')}
            className={`${
              activeTab === 'costs'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Costos por Noche
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`${
              activeTab === 'calendar'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Calendario Temporadas
          </button>
          <button
            onClick={() => setActiveTab('defaults')}
            className={`${
              activeTab === 'defaults'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Valores Sistema
          </button>
        </nav>
      </div>

      {/* Properties Tab */}
      {activeTab === 'properties' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Gestión de Tiers de Propiedades</h2>
            <p className="text-sm text-gray-600 mt-1">
              Configura el tier y multiplicador de ubicación para cada propiedad
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Propiedad
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Ubicación
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Tier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Multiplicador
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {properties.map((property) => (
                  <tr key={property.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {property.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {property.city}, {property.country}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingProperty?.id === property.id ? (
                        <select
                          value={editingProperty.tier}
                          onChange={(e) =>
                            setEditingProperty({
                              ...editingProperty,
                              tier: e.target.value as any
                            })
                          }
                          className="border rounded px-2 py-1 text-sm"
                        >
                          <option value="DIAMOND">DIAMOND (1.5x)</option>
                          <option value="GOLD">GOLD (1.3x)</option>
                          <option value="SILVER_PLUS">SILVER+ (1.1x)</option>
                          <option value="STANDARD">STANDARD (1.0x)</option>
                        </select>
                      ) : (
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTierBadgeColor(
                            property.tier
                          )}`}
                        >
                          {property.tier}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {editingProperty?.id === property.id ? (
                        <input
                          type="number"
                          step="0.01"
                          min="0.5"
                          max="3.0"
                          value={editingProperty.location_multiplier}
                          onChange={(e) =>
                            setEditingProperty({
                              ...editingProperty,
                              location_multiplier: parseFloat(e.target.value)
                            })
                          }
                          className="border rounded px-2 py-1 text-sm w-20"
                        />
                      ) : (
                        `${property.location_multiplier}x`
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {editingProperty?.id === property.id ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => updateProperty(editingProperty)}
                            className="text-green-600 hover:text-green-900"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setEditingProperty(null)}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingProperty(property)}
                          className="text-purple-600 hover:text-purple-900"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Costs Tab */}
      {activeTab === 'costs' && (
        <div className="space-y-6">
          {/* Filter by property */}
          <div className="bg-white rounded-lg shadow p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filtrar por Propiedad
            </label>
            <select
              value={selectedProperty || ''}
              onChange={(e) => {
                const val = e.target.value ? parseInt(e.target.value) : null;
                setSelectedProperty(val);
                fetchCosts(val || undefined);
              }}
              className="border rounded px-3 py-2 w-full"
            >
              <option value="">Todas las propiedades</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} - {(p as any).location || 'N/A'}
                </option>
              ))}
            </select>
          </div>

          {/* Create new cost */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold mb-4">Crear Nueva Configuración</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Propiedad
                </label>
                <select
                  value={costForm.property_id}
                  onChange={(e) =>
                    setCostForm({ ...costForm, property_id: parseInt(e.target.value) })
                  }
                  className="border rounded px-3 py-2 w-full"
                >
                  <option value={0}>Seleccionar...</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Habitación
                </label>
                <select
                  value={costForm.room_type}
                  onChange={(e) => setCostForm({ ...costForm, room_type: e.target.value })}
                  className="border rounded px-3 py-2 w-full"
                >
                  <option value="STANDARD">STANDARD</option>
                  <option value="SUPERIOR">SUPERIOR</option>
                  <option value="DELUXE">DELUXE</option>
                  <option value="SUITE">SUITE</option>
                  <option value="PRESIDENTIAL">PRESIDENTIAL</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Temporada
                </label>
                <select
                  value={costForm.season_type}
                  onChange={(e) => setCostForm({ ...costForm, season_type: e.target.value })}
                  className="border rounded px-3 py-2 w-full"
                >
                  <option value="RED">RED (Alta)</option>
                  <option value="WHITE">WHITE (Media)</option>
                  <option value="BLUE">BLUE (Baja)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Créditos por Noche
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={costForm.credits_per_night}
                  onChange={(e) =>
                    setCostForm({ ...costForm, credits_per_night: parseFloat(e.target.value) })
                  }
                  className="border rounded px-3 py-2 w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha Efectiva Desde
                </label>
                <input
                  type="date"
                  value={costForm.effective_from}
                  onChange={(e) =>
                    setCostForm({ ...costForm, effective_from: e.target.value })
                  }
                  className="border rounded px-3 py-2 w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha Efectiva Hasta (opcional)
                </label>
                <input
                  type="date"
                  value={costForm.effective_until}
                  onChange={(e) =>
                    setCostForm({ ...costForm, effective_until: e.target.value })
                  }
                  className="border rounded px-3 py-2 w-full"
                  placeholder="Si no se especifica, no expira"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas (opcional)
                </label>
                <input
                  type="text"
                  value={costForm.notes}
                  onChange={(e) => setCostForm({ ...costForm, notes: e.target.value })}
                  className="border rounded px-3 py-2 w-full"
                  placeholder="Notas adicionales..."
                />
              </div>
            </div>
            <button
              onClick={createCost}
              disabled={costForm.property_id === 0}
              className="mt-4 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Crear Configuración
            </button>
          </div>

          {/* Costs table */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">
                Configuraciones Existentes ({costs.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Propiedad
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Habitación
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Temporada
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Créditos/Noche
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Vigencia
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {costs.map((cost) => (
                    <tr key={cost.id} className={!cost.is_active ? 'bg-gray-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {cost.property?.name || `ID: ${cost.property_id}`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {cost.room_type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSeasonBadgeColor(
                            cost.season_type
                          )}`}
                        >
                          {cost.season_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {editingCost?.id === cost.id ? (
                          <input
                            type="number"
                            step="0.1"
                            value={editingCost.credits_per_night}
                            onChange={(e) =>
                              setEditingCost({
                                ...editingCost,
                                credits_per_night: parseFloat(e.target.value)
                              })
                            }
                            className="border rounded px-2 py-1 w-20"
                          />
                        ) : (
                          `${cost.credits_per_night} créditos`
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="text-xs">
                          <div>Desde: {new Date(cost.effective_from).toLocaleDateString()}</div>
                          {cost.effective_until && (
                            <div>Hasta: {new Date(cost.effective_until).toLocaleDateString()}</div>
                          )}
                          {!cost.effective_until && (
                            <div className="text-gray-400">Sin fecha de fin</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingCost?.id === cost.id ? (
                          <select
                            value={editingCost.is_active ? 'true' : 'false'}
                            onChange={(e) =>
                              setEditingCost({
                                ...editingCost,
                                is_active: e.target.value === 'true'
                              })
                            }
                            className="border rounded px-2 py-1 text-sm"
                          >
                            <option value="true">Activo</option>
                            <option value="false">Inactivo</option>
                          </select>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${
                              cost.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {cost.is_active ? (
                              <>
                                <CheckCircle className="h-3 w-3" />
                                Activo
                              </>
                            ) : (
                              <>
                                <AlertCircle className="h-3 w-3" />
                                Inactivo
                              </>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {editingCost?.id === cost.id ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => updateCost(editingCost)}
                              className="text-green-600 hover:text-green-900"
                            >
                              <Save className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setEditingCost(null)}
                              className="text-gray-600 hover:text-gray-900 text-xs"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setEditingCost(cost)}
                              className="text-purple-600 hover:text-purple-900"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => deleteCost(cost.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {costs.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No hay configuraciones creadas. Crea la primera configuración arriba.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Defaults Tab */}
      {activeTab === 'defaults' && systemDefaults && (
        <div className="space-y-6">
          {/* Tiers */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span>Tiers de Propiedades</span>
              <span className="text-sm font-normal text-gray-500">(Click para editar)</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(systemDefaults.tiers).map(([key, value]) => (
                <div key={key} className="border rounded-lg p-4 hover:border-purple-300 transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <span
                      className={`px-3 py-1 text-sm font-semibold rounded-full ${getTierBadgeColor(
                        key
                      )}`}
                    >
                      {key}
                    </span>
                    {editingDefault?.category === 'tier' && editingDefault?.key === key ? (
                      <div className="flex gap-2 items-center">
                        <input
                          type="number"
                          step="0.1"
                          value={editingDefault.value}
                          onChange={(e) =>
                            setEditingDefault({
                              ...editingDefault,
                              value: parseFloat(e.target.value)
                            })
                          }
                          className="border rounded px-2 py-1 w-20 text-sm"
                        />
                        <button
                          onClick={updateDefault}
                          className="text-green-600 hover:text-green-900"
                        >
                          <Save className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setEditingDefault(null)}
                          className="text-gray-600 hover:text-gray-900 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() =>
                          setEditingDefault({
                            category: 'tier',
                            key,
                            value: value.multiplier
                          })
                        }
                        className="text-lg font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1"
                      >
                        {value.multiplier}x
                        <Edit className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{value.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Room Types */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span>Multiplicadores por Tipo de Habitación</span>
              <span className="text-sm font-normal text-gray-500">(Click para editar)</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(systemDefaults.room_types).map(([key, value]) => (
                <div key={key} className="border rounded-lg p-4 hover:border-purple-300 transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-gray-900">{key}</span>
                    {editingDefault?.category === 'room' && editingDefault?.key === key ? (
                      <div className="flex gap-2 items-center">
                        <input
                          type="number"
                          step="0.1"
                          value={editingDefault.value}
                          onChange={(e) =>
                            setEditingDefault({
                              ...editingDefault,
                              value: parseFloat(e.target.value)
                            })
                          }
                          className="border rounded px-2 py-1 w-20 text-sm"
                        />
                        <button
                          onClick={updateDefault}
                          className="text-green-600 hover:text-green-900"
                        >
                          <Save className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setEditingDefault(null)}
                          className="text-gray-600 hover:text-gray-900 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() =>
                          setEditingDefault({
                            category: 'room',
                            key,
                            value: value.multiplier
                          })
                        }
                        className="text-lg font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1"
                      >
                        {value.multiplier}x
                        <Edit className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{value.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Seasons */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span>Valores Base por Temporada</span>
              <span className="text-sm font-normal text-gray-500">(Click para editar)</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(systemDefaults.seasons).map(([key, value]) => (
                <div key={key} className="border rounded-lg p-4 hover:border-purple-300 transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <span
                      className={`px-3 py-1 text-sm font-semibold rounded-full ${getSeasonBadgeColor(
                        key
                      )}`}
                    >
                      {key}
                    </span>
                    {editingDefault?.category === 'season' && editingDefault?.key === key ? (
                      <div className="flex gap-2 items-center">
                        <input
                          type="number"
                          step="10"
                          value={editingDefault.value}
                          onChange={(e) =>
                            setEditingDefault({
                              ...editingDefault,
                              value: parseFloat(e.target.value)
                            })
                          }
                          className="border rounded px-2 py-1 w-24 text-sm"
                        />
                        <button
                          onClick={updateDefault}
                          className="text-green-600 hover:text-green-900"
                        >
                          <Save className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setEditingDefault(null)}
                          className="text-gray-600 hover:text-gray-900 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() =>
                          setEditingDefault({
                            category: 'season',
                            key,
                            value: value.base_value
                          })
                        }
                        className="text-lg font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1"
                      >
                        {value.base_value}
                        <Edit className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{value.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Info banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-2">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">
                  Valores del Sistema de Créditos - Editables
                </h3>
                <p className="text-sm text-blue-800">
                  Estos valores se utilizan como base para todos los cálculos de conversión de créditos.
                  Los cambios se aplicarán inmediatamente a todos los cálculos futuros. Los multiplicadores
                  de tier y ubicación se aplican sobre estos valores base.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Tab */}
      {activeTab === 'calendar' && (
        <div className="space-y-6">
          {/* Property and Year selector */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Seleccionar Propiedad y Año</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Propiedad
                </label>
                <select
                  value={selectedPropertyForCalendar || ''}
                  onChange={(e) => {
                    const propId = parseInt(e.target.value);
                    setSelectedPropertyForCalendar(propId);
                    setCalendarForm({ ...calendarForm, property_id: propId });
                  }}
                  className="border rounded px-3 py-2 w-full"
                >
                  <option value="">Selecciona una propiedad</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} - {p.city}, {p.country}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Año
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => {
                    const year = parseInt(e.target.value);
                    setSelectedYear(year);
                    setCalendarForm({ ...calendarForm, year });
                  }}
                  className="border rounded px-3 py-2 w-full"
                >
                  {[2024, 2025, 2026, 2027, 2028].map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Create new period */}
          {selectedPropertyForCalendar && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Crear Nuevo Período de Temporada</h2>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Temporada
                  </label>
                  <select
                    value={calendarForm.season_type}
                    onChange={(e) =>
                      setCalendarForm({
                        ...calendarForm,
                        season_type: e.target.value as 'RED' | 'WHITE' | 'BLUE'
                      })
                    }
                    className="border rounded px-3 py-2 w-full"
                  >
                    <option value="RED">RED (Alta)</option>
                    <option value="WHITE">WHITE (Media)</option>
                    <option value="BLUE">BLUE (Baja)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha Inicio
                  </label>
                  <input
                    type="date"
                    value={calendarForm.start_date}
                    onChange={(e) =>
                      setCalendarForm({ ...calendarForm, start_date: e.target.value })
                    }
                    className="border rounded px-3 py-2 w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha Fin
                  </label>
                  <input
                    type="date"
                    value={calendarForm.end_date}
                    onChange={(e) =>
                      setCalendarForm({ ...calendarForm, end_date: e.target.value })
                    }
                    min={calendarForm.start_date}
                    className="border rounded px-3 py-2 w-full"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={createCalendarEntry}
                    className="w-full bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 flex items-center justify-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Crear
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Calendar entries table */}
          {selectedPropertyForCalendar && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold">
                  Períodos Configurados ({seasonalCalendar.length})
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Temporada
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Fecha Inicio
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Fecha Fin
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Duración
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Estado
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {seasonalCalendar.map((entry, idx) => {
                      const start = new Date(entry.start_date);
                      const end = new Date(entry.end_date);
                      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                      
                      return (
                        <tr key={entry.id || idx} className={entry.isDefault ? 'bg-blue-50' : ''}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSeasonBadgeColor(
                                entry.season_type
                              )}`}
                            >
                              {entry.season_type}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(entry.start_date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(entry.end_date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {days} días
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {entry.isDefault ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">
                                <AlertCircle className="h-3 w-3" />
                                Por defecto
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                                <CheckCircle className="h-3 w-3" />
                                Configurado
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            {entry.isDefault ? (
                              <button
                                onClick={async () => {
                                  // Save default as real entry
                                  try {
                                    const token = localStorage.getItem('sw2_token');
                                    await axios.post(
                                      '/api/credits/admin/seasonal-calendar',
                                      {
                                        propertyId: entry.property_id,
                                        seasonType: entry.season_type,
                                        startDate: entry.start_date,
                                        endDate: entry.end_date,
                                        year: entry.year
                                      },
                                      {
                                        headers: { Authorization: `Bearer ${token}` }
                                      }
                                    );
                                    toast.success('Período guardado');
                                    fetchSeasonalCalendar(entry.property_id, entry.year);
                                  } catch (error: any) {
                                    console.error('Error saving default:', error);
                                    toast.error('Error al guardar período');
                                  }
                                }}
                                className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                              >
                                <Save className="h-4 w-4" />
                                Guardar
                              </button>
                            ) : (
                              <button
                                onClick={() => entry.id && deleteCalendarEntry(entry.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {seasonalCalendar.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                          No hay períodos configurados para este año. Crea el primer período arriba.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Info banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-2">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">
                  Calendario de Temporadas
                </h3>
                <p className="text-sm text-blue-800 mb-2">
                  Cada propiedad tiene un calendario por defecto que cubre todo el año con períodos RED (alta), 
                  WHITE (media) y BLUE (baja). Estos períodos determinan el valor base de créditos.
                </p>
                <ul className="text-sm text-blue-800 list-disc list-inside space-y-1">
                  <li>Los períodos marcados como <strong>"Por defecto"</strong> son sugerencias que puedes guardar o modificar</li>
                  <li>Puedes crear nuevos períodos o editar los existentes según tus necesidades</li>
                  <li>Los períodos <strong>"Configurado"</strong> son personalizados y están guardados en el sistema</li>
                  <li>Si no seleccionas una propiedad, usa el selector arriba para comenzar</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreditConfiguration;
