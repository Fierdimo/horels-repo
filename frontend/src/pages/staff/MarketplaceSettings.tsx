import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/client';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import  toast from 'react-hot-toast';
import { Store, Eye, Save, Image, FileText, List, ToggleLeft, ToggleRight, ExternalLink } from 'lucide-react';

interface MarketplaceConfig {
  id: number;
  name: string;
  description?: string;
  amenities?: string[];
  images?: string[];
  stars?: number;
  is_marketplace_enabled: boolean;
  marketplace_description?: string;
  marketplace_images?: string[];
  marketplace_amenities?: string[];
  marketplace_enabled_at?: string;
  city?: string;
  country?: string;
  check_in_time?: string;
  check_out_time?: string;
}

// Helper function to parse arrays that might come as JSON strings or comma-separated strings
const parseArray = (data: any): string[] => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return data.split(',').map(item => item.trim()).filter(Boolean);
    }
  }
  return [];
};

export default function MarketplaceSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<MarketplaceConfig>>({});

  // Fetch marketplace config
  const { data: configData, isLoading } = useQuery({
    queryKey: ['staff-marketplace-config'],
    queryFn: async () => {
      const { data } = await apiClient.get('/hotel-staff/marketplace/config');
      return data.data;
    }
  });

  const config: MarketplaceConfig = configData || {} as MarketplaceConfig;

  // Set form data when config loads
  useEffect(() => {
    if (configData) {
      setFormData({
        is_marketplace_enabled: configData.is_marketplace_enabled,
        marketplace_description: configData.marketplace_description || configData.description || '',
        marketplace_images: parseArray(configData.marketplace_images || configData.images),
        marketplace_amenities: parseArray(configData.marketplace_amenities || configData.amenities)
      });
    }
  }, [configData]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (updateData: Partial<MarketplaceConfig>) => {
      const { data } = await apiClient.put('/hotel-staff/marketplace/config', updateData);
      return data;
    },
    onSuccess: () => {
      toast.success(t('staff.marketplace.updateSuccess'));
      queryClient.invalidateQueries({ queryKey: ['staff-marketplace-config'] });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('staff.marketplace.updateError'));
    }
  });

  const handleToggleMarketplace = () => {
    updateMutation.mutate({
      is_marketplace_enabled: !config.is_marketplace_enabled
    });
  };

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const handleAddImage = () => {
    const url = prompt(t('staff.marketplace.enterImageUrl'));
    if (url) {
      setFormData({
        ...formData,
        marketplace_images: [...(formData.marketplace_images || []), url]
      });
    }
  };

  const handleRemoveImage = (index: number) => {
    const newImages = [...(formData.marketplace_images || [])];
    newImages.splice(index, 1);
    setFormData({
      ...formData,
      marketplace_images: newImages
    });
  };

  const handleAddAmenity = () => {
    const amenity = prompt(t('staff.marketplace.enterAmenity'));
    if (amenity) {
      setFormData({
        ...formData,
        marketplace_amenities: [...(formData.marketplace_amenities || []), amenity]
      });
    }
  };

  const handleRemoveAmenity = (index: number) => {
    const newAmenities = [...(formData.marketplace_amenities || [])];
    newAmenities.splice(index, 1);
    setFormData({
      ...formData,
      marketplace_amenities: newAmenities
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Store className="h-8 w-8 text-blue-600" />
              {t('staff.marketplace.title')}
            </h1>
            <p className="text-gray-600 mt-2">{t('staff.marketplace.subtitle')}</p>
          </div>

          {/* Toggle Marketplace */}
          <button
            onClick={handleToggleMarketplace}
            disabled={updateMutation.isPending}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors ${
              config.is_marketplace_enabled
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
            }`}
          >
            {config.is_marketplace_enabled ? (
              <>
                <ToggleRight className="h-6 w-6" />
                {t('staff.marketplace.enabled')}
              </>
            ) : (
              <>
                <ToggleLeft className="h-6 w-6" />
                {t('staff.marketplace.disabled')}
              </>
            )}
          </button>
        </div>

        {config.is_marketplace_enabled && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
            <Eye className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-blue-900 font-medium">
                {t('staff.marketplace.enabledInfo')}
              </p>
              <a
                href="/marketplace"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-700 hover:text-blue-800 underline flex items-center gap-1 mt-1"
              >
                {t('staff.marketplace.viewInMarketplace')}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Property Info Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">{config.name}</h2>
          <div className="flex items-center gap-2">
            {config.stars && config.stars > 0 && (
              <div className="flex items-center gap-1 text-yellow-500">
                {Array.from({ length: config.stars }).map((_, i) => (
                  <span key={i}>⭐</span>
                ))}
              </div>
            )}
          </div>
        </div>
        <p className="text-gray-600">
          {config.city}, {config.country}
        </p>
      </div>

      {/* Edit Mode Toggle */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {t('staff.marketplace.marketplaceContent')}
        </h2>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t('common.edit')}
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setIsEditing(false);
                setFormData({
                  is_marketplace_enabled: config.is_marketplace_enabled,
                  marketplace_description: config.marketplace_description || config.description || '',
                  marketplace_images: config.marketplace_images || config.images || [],
                  marketplace_amenities: config.marketplace_amenities || config.amenities || []
                });
              }}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {updateMutation.isPending ? t('common.saving') : t('common.save')}
            </button>
          </div>
        )}
      </div>

      {/* Description Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            {t('staff.marketplace.description')}
          </h3>
        </div>
        {isEditing ? (
          <textarea
            value={formData.marketplace_description || ''}
            onChange={(e) => setFormData({ ...formData, marketplace_description: e.target.value })}
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder={t('staff.marketplace.descriptionPlaceholder')}
          />
        ) : (
          <p className="text-gray-700 whitespace-pre-wrap">
            {config.marketplace_description || config.description || t('staff.marketplace.noDescription')}
          </p>
        )}
      </div>

      {/* Images Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Image className="h-5 w-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              {t('staff.marketplace.images')}
            </h3>
          </div>
          {isEditing && (
            <button
              onClick={handleAddImage}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              + {t('staff.marketplace.addImage')}
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {parseArray(formData.marketplace_images || config.marketplace_images || config.images).map((img, idx) => (
            <div key={idx} className="relative group">
              <img
                src={img}
                alt={`Property ${idx + 1}`}
                className="w-full h-40 object-cover rounded-lg"
              />
              {isEditing && (
                <button
                  onClick={() => handleRemoveImage(idx)}
                  className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        {(!parseArray(config.marketplace_images || config.images).length) && !isEditing && (
          <p className="text-gray-500 text-center py-8">{t('staff.marketplace.noImages')}</p>
        )}
      </div>

      {/* Amenities Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <List className="h-5 w-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              {t('staff.marketplace.amenities')}
            </h3>
          </div>
          {isEditing && (
            <button
              onClick={handleAddAmenity}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              + {t('staff.marketplace.addAmenity')}
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {parseArray(formData.marketplace_amenities || config.marketplace_amenities || config.amenities).map((amenity, idx) => (
            <span
              key={idx}
              className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm flex items-center gap-2"
            >
              {amenity}
              {isEditing && (
                <button
                  onClick={() => handleRemoveAmenity(idx)}
                  className="text-red-600 hover:text-red-700 font-bold"
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
        {(!parseArray(config.marketplace_amenities || config.amenities).length) && !isEditing && (
          <p className="text-gray-500 text-center py-4">{t('staff.marketplace.noAmenities')}</p>
        )}
      </div>
    </div>
  );
}
