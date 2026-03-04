import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/client';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import toast from 'react-hot-toast';
import {
  Store, Eye, Save, ExternalLink, ToggleLeft, ToggleRight,
  MapPin, FileText, Image, Sparkles, Clock, X, Check,
  Wifi, Waves, Car, Dumbbell, UtensilsCrossed, Wine, Wind,
  Dog, Baby, Bell, Plane, Shirt, Flame, Sun, Briefcase
} from 'lucide-react';
import ImageUploader from '@/components/common/ImageUploader';

interface MarketplaceConfig {
  id: number;
  name: string;
  description?: string;
  amenities?: string[];
  images?: string[];
  is_marketplace_enabled: boolean;
  city?: string;
  country?: string;
  region?: string;
  address?: string;
  postal_code?: string;
  check_in_time?: string;
  check_out_time?: string;
}

type Tab = 'info' | 'images' | 'amenities';

// Parse arrays from JSON string, double-encoded JSON, or comma-separated
const parseArray = (data: any): string[] => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === 'string') {
        try {
          const doubleParsed = JSON.parse(parsed);
          return Array.isArray(doubleParsed) ? doubleParsed : [];
        } catch { return []; }
      }
      return [];
    } catch {
      return data.split(',').map(item => item.trim()).filter(Boolean);
    }
  }
  return [];
};

const PREDEFINED_AMENITIES = [
  { key: 'wifi',        label: 'WiFi',             icon: Wifi },
  { key: 'pool',        label: 'Swimming Pool',    icon: Waves },
  { key: 'parking',     label: 'Parking',          icon: Car },
  { key: 'gym',         label: 'Fitness Center',   icon: Dumbbell },
  { key: 'spa',         label: 'Spa',              icon: Sparkles },
  { key: 'restaurant',  label: 'Restaurant',       icon: UtensilsCrossed },
  { key: 'bar',         label: 'Bar & Lounge',     icon: Wine },
  { key: 'beach',       label: 'Beach Access',     icon: Sun },
  { key: 'ac',          label: 'Air Conditioning', icon: Wind },
  { key: 'pets',        label: 'Pet Friendly',     icon: Dog },
  { key: 'kids',        label: 'Kids Club',        icon: Baby },
  { key: 'roomservice', label: 'Room Service',     icon: Bell },
  { key: 'shuttle',     label: 'Airport Shuttle',  icon: Plane },
  { key: 'laundry',     label: 'Laundry',          icon: Shirt },
  { key: 'sauna',       label: 'Sauna',            icon: Flame },
  { key: 'concierge',   label: 'Concierge',        icon: Briefcase },
];

const PREDEFINED_LABELS = new Set(PREDEFINED_AMENITIES.map(a => a.label));

export default function MarketplaceSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [isDirty, setIsDirty] = useState(false);
  const [formData, setFormData] = useState<Partial<MarketplaceConfig>>({});
  const [newAmenity, setNewAmenity] = useState('');

  const { data: configData, isLoading } = useQuery({
    queryKey: ['staff-marketplace-config'],
    queryFn: async () => {
      const { data } = await apiClient.get('/hotel-staff/marketplace/config');
      return data.data;
    }
  });

  const config: MarketplaceConfig = configData || {} as MarketplaceConfig;

  useEffect(() => {
    if (configData) {
      setFormData({
        is_marketplace_enabled: configData.is_marketplace_enabled,
        description: configData.description || '',
        images: parseArray(configData.images),
        amenities: parseArray(configData.amenities),
        city: configData.city || '',
        country: configData.country || '',
        region: configData.region || '',
        address: configData.address || '',
        postal_code: configData.postal_code || '',
        check_in_time: configData.check_in_time || '15:00',
        check_out_time: configData.check_out_time || '11:00',
      });
      setIsDirty(false);
    }
  }, [configData]);

  const updateMutation = useMutation({
    mutationFn: async (updateData: Partial<MarketplaceConfig>) => {
      const { data } = await apiClient.put('/hotel-staff/marketplace/config', updateData);
      return data;
    },
    onSuccess: () => {
      toast.success(t('staff.marketplace.updateSuccess'));
      queryClient.invalidateQueries({ queryKey: ['staff-marketplace-config'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-properties'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-cities'] });
      queryClient.invalidateQueries({ queryKey: ['property', config.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-timeshare-properties'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      setIsDirty(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('staff.marketplace.updateError'));
    }
  });

  const handleToggleMarketplace = () => {
    updateMutation.mutate({ is_marketplace_enabled: !config.is_marketplace_enabled });
  };

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const handleDiscard = () => {
    if (configData) {
      setFormData({
        is_marketplace_enabled: configData.is_marketplace_enabled,
        description: configData.description || '',
        images: parseArray(configData.images),
        amenities: parseArray(configData.amenities),
        city: configData.city || '',
        country: configData.country || '',
        region: configData.region || '',
        address: configData.address || '',
        postal_code: configData.postal_code || '',
        check_in_time: configData.check_in_time || '15:00',
        check_out_time: configData.check_out_time || '11:00',
      });
      setIsDirty(false);
    }
  };

  const update = (patch: Partial<MarketplaceConfig>) => {
    setFormData(prev => ({ ...prev, ...patch }));
    setIsDirty(true);
  };

  const handleAddAmenity = () => {
    const trimmed = newAmenity.trim();
    if (!trimmed) return;
    update({ amenities: [...(formData.amenities || []), trimmed] });
    setNewAmenity('');
  };

  const handleRemoveAmenity = (amenity: string) => {
    update({ amenities: (formData.amenities || []).filter(a => a !== amenity) });
  };

  const handleTogglePredefined = (label: string) => {
    const current = formData.amenities || [];
    if (current.includes(label)) {
      update({ amenities: current.filter(a => a !== label) });
    } else {
      update({ amenities: [...current, label] });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'info',      label: t('staff.marketplace.tabInfo'),      icon: <FileText className="h-4 w-4" /> },
    { id: 'images',    label: t('staff.marketplace.tabImages'),    icon: <Image className="h-4 w-4" /> },
    { id: 'amenities', label: t('staff.marketplace.tabAmenities'), icon: <Sparkles className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Store className="h-6 w-6 text-blue-600" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900 truncate">{config.name}</h1>
              <div className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{config.city}{config.country ? `, ${config.country}` : ''}</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleToggleMarketplace}
            disabled={updateMutation.isPending}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              config.is_marketplace_enabled
                ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
            }`}
          >
            {config.is_marketplace_enabled
              ? <><ToggleRight className="h-5 w-5" />{t('staff.marketplace.enabled')}</>
              : <><ToggleLeft className="h-5 w-5" />{t('staff.marketplace.disabled')}</>
            }
          </button>
        </div>

        {config.is_marketplace_enabled && (
          <a
            href="/marketplace"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-4 text-sm text-blue-600 hover:text-blue-700"
          >
            <Eye className="h-4 w-4" />
            {t('staff.marketplace.viewInMarketplace')}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">

        {/* INFO TAB */}
        {activeTab === 'info' && (
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {t('staff.marketplace.description')}
              </label>
              <textarea
                value={formData.description || ''}
                onChange={e => update({ description: e.target.value })}
                rows={5}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                placeholder={t('staff.marketplace.descriptionPlaceholder')}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('staff.marketplace.city')}
                </label>
                <input
                  type="text"
                  value={formData.city || ''}
                  onChange={e => update({ city: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. Madrid"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('staff.marketplace.country')}
                </label>
                <input
                  type="text"
                  value={formData.country || ''}
                  onChange={e => update({ country: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. Spain"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('staff.marketplace.region', 'Region / Province')}
                </label>
                <input
                  type="text"
                  value={formData.region || ''}
                  onChange={e => update({ region: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. Costa del Sol"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('staff.marketplace.postalCode', 'Postal Code')}
                </label>
                <input
                  type="text"
                  value={formData.postal_code || ''}
                  onChange={e => update({ postal_code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. 29600"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('staff.marketplace.address', 'Street Address')}
                </label>
                <input
                  type="text"
                  value={formData.address || ''}
                  onChange={e => update({ address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. Avenida del Mar, 123"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">{t('staff.marketplace.checkTimes')}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    {t('staff.marketplace.checkInTime')}
                  </label>
                  <input
                    type="time"
                    value={formData.check_in_time || '15:00'}
                    onChange={e => update({ check_in_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    {t('staff.marketplace.checkOutTime')}
                  </label>
                  <input
                    type="time"
                    value={formData.check_out_time || '11:00'}
                    onChange={e => update({ check_out_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* IMAGES TAB */}
        {activeTab === 'images' && (
          <div className="p-6">
            <p className="text-sm text-gray-500 mb-4">{t('staff.marketplace.imagesHint')}</p>
            <ImageUploader
              images={formData.images || []}
              onChange={imgs => update({ images: imgs })}
            />
          </div>
        )}

        {/* AMENITIES TAB */}
        {activeTab === 'amenities' && (
          <div className="p-6 space-y-6">

            {/* Predefined amenities */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-500" />
                {t('staff.marketplace.commonFacilities', 'Common Facilities')}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {PREDEFINED_AMENITIES.map(({ key, label, icon: Icon }) => {
                  const isSelected = (formData.amenities || []).includes(label);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleTogglePredefined(label)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                        isSelected
                          ? 'bg-blue-50 border-blue-400 text-blue-700'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50/50'
                      }`}
                    >
                      <Icon className={`h-4 w-4 flex-shrink-0 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`} />
                      <span className="truncate flex-1 text-left">{t(`staff.marketplace.amenity.${key}`, label)}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 flex-shrink-0 text-blue-600" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                {t('staff.marketplace.customFacilities', 'Custom')}
              </span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Custom amenities */}
            <div>
              {(() => {
                const customAmenities = (formData.amenities || []).filter(a => !PREDEFINED_LABELS.has(a));
                return (
                  <>
                    <div className="flex flex-wrap gap-2 min-h-[40px] mb-3">
                      {customAmenities.length === 0 ? (
                        <p className="text-sm text-gray-400 self-center">
                          {t('staff.marketplace.noCustomAmenities', 'No custom facilities yet')}
                        </p>
                      ) : (
                        customAmenities.map(amenity => (
                          <span
                            key={amenity}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-sm"
                          >
                            {amenity}
                            <button
                              onClick={() => handleRemoveAmenity(amenity)}
                              className="text-purple-400 hover:text-red-500 transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newAmenity}
                        onChange={e => setNewAmenity(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddAmenity()}
                        placeholder={t('staff.marketplace.enterAmenity')}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        onClick={handleAddAmenity}
                        disabled={!newAmenity.trim()}
                        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        + {t('staff.marketplace.addAmenity')}
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Save bar — aparece solo cuando hay cambios sin guardar */}
        {isDirty && (
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
            <p className="text-sm text-gray-500">{t('staff.marketplace.unsavedChanges')}</p>
            <div className="flex gap-2">
              <button
                onClick={handleDiscard}
                className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                <Save className="h-4 w-4" />
                {updateMutation.isPending ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

