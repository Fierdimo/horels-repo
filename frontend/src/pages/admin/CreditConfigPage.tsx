import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { creditConfigAPI } from '../../api/creditConfig';
import { Save, RotateCcw, Settings, DollarSign, Building2, Bed, AlertCircle, Calculator, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface CreditConfig {
  base_seasons: Record<string, number>;
  base_nightly: Record<string, number>;
  tier_multipliers: Record<string, number>;
  room_multipliers: Record<string, number>;
  other: Record<string, number>;
}

export default function CreditConfigPage() {
  const { t } = useTranslation();
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
      setError(err.response?.data?.message || t('admin.creditConfig.errorLoading'));
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
      setError(t('admin.creditConfig.noChanges'));
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await creditConfigAPI.updateConfiguration(changes);
      setSuccess(t('admin.creditConfig.successUpdate', { count: Object.keys(changes).length }));
      await loadConfiguration();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || t('admin.creditConfig.errorSaving'));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm(t('admin.creditConfig.confirmReset'))) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await creditConfigAPI.resetToDefaults();
      setSuccess(t('admin.creditConfig.successReset'));
      await loadConfiguration();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || t('admin.creditConfig.errorReset'));
    } finally {
      setSaving(false);
    }
  };

  const getValue = (section: keyof CreditConfig, key: string): number => {
    const fullKey = `${section === 'base_seasons' ? 'BASE_SEASON_' : section === 'base_nightly' ? 'BASE_NIGHTLY_' : section === 'tier_multipliers' ? 'TIER_' : 'ROOM_'}${key}`;
    return changes[fullKey] ?? config?.[section]?.[key] ?? 0;
  };

  // Live formula preview using current (possibly unsaved) values
  const formulaPreview = useMemo(() => {
    if (!config) return null;

    const getVal = (section: keyof CreditConfig, key: string) => {
      const fullKey = `${section === 'base_seasons' ? 'BASE_SEASON_' : section === 'base_nightly' ? 'BASE_NIGHTLY_' : section === 'tier_multipliers' ? 'TIER_' : 'ROOM_'}${key}`;
      return changes[fullKey] ?? config?.[section]?.[key] ?? 0;
    };

    const seasons = ['RED', 'WHITE', 'BLUE'] as const;
    const rooms = ['STANDARD', 'SUPERIOR', 'DELUXE', 'SUITE', 'PRESIDENTIAL'] as const;
    const WEEKS_NIGHTS = 7;

    const rows = seasons.flatMap(season =>
      rooms.map(room => {
        const baseSeason = getVal('base_seasons', season);
        const baseNightly = getVal('base_nightly', season);
        const roomMult = getVal('room_multipliers', room);
        // Using STANDARD tier (1.0) and location (1.0) as reference
        const depositCredits = Math.round(baseSeason * 1.0 * 1.0 * roomMult);
        const costFor7Nights = Math.round(baseNightly * roomMult * WEEKS_NIGHTS);
        const balance = depositCredits - costFor7Nights;
        return { season, room, depositCredits, costFor7Nights, balance };
      })
    );

    const hasDeficit = rows.some(r => r.balance < 0);
    const hasSurplus = rows.every(r => r.balance > 0);
    return { rows, hasDeficit, hasSurplus };
  }, [config, changes]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('admin.creditConfig.loading')}</p>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{t('admin.creditConfig.errorLoading')}</p>
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
              <h1 className="text-2xl font-bold text-gray-900">{t('admin.creditConfig.title')}</h1>
              <p className="text-sm text-gray-600 mt-1">
                {t('admin.creditConfig.subtitle')}
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
              <span>{t('admin.creditConfig.reset')}</span>
            </button>
            <button
              onClick={handleSave}
              disabled={saving || Object.keys(changes).length === 0}
              className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? t('admin.creditConfig.saving') : t('admin.creditConfig.saveChanges')}</span>
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
            <p className="text-yellow-800">{t('admin.creditConfig.unsavedChanges', { count: Object.keys(changes).length })}</p>
          </div>
        )}
      </div>

      {/* Base Season Values */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center space-x-2 mb-4">
          <DollarSign className="h-6 w-6 text-emerald-600" />
          <h2 className="text-lg font-semibold text-gray-900">{t('admin.creditConfig.baseSeasonTitle')}</h2>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          {t('admin.creditConfig.baseSeasonDesc')}
        </p>
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(config.base_seasons).map(([key, value]) => (
            <div key={key} className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {key === 'RED' ? t('admin.creditConfig.seasonHigh') : key === 'WHITE' ? t('admin.creditConfig.seasonMid') : t('admin.creditConfig.seasonLow')}
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={getValue('base_seasons', key)}
                  onChange={(e) => handleValueChange(`BASE_SEASON_${key}`, e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="absolute right-3 top-2.5 text-gray-500 text-sm">{t('admin.creditConfig.credits')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Base Nightly Rates */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center space-x-2 mb-4">
          <DollarSign className="h-6 w-6 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">{t('admin.creditConfig.baseNightlyTitle')}</h2>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          {t('admin.creditConfig.baseNightlyDesc')}
        </p>
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(config.base_nightly).map(([key, value]) => (
            <div key={key} className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {key === 'RED' ? t('admin.creditConfig.nightHigh') : key === 'WHITE' ? t('admin.creditConfig.nightMid') : t('admin.creditConfig.nightLow')}
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={getValue('base_nightly', key)}
                  onChange={(e) => handleValueChange(`BASE_NIGHTLY_${key}`, e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="absolute right-3 top-2.5 text-gray-500 text-sm">{t('admin.creditConfig.creditsPerNight')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tier Multipliers */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Building2 className="h-6 w-6 text-purple-600" />
          <h2 className="text-lg font-semibold text-gray-900">{t('admin.creditConfig.tierMultipliersTitle')}</h2>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          {t('admin.creditConfig.tierMultipliersDesc')}
        </p>
        <div className="grid grid-cols-4 gap-4">
          {Object.entries(config.tier_multipliers).map(([key, value]) => (
            <div key={key} className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {key === 'DIAMOND' ? t('admin.creditConfig.tierDiamond') : key === 'GOLD' ? t('admin.creditConfig.tierGold') : key === 'SILVER_PLUS' ? t('admin.creditConfig.tierSilverPlus') : t('admin.creditConfig.tierStandard')}
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
          <h2 className="text-lg font-semibold text-gray-900">{t('admin.creditConfig.roomMultipliersTitle')}</h2>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          {t('admin.creditConfig.roomMultipliersDesc')}
        </p>
        <div className="grid grid-cols-5 gap-4">
          {Object.entries(config.room_multipliers).map(([key, value]) => (
            <div key={key} className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {key === 'STANDARD' ? t('admin.creditConfig.roomStandard') : key === 'SUPERIOR' ? t('admin.creditConfig.roomSuperior') : key === 'DELUXE' ? t('admin.creditConfig.roomDeluxe') : key === 'SUITE' ? t('admin.creditConfig.roomSuite') : t('admin.creditConfig.roomPresidential')}
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

      {/* Formula Balance Preview */}
      {formulaPreview && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center space-x-2 mb-2">
            <Calculator className="h-6 w-6 text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-900">{t('admin.creditConfig.formulaPreviewTitle', 'Formula Balance Preview')}</h2>
          </div>
          <p className="text-sm text-gray-600 mb-1">
            {t('admin.creditConfig.formulaPreviewDesc', 'Shows credits earned when depositing a full week vs. the cost to book that same 7 nights (STANDARD tier × base location = 1.0). Updates live as you edit.')}
          </p>
          {formulaPreview.hasDeficit && (
            <div className="flex items-center space-x-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-4">
              <TrendingDown className="h-4 w-4 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-700 font-medium">
                {t('admin.creditConfig.formulaDeficitWarning', 'Warning: some combinations cost more to book than an owner earns by depositing. Owners will lose credits exchanging a week. Consider raising BASE_SEASON values or lowering BASE_NIGHTLY rates.')}
              </p>
            </div>
          )}

          {/* Season headers */}
          {(['RED', 'WHITE', 'BLUE'] as const).map(season => {
            const seasonRows = formulaPreview.rows.filter(r => r.season === season);
            const seasonColor = season === 'RED' ? 'text-red-600 bg-red-50 border-red-200'
              : season === 'WHITE' ? 'text-gray-600 bg-gray-50 border-gray-200'
              : 'text-blue-600 bg-blue-50 border-blue-200';
            return (
              <div key={season} className="mb-6">
                <h3 className={`text-sm font-semibold px-3 py-1 rounded-md border inline-block mb-3 ${seasonColor}`}>
                  {t(`admin.creditConfig.season${season[0]}${season.slice(1).toLowerCase()}`, season)} {t('admin.creditConfig.previewSeason', 'Season')}
                </h3>
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
                          <span>{t('admin.creditConfig.previewEarned', 'Earned')}</span>
                          <span className="font-mono font-medium">{depositCredits.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>{t('admin.creditConfig.previewCost7n', 'Cost 7n')}</span>
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
    </div>
  );
}
