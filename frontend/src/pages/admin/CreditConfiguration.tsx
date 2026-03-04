import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '@/api/client';
import { creditConfigAPI } from '@/api/creditConfig';
import { useTranslation } from 'react-i18next';
import { Loader2, Save, Plus, Trash2, Edit, AlertCircle, CheckCircle,
  RotateCcw, DollarSign, Building2, Bed, Calculator, TrendingUp, TrendingDown, Minus, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Property {
  id: number;
  name: string;
  city: string;
  country: string;
  tier?: 'DIAMOND' | 'GOLD' | 'SILVER_PLUS' | 'STANDARD';
  location_multiplier?: number;
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
    tier?: string;
    location_multiplier?: number;
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

interface CreditFormulaConfig {
  base_seasons: Record<string, number>;
  base_nightly: Record<string, number>;
  tier_multipliers: Record<string, number>;
  room_multipliers: Record<string, number>;
  other: Record<string, number>;
}

const CreditConfiguration: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  /**
   * Parse a DATEONLY value ("YYYY-MM-DD" string or Date) as LOCAL midnight.
   * Avoids UTC↔local timezone shift that causes dates to appear 1-2 days off.
   */
  const parseDateOnly = (val: Date | string): Date => {
    if (typeof val === 'string') {
      // Handles "2026-03-01" and "2026-03-01T00:00:00.000Z"
      const clean = val.split('T')[0];
      const [y, m, d] = clean.split('-').map(Number);
      return new Date(y, m - 1, d); // local midnight, no UTC offset
    }
    // Date object: use LOCAL date methods (NOT toISOString which is UTC-based)
    return new Date(val.getFullYear(), val.getMonth(), val.getDate());
  };

  /**
   * Format a date value as DD/MM/YYYY — unambiguous regardless of browser locale.
   */
  const formatDate = (val: Date | string): string => {
    const d = parseDateOnly(val);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };
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

  // Formula config (V2 - CreditConfigPage)
  const [formulaConfig, setFormulaConfig] = useState<CreditFormulaConfig | null>(null);
  const [formulaChanges, setFormulaChanges] = useState<Record<string, number>>({});
  const [formulaSaving, setFormulaSaving] = useState(false);
  const [formulaError, setFormulaError] = useState<string | null>(null);
  const [formulaSuccess, setFormulaSuccess] = useState<string | null>(null);

  // Seasonal calendar state
  const [seasonalCalendar, setSeasonalCalendar] = useState<SeasonalCalendar[]>([]);
  const [selectedPropertyForCalendar, setSelectedPropertyForCalendar] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [applyingDefaults, setApplyingDefaults] = useState(false);
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
    loadFormulaConfig();
  }, []);

  useEffect(() => {
    if (selectedPropertyForCalendar && selectedYear) {
      fetchSeasonalCalendar(selectedPropertyForCalendar, selectedYear);
    }
  }, [selectedPropertyForCalendar, selectedYear]);

  const fetchProperties = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/admin/credit-config/properties');
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
      const params = propertyId ? { property_id: propertyId } : {};
      const response = await apiClient.get('/api/admin/credit-config/costs', { params });
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
      const response = await apiClient.get('/api/admin/credit-config/defaults');
      setSystemDefaults(response.data.data);
    } catch (error: any) {
      console.error('Error fetching defaults:', error);
    }
  };

  const updateProperty = async (property: Property) => {
    try {
      await apiClient.put(
        `/api/admin/credit-config/properties/${property.id}`,
        { tier: property.tier }
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
      await apiClient.post('/api/admin/credit-config/costs', costForm);
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
      await apiClient.put(
        `/api/admin/credit-config/costs/${cost.id}`,
        { credits_per_night: cost.credits_per_night, is_active: cost.is_active, notes: cost.notes }
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
      await apiClient.delete(`/api/admin/credit-config/costs/${id}`);
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
      await apiClient.put('/api/admin/credit-config/defaults', editingDefault);
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
      const response = await apiClient.get(`/api/credits/admin/seasonal-calendar/${propertyId}/${year}`);
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
      await apiClient.post('/api/credits/admin/seasonal-calendar', {
        propertyId: calendarForm.property_id,
        seasonType: calendarForm.season_type,
        startDate: calendarForm.start_date,
        endDate: calendarForm.end_date,
        year: calendarForm.year
      });
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
      await apiClient.delete(`/api/credits/admin/seasonal-calendar/${id}`);
      toast.success('Período eliminado');
      if (selectedPropertyForCalendar && selectedYear) {
        fetchSeasonalCalendar(selectedPropertyForCalendar, selectedYear);
      }
    } catch (error: any) {
      console.error('Error deleting calendar entry:', error);
      toast.error('Error al eliminar período');
    }
  };

  const applyDefaultCalendar = async () => {
    if (!selectedPropertyForCalendar) return;
    if (!confirm(t('admin.creditConfig.calApplyDefaultsConfirm'))) return;

    try {
      setApplyingDefaults(true);
      await apiClient.post('/api/credits/admin/seasonal-calendar/apply-defaults', {
        propertyId: selectedPropertyForCalendar,
        year: selectedYear
      });
      toast.success(t('admin.creditConfig.calApplyDefaultsSuccess'));
      fetchSeasonalCalendar(selectedPropertyForCalendar, selectedYear);
    } catch (error: any) {
      const msg = error.response?.data?.error || 'Error al aplicar defaults';
      toast.error(msg);
    } finally {
      setApplyingDefaults(false);
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

  // ─── Formula Config (V2) ───────────────────────────────────────────────
  const loadFormulaConfig = async () => {
    try {
      const data = await creditConfigAPI.getConfiguration();
      setFormulaConfig(data);
      setFormulaChanges({});
    } catch (err: any) {
      console.error('Error loading formula config:', err);
    }
  };

  const getFormulaValue = (section: keyof CreditFormulaConfig, key: string): number => {
    const prefix = section === 'base_seasons' ? 'BASE_SEASON_'
      : section === 'base_nightly' ? 'BASE_NIGHTLY_'
      : section === 'tier_multipliers' ? 'TIER_'
      : 'ROOM_';
    const fullKey = `${prefix}${key}`;
    return formulaChanges[fullKey] ?? formulaConfig?.[section]?.[key] ?? 0;
  };

  const handleFormulaValueChange = (key: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) setFormulaChanges(prev => ({ ...prev, [key]: numValue }));
  };

  const handleFormulaSave = async () => {
    if (Object.keys(formulaChanges).length === 0) {
      setFormulaError('No hay cambios para guardar.');
      return;
    }
    try {
      setFormulaSaving(true);
      setFormulaError(null);
      await creditConfigAPI.updateConfiguration(formulaChanges);
      setFormulaSuccess(`${Object.keys(formulaChanges).length} valor(es) guardado(s)`);
      await loadFormulaConfig();
      setTimeout(() => setFormulaSuccess(null), 3000);
    } catch (err: any) {
      setFormulaError(err.response?.data?.message || 'Error al guardar.');
    } finally {
      setFormulaSaving(false);
    }
  };

  const handleFormulaReset = async () => {
    if (!confirm('¿Restablecer todos los valores a los valores por defecto del sistema?')) return;
    try {
      setFormulaSaving(true);
      setFormulaError(null);
      await creditConfigAPI.resetToDefaults();
      setFormulaSuccess('Valores restablecidos.');
      await loadFormulaConfig();
      setTimeout(() => setFormulaSuccess(null), 3000);
    } catch (err: any) {
      setFormulaError(err.response?.data?.message || 'Error al restablecer.');
    } finally {
      setFormulaSaving(false);
    }
  };

  const formulaPreview = useMemo(() => {
    if (!formulaConfig) return null;
    const getVal = (section: keyof CreditFormulaConfig, key: string) => {
      const prefix = section === 'base_seasons' ? 'BASE_SEASON_'
        : section === 'base_nightly' ? 'BASE_NIGHTLY_'
        : section === 'tier_multipliers' ? 'TIER_'
        : 'ROOM_';
      return formulaChanges[`${prefix}${key}`] ?? formulaConfig?.[section]?.[key] ?? 0;
    };
    const WEEKS_NIGHTS = 7;
    const seasons = ['RED', 'WHITE', 'BLUE'] as const;
    const rooms = ['STANDARD', 'SUPERIOR', 'DELUXE', 'SUITE', 'PRESIDENTIAL'] as const;
    const rows = seasons.flatMap(season =>
      rooms.map(room => {
        const baseSeason = getVal('base_seasons', season);
        const baseNightly = getVal('base_nightly', season);
        const roomMult = getVal('room_multipliers', room);
        const depositCredits = Math.round(baseSeason * 1.0 * 1.0 * roomMult);
        const costFor7Nights = Math.round(baseNightly * roomMult * WEEKS_NIGHTS);
        const balance = depositCredits - costFor7Nights;
        return { season, room, depositCredits, costFor7Nights, balance };
      })
    );
    return { rows, hasDeficit: rows.some(r => r.balance < 0) };
  }, [formulaConfig, formulaChanges]);

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
        <h1 className="text-2xl font-bold text-gray-900">{t('admin.creditConfig.pageTitle')}</h1>
        <p className="text-gray-600 mt-1">
          {t('admin.creditConfig.pageSubtitle')}
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
            {t('admin.creditConfig.tabCosts')}
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`${
              activeTab === 'calendar'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            {t('admin.creditConfig.tabCalendar')}
          </button>
          <button
            onClick={() => setActiveTab('defaults')}
            className={`${
              activeTab === 'defaults'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            {t('admin.creditConfig.tabFormula')}
          </button>
        </nav>
      </div>

      {/* Properties Tab */}
      {activeTab === 'properties' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">{t('admin.creditConfig.propTitle')}</h2>
            <p className="text-sm text-gray-600 mt-1">
              {t('admin.creditConfig.propSubtitle')}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('admin.creditConfig.colProperty')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('admin.creditConfig.colLocation')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('admin.creditConfig.colTier')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('admin.creditConfig.colTierMultiplier')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    {t('admin.creditConfig.colActions')}
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
                          value={editingProperty.tier || 'STANDARD'}
                          onChange={(e) =>
                            setEditingProperty({
                              ...editingProperty,
                              tier: e.target.value as any
                            })
                          }
                          className="border rounded px-2 py-1 text-sm"
                        >
                          {(['DIAMOND', 'GOLD', 'SILVER_PLUS', 'STANDARD'] as const).map((t) => (
                            <option key={t} value={t}>
                              {t} ({(formulaConfig?.tier_multipliers[t] ?? (t === 'DIAMOND' ? 1.5 : t === 'GOLD' ? 1.3 : t === 'SILVER_PLUS' ? 1.1 : 1.0)).toFixed(2)}x)
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTierBadgeColor(
                            property.tier || 'STANDARD'
                          )}`}
                        >
                          {property.tier || 'STANDARD'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {(() => {
                        const tier = (editingProperty?.id === property.id ? editingProperty.tier : property.tier) || 'STANDARD';
                        const mult = formulaConfig?.tier_multipliers[tier] ?? (tier === 'DIAMOND' ? 1.5 : tier === 'GOLD' ? 1.3 : tier === 'SILVER_PLUS' ? 1.1 : 1.0);
                        return (
                          <span className="font-mono font-semibold text-purple-700">{mult.toFixed(2)}x</span>
                        );
                      })()}
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
                            className="text-gray-400 hover:text-gray-700"
                            title="Cancelar"
                          >
                            <X className="h-4 w-4" />
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
        <div className="space-y-5">

          {/* Context banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-900">{t('admin.creditConfig.costsInfoTitle')}</p>
              <p className="text-sm text-blue-700 mt-0.5">
                {t('admin.creditConfig.costsInfoDesc')}
              </p>
            </div>
          </div>

          {/* New cost form */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{t('admin.creditConfig.newRuleTitle')}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{t('admin.creditConfig.newRuleSubtitle')}</p>
              </div>
            </div>
            <div className="p-5">
              {/* Row 1: what */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    {t('admin.creditConfig.labelProperty')} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={costForm.property_id}
                    onChange={(e) => setCostForm({ ...costForm, property_id: parseInt(e.target.value) })}
                    className="border rounded-lg px-3 py-2 w-full text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value={0}>{t('admin.creditConfig.selectProperty')}</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    {t('admin.creditConfig.labelRoomType')} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={costForm.room_type}
                    onChange={(e) => setCostForm({ ...costForm, room_type: e.target.value })}
                    className="border rounded-lg px-3 py-2 w-full text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="STANDARD">Standard</option>
                    <option value="SUPERIOR">Superior</option>
                    <option value="DELUXE">Deluxe</option>
                    <option value="SUITE">Suite</option>
                    <option value="PRESIDENTIAL">Presidential</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    {t('admin.creditConfig.labelSeason')} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={costForm.season_type}
                    onChange={(e) => setCostForm({ ...costForm, season_type: e.target.value })}
                    className="border rounded-lg px-3 py-2 w-full text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="RED">🔴 {t('admin.creditConfig.seasonHigh')}</option>
                    <option value="WHITE">⚪ {t('admin.creditConfig.seasonMid')}</option>
                    <option value="BLUE">🔵 {t('admin.creditConfig.seasonLow')}</option>
                  </select>
                </div>
              </div>

              {/* Row 2: how much + when */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    {t('admin.creditConfig.labelCreditsPerNight')} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={costForm.credits_per_night}
                      onChange={(e) => setCostForm({ ...costForm, credits_per_night: parseFloat(e.target.value) })}
                      className="border rounded-lg px-3 py-2 w-full text-sm pr-20 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-gray-400">{t('admin.creditConfig.credits')}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    {t('admin.creditConfig.labelValidFrom')}
                  </label>
                  <input
                    type="date"
                    value={costForm.effective_from}
                    onChange={(e) => setCostForm({ ...costForm, effective_from: e.target.value })}
                    className="border rounded-lg px-3 py-2 w-full text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    {t('admin.creditConfig.labelValidUntil')} <span className="text-gray-400 font-normal">{t('admin.creditConfig.labelOptional')}</span>
                  </label>
                  <input
                    type="date"
                    value={costForm.effective_until}
                    onChange={(e) => setCostForm({ ...costForm, effective_until: e.target.value })}
                    className="border rounded-lg px-3 py-2 w-full text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Sin expiración"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <input
                  type="text"
                  value={costForm.notes}
                  onChange={(e) => setCostForm({ ...costForm, notes: e.target.value })}
                  placeholder={t('admin.creditConfig.labelNotes')}
                  className="border rounded-lg px-3 py-2 flex-1 text-sm text-gray-600 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button
                  onClick={createCost}
                  disabled={costForm.property_id === 0}
                  className="flex items-center gap-2 bg-purple-600 text-white px-5 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium whitespace-nowrap"
                >
                  <Plus className="h-4 w-4" />
                  {t('admin.creditConfig.addRule')}
                </button>
              </div>
            </div>
          </div>

          {/* Existing costs */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-gray-900">
                  {t('admin.creditConfig.configuredRulesTitle')}
                  {costs.length > 0 && (
                    <span className="ml-2 text-xs font-medium bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                      {costs.length}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">{t('admin.creditConfig.configuredRulesSubtitle')}</p>
              </div>
              <select
                value={selectedProperty || ''}
                onChange={(e) => {
                  const val = e.target.value ? parseInt(e.target.value) : null;
                  setSelectedProperty(val);
                  fetchCosts(val || undefined);
                }}
                className="border rounded-lg px-3 py-2 text-sm w-56 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">{t('admin.creditConfig.allProperties')}</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {costs.length === 0 ? (
              <div className="py-16 flex flex-col items-center text-center gap-3">
                <div className="h-14 w-14 rounded-full bg-gray-100 flex items-center justify-center">
                  <Bed className="h-7 w-7 text-gray-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-700">{t('admin.creditConfig.noRulesTitle')}</p>
                  <p className="text-sm text-gray-400 mt-1 max-w-xs">
                    {t('admin.creditConfig.noRulesDesc')}
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('admin.creditConfig.colProperty')}</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('admin.creditConfig.colRoom')}</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('admin.creditConfig.labelSeason')}</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('admin.creditConfig.colCostPerNight')}</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('admin.creditConfig.colValidity')}</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('admin.creditConfig.colStatus')}</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('admin.creditConfig.colActions')}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {costs.map((cost) => (
                      <tr key={cost.id} className={!cost.is_active ? 'opacity-50' : 'hover:bg-gray-50'}>
                        <td className="px-5 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                          {cost.property?.name || `ID: ${cost.property_id}`}
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-600 whitespace-nowrap">{cost.room_type}</td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${getSeasonBadgeColor(cost.season_type)}`}>
                            {cost.season_type}
                          </span>
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          {editingCost?.id === cost.id ? (
                            <input
                              type="number"
                              step="0.1"
                              value={editingCost.credits_per_night}
                              onChange={(e) => setEditingCost({ ...editingCost, credits_per_night: parseFloat(e.target.value) })}
                              className="border rounded px-2 py-1 w-24 text-sm"
                            />
                          ) : (
                            <span className="text-sm font-semibold text-gray-900">{cost.credits_per_night}</span>
                          )}
                          {editingCost?.id !== cost.id && <span className="text-xs text-gray-400 ml-1">{t('admin.creditConfig.creditsUnit')}</span>}
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">
                          <span>{formatDate(cost.effective_from)}</span>
                          {cost.effective_until
                            ? <span> → {formatDate(cost.effective_until)}</span>
                            : <span className="text-gray-400"> → {t('admin.creditConfig.noEndDate')}</span>
                          }
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          {editingCost?.id === cost.id ? (
                            <select
                              value={editingCost.is_active ? 'true' : 'false'}
                              onChange={(e) => setEditingCost({ ...editingCost, is_active: e.target.value === 'true' })}
                              className="border rounded px-2 py-1 text-sm"
                            >
                              <option value="true">{t('admin.creditConfig.statusActive')}</option>
                              <option value="false">{t('admin.creditConfig.statusInactive')}</option>
                            </select>
                          ) : (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full ${cost.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                              {cost.is_active ? <><CheckCircle className="h-3 w-3" />{t('admin.creditConfig.statusActive')}</> : <><AlertCircle className="h-3 w-3" />{t('admin.creditConfig.statusInactive')}</>}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap text-right">
                          {editingCost?.id === cost.id ? (
                            <div className="flex justify-end gap-2">
                              <button onClick={() => updateCost(editingCost)} className="text-green-600 hover:text-green-800"><Save className="h-4 w-4" /></button>
                              <button onClick={() => setEditingCost(null)} className="text-xs text-gray-500 hover:text-gray-700">{t('admin.creditConfig.cancel')}</button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <button onClick={() => setEditingCost(cost)} className="text-purple-600 hover:text-purple-800"><Edit className="h-4 w-4" /></button>
                              <button onClick={() => deleteCost(cost.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Defaults / Formula Global Tab */}
      {activeTab === 'defaults' && (
        <div className="space-y-6">
          {/* Header with actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{t('admin.creditConfig.formulaTitle')}</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {t('admin.creditConfig.formulaSubtitle')}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleFormulaReset}
                  disabled={formulaSaving}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm"
                >
                  <RotateCcw className="h-4 w-4" />
                  {t('admin.creditConfig.reset')}
                </button>
                <button
                  onClick={handleFormulaSave}
                  disabled={formulaSaving || Object.keys(formulaChanges).length === 0}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                >
                  <Save className="h-4 w-4" />
                  {formulaSaving ? t('admin.creditConfig.saving') : t('admin.creditConfig.saveChanges')}
                </button>
              </div>
            </div>
            {formulaError && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                <p className="text-sm text-red-800">{formulaError}</p>
              </div>
            )}
            {formulaSuccess && (
              <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-800">✓ {formulaSuccess}</p>
              </div>
            )}
            {Object.keys(formulaChanges).length > 0 && (
              <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">{t('admin.creditConfig.unsavedCount', { count: Object.keys(formulaChanges).length })}</p>
              </div>
            )}
          </div>

          {formulaConfig ? (
            <>
              {/* Base Season Credits */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                  <h3 className="font-semibold text-gray-900">{t('admin.creditConfig.formulaBaseSeasonTitle')}</h3>
                </div>
                <p className="text-sm text-gray-500 mb-4">{t('admin.creditConfig.formulaBaseSeasonDesc')}</p>
                <div className="grid grid-cols-3 gap-4">
                  {Object.entries(formulaConfig.base_seasons).map(([key]) => (
                    <div key={key} className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700">
                        {key === 'RED' ? t('admin.creditConfig.seasonHigh') : key === 'WHITE' ? t('admin.creditConfig.seasonMid') : t('admin.creditConfig.seasonLow')}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={getFormulaValue('base_seasons', key)}
                          onChange={(e) => handleFormulaValueChange(`BASE_SEASON_${key}`, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                        <span className="absolute right-3 top-2 text-gray-400 text-xs">{t('admin.creditConfig.credits')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Base Nightly Rates */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-gray-900">{t('admin.creditConfig.formulaBaseNightlyTitle')}</h3>
                </div>
                <p className="text-sm text-gray-500 mb-4">{t('admin.creditConfig.formulaBaseNightlyDesc')}</p>
                <div className="grid grid-cols-3 gap-4">
                  {Object.entries(formulaConfig.base_nightly).map(([key]) => (
                    <div key={key} className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700">
                        {key === 'RED' ? t('admin.creditConfig.seasonHigh') : key === 'WHITE' ? t('admin.creditConfig.seasonMid') : t('admin.creditConfig.seasonLow')}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={getFormulaValue('base_nightly', key)}
                          onChange={(e) => handleFormulaValueChange(`BASE_NIGHTLY_${key}`, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                        <span className="absolute right-3 top-2 text-gray-400 text-xs">{t('admin.creditConfig.creditsPerNight')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tier Multipliers */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="h-5 w-5 text-purple-600" />
                  <h3 className="font-semibold text-gray-900">{t('admin.creditConfig.formulaTierTitle')}</h3>
                </div>
                <p className="text-sm text-gray-500 mb-4">{t('admin.creditConfig.formulaTierDesc')}</p>
                <div className="grid grid-cols-4 gap-4">
                  {Object.entries(formulaConfig.tier_multipliers).map(([key]) => (
                    <div key={key} className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700">{key}</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          value={getFormulaValue('tier_multipliers', key)}
                          onChange={(e) => handleFormulaValueChange(`TIER_${key}`, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                        <span className="absolute right-3 top-2 text-gray-400 text-xs">×</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Room Multipliers */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Bed className="h-5 w-5 text-orange-600" />
                  <h3 className="font-semibold text-gray-900">{t('admin.creditConfig.formulaRoomTitle')}</h3>
                </div>
                <p className="text-sm text-gray-500 mb-4">{t('admin.creditConfig.formulaRoomDesc')}</p>
                <div className="grid grid-cols-5 gap-4">
                  {Object.entries(formulaConfig.room_multipliers).map(([key]) => (
                    <div key={key} className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700 text-xs">{key}</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          value={getFormulaValue('room_multipliers', key)}
                          onChange={(e) => handleFormulaValueChange(`ROOM_${key}`, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                        <span className="absolute right-3 top-2 text-gray-400 text-xs">×</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Formula Balance Preview */}
              {formulaPreview && (
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Calculator className="h-5 w-5 text-indigo-600" />
                    <h3 className="font-semibold text-gray-900">{t('admin.creditConfig.previewTitle')}</h3>
                  </div>
                  <p className="text-sm text-gray-500 mb-3">{t('admin.creditConfig.previewDesc')}</p>
                  {formulaPreview.hasDeficit && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-4">
                      <TrendingDown className="h-4 w-4 text-red-600 flex-shrink-0" />
                      <p className="text-sm text-red-700 font-medium">{t('admin.creditConfig.previewDeficitWarning')}</p>
                    </div>
                  )}
                  {(['RED', 'WHITE', 'BLUE'] as const).map(season => {
                    const seasonRows = formulaPreview.rows.filter(r => r.season === season);
                    const seasonColor = season === 'RED' ? 'text-red-600 bg-red-50 border-red-200'
                      : season === 'WHITE' ? 'text-gray-600 bg-gray-50 border-gray-200'
                      : 'text-blue-600 bg-blue-50 border-blue-200';
                    return (
                      <div key={season} className="mb-5">
                        <h4 className={`text-xs font-semibold px-3 py-1 rounded-md border inline-block mb-3 ${seasonColor}`}>
                          {season === 'RED' ? t('admin.creditConfig.seasonHigh') : season === 'WHITE' ? t('admin.creditConfig.seasonMid') : t('admin.creditConfig.seasonLow')} ({season})
                        </h4>
                        <div className="grid grid-cols-5 gap-3">
                          {seasonRows.map(({ room, depositCredits, costFor7Nights, balance }) => {
                            const isDeficit = balance < 0;
                            const isNeutral = balance >= 0 && balance / depositCredits < 0.05;
                            const cardBorder = isDeficit ? 'border-red-200 bg-red-50'
                              : isNeutral ? 'border-yellow-200 bg-yellow-50'
                              : 'border-green-200 bg-green-50';
                            const Icon = isDeficit ? TrendingDown : isNeutral ? Minus : TrendingUp;
                            const iconColor = isDeficit ? 'text-red-500' : isNeutral ? 'text-yellow-500' : 'text-green-500';
                            return (
                              <div key={room} className={`rounded-lg border p-3 space-y-1 ${cardBorder}`}>
                                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{room}</p>
                                <div className="flex justify-between text-xs text-gray-600">
                                  <span>{t('admin.creditConfig.previewEarned')}</span>
                                  <span className="font-mono font-medium">{depositCredits.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-xs text-gray-600">
                                  <span>{t('admin.creditConfig.previewCost7n')}</span>
                                  <span className="font-mono font-medium">{costFor7Nights.toLocaleString()}</span>
                                </div>
                                <div className={`flex items-center justify-between text-xs font-semibold ${iconColor}`}>
                                  <Icon className="h-3 w-3" />
                                  <span className="font-mono">{balance >= 0 ? '+' : ''}{balance.toLocaleString()}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" />
              {t('admin.creditConfig.previewLoadingFormula')}
            </div>
          )}
        </div>
      )}

      {/* Calendar Tab */}
      {activeTab === 'calendar' && (
        <div className="space-y-6">
          {/* Property and Year selector */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">{t('admin.creditConfig.calTitle')}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.creditConfig.calProperty')}
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
                  <option value="">{t('admin.creditConfig.calSelectProp')}</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} - {p.city}, {p.country}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.creditConfig.calYear')}
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
              <h2 className="text-lg font-semibold mb-4">{t('admin.creditConfig.calNewPeriodTitle')}</h2>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('admin.creditConfig.calSeason')}
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
                    <option value="RED">RED ({t('admin.creditConfig.seasonHighShort')})</option>
                    <option value="WHITE">WHITE ({t('admin.creditConfig.seasonMidShort')})</option>
                    <option value="BLUE">BLUE ({t('admin.creditConfig.seasonLowShort')})</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('admin.creditConfig.calStartDate')}
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
                    {t('admin.creditConfig.calEndDate')}
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
                    {t('admin.creditConfig.calCreate')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Calendar entries table */}
          {selectedPropertyForCalendar && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  {t('admin.creditConfig.calConfiguredTitle', { count: seasonalCalendar.length })}
                </h2>
                {seasonalCalendar.length > 0 && seasonalCalendar.some(s => !s.isDefault) && (
                  <button
                    onClick={applyDefaultCalendar}
                    disabled={applyingDefaults}
                    className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 disabled:opacity-50 text-sm font-medium"
                  >
                    {applyingDefaults ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                    {t('admin.creditConfig.calApplyDefaults')}
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {t('admin.creditConfig.calSeason')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {t('admin.creditConfig.calStartDate')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {t('admin.creditConfig.calEndDate')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {t('admin.creditConfig.colValidity')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {t('admin.creditConfig.colStatus')}
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        {t('admin.creditConfig.colActions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {seasonalCalendar.map((entry, idx) => {
                      const start = parseDateOnly(entry.start_date);
                      const end = parseDateOnly(entry.end_date);
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
                            {formatDate(entry.start_date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(entry.end_date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {t('admin.creditConfig.calDays', { count: days })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {entry.isDefault ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">
                                <AlertCircle className="h-3 w-3" />
                                {t('admin.creditConfig.calStatusDefault')}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                                <CheckCircle className="h-3 w-3" />
                                {t('admin.creditConfig.calStatusConfigured')}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            {entry.isDefault ? (
                              <button
                                onClick={async () => {
                                  // Save default as real entry
                                  try {
                                    await apiClient.post(
                                      '/api/credits/admin/seasonal-calendar',
                                      {
                                        propertyId: entry.property_id,
                                        seasonType: entry.season_type,
                                        startDate: entry.start_date,
                                        endDate: entry.end_date,
                                        year: entry.year
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
                                {t('admin.creditConfig.calSave')}
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
                          {t('admin.creditConfig.calNoEntries')}
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
                  {t('admin.creditConfig.calInfoTitle')}
                </h3>
                <p className="text-sm text-blue-800 mb-2">
                  {t('admin.creditConfig.calInfoDesc')}
                </p>
                <ul className="text-sm text-blue-800 list-disc list-inside space-y-1">
                  <li>{t('admin.creditConfig.calInfoItem1')}</li>
                  <li>{t('admin.creditConfig.calInfoItem2')}</li>
                  <li>{t('admin.creditConfig.calInfoItem3')}</li>
                  <li>{t('admin.creditConfig.calInfoItem4')}</li>
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
