import { useState, useEffect } from 'react';
import { creditConfigAPI } from '../../api/creditConfig';
import { Save, RotateCcw, Settings, DollarSign, Building2, Bed, AlertCircle } from 'lucide-react';

interface CreditConfig {
  base_seasons: Record<string, number>;
  base_nightly: Record<string, number>;
  tier_multipliers: Record<string, number>;
  room_multipliers: Record<string, number>;
  other: Record<string, number>;
}

export default function CreditConfigPage() {
  const [config, setConfig] = useState<CreditConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      setLoading(true);
      const data = await creditConfigAPI.getConfiguration();
      setConfig(data);
      setChanges({});
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al cargar configuración');
    } finally {
      setLoading(false);
    }
  };

  const handleValueChange = (key: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      setChanges(prev => ({ ...prev, [key]: numValue }));
    }
  };

  const handleSave = async () => {
    if (Object.keys(changes).length === 0) {
      setError('No hay cambios para guardar');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await creditConfigAPI.updateConfiguration(changes);
      setSuccess(`${Object.keys(changes).length} configuraciones actualizadas`);
      await loadConfiguration();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al guardar cambios');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('¿Estás seguro de restablecer todos los valores por defecto?')) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await creditConfigAPI.resetToDefaults();
      setSuccess('Configuración restablecida a valores por defecto');
      await loadConfiguration();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al restablecer configuración');
    } finally {
      setSaving(false);
    }
  };

  const getValue = (section: keyof CreditConfig, key: string): number => {
    const fullKey = `${section === 'base_seasons' ? 'BASE_SEASON_' : section === 'base_nightly' ? 'BASE_NIGHTLY_' : section === 'tier_multipliers' ? 'TIER_' : 'ROOM_'}${key}`;
    return changes[fullKey] ?? config?.[section]?.[key] ?? 0;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error al cargar configuración</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Settings className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Configuración del Sistema de Créditos</h1>
              <p className="text-sm text-gray-600 mt-1">
                Administra los valores base y multiplicadores para el cálculo de créditos
              </p>
            </div>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handleReset}
              disabled={saving}
              className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Restablecer</span>
            </button>
            <button
              onClick={handleSave}
              disabled={saving || Object.keys(changes).length === 0}
              className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Guardando...' : 'Guardar Cambios'}</span>
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800">✓ {success}</p>
          </div>
        )}

        {Object.keys(changes).length > 0 && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800">⚠️ Tienes {Object.keys(changes).length} cambios sin guardar</p>
          </div>
        )}
      </div>

      {/* Base Season Values */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center space-x-2 mb-4">
          <DollarSign className="h-6 w-6 text-emerald-600" />
          <h2 className="text-lg font-semibold text-gray-900">Valores Base de Temporada (Depósitos)</h2>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Valor en créditos que recibe un owner al depositar una semana completa
        </p>
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(config.base_seasons).map(([key, value]) => (
            <div key={key} className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Temporada {key === 'RED' ? 'ALTA (RED)' : key === 'WHITE' ? 'MEDIA (WHITE)' : 'BAJA (BLUE)'}
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={getValue('base_seasons', key)}
                  onChange={(e) => handleValueChange(`BASE_SEASON_${key}`, e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="absolute right-3 top-2.5 text-gray-500 text-sm">créditos</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Base Nightly Rates */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center space-x-2 mb-4">
          <DollarSign className="h-6 w-6 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Tarifas Nocturnas Base (Bookings)</h2>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Costo base por noche antes de aplicar multiplicadores
        </p>
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(config.base_nightly).map(([key, value]) => (
            <div key={key} className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Noche {key === 'RED' ? 'ALTA' : key === 'WHITE' ? 'MEDIA' : 'BAJA'}
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={getValue('base_nightly', key)}
                  onChange={(e) => handleValueChange(`BASE_NIGHTLY_${key}`, e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="absolute right-3 top-2.5 text-gray-500 text-sm">créditos/noche</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tier Multipliers */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Building2 className="h-6 w-6 text-purple-600" />
          <h2 className="text-lg font-semibold text-gray-900">Multiplicadores de Tier</h2>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Factor según la categoría de la propiedad
        </p>
        <div className="grid grid-cols-4 gap-4">
          {Object.entries(config.tier_multipliers).map(([key, value]) => (
            <div key={key} className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {key === 'DIAMOND' ? '🏆 DIAMOND' : key === 'GOLD' ? '🥇 GOLD' : key === 'SILVER_PLUS' ? '🥈 SILVER+' : '🥉 STANDARD'}
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  value={getValue('tier_multipliers', key)}
                  onChange={(e) => handleValueChange(`TIER_${key}`, e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="absolute right-3 top-2.5 text-gray-500 text-sm">×</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Room Multipliers */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Bed className="h-6 w-6 text-orange-600" />
          <h2 className="text-lg font-semibold text-gray-900">Multiplicadores de Tipo de Habitación</h2>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Factor según el tamaño/categoría de la habitación
        </p>
        <div className="grid grid-cols-5 gap-4">
          {Object.entries(config.room_multipliers).map(([key, value]) => (
            <div key={key} className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {key === 'STANDARD' ? '🏠 Standard' : key === 'SUPERIOR' ? '🏡 Superior' : key === 'DELUXE' ? '🏘️ Deluxe' : key === 'SUITE' ? '🏰 Suite' : '👑 Presidential'}
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  value={getValue('room_multipliers', key)}
                  onChange={(e) => handleValueChange(`ROOM_${key}`, e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="absolute right-3 top-2.5 text-gray-500 text-sm">×</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Credit to EUR Rate */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Conversión Crédito → Euro</h2>
        <p className="text-sm text-gray-600 mb-4">
          Tasa de conversión para pagos híbridos (créditos + efectivo)
        </p>
        <div className="max-w-xs space-y-2">
          <label className="block text-sm font-medium text-gray-700">1 crédito =</label>
          <div className="relative">
            <input
              type="number"
              step="0.01"
              value={config.other.CREDIT_TO_EUR_RATE || 0.10}
              onChange={(e) => handleValueChange('CREDIT_TO_EUR_RATE', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <span className="absolute right-3 top-2.5 text-gray-500 text-sm">EUR</span>
          </div>
        </div>
      </div>
    </div>
  );
}
