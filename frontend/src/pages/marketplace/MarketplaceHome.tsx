import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import apiClient from '@/api/client';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Search, MapPin, Star, Filter, X } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import roomFallbackImage from '@/assets/hotel-room-background.avif';
import hotelFallbackImage from '@/assets/hotel.avif';

interface Property {
  id: number;
  name: string;
  location: string;
  description: string;
  city: string;
  country: string;
  stars: number;
  images: string[];
  amenities: string[];
  pms_provider: string | null;
}

// Helper function to parse images (same as in PropertyDetails)
const parseImages = (images: any): string[] => {
  if (!images) return [];
  if (Array.isArray(images)) return images;
  if (typeof images === 'string') {
    try {
      const parsed = JSON.parse(images);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // If not JSON, try comma-separated
      return images.split(',').map(img => img.trim()).filter(Boolean);
    }
  }
  return [];
};

// Helper function to parse amenities
const parseAmenities = (amenities: any): string[] => {
  if (!amenities) return [];
  if (Array.isArray(amenities)) return amenities;
  if (typeof amenities === 'string') {
    try {
      const parsed = JSON.parse(amenities);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // If not JSON, try comma-separated
      return amenities.split(',').map(a => a.trim()).filter(Boolean);
    }
  }
  return [];
};

export default function MarketplaceHome() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedStars, setSelectedStars] = useState<number | ''>('');
  const [showFilters, setShowFilters] = useState(false);

  // Get base path based on user role
  const getMarketplaceBasePath = () => {
    if (!user?.role) return '/guest/marketplace';
    switch (user.role) {
      case 'owner': return '/owner/marketplace';
      case 'staff': return '/staff/marketplace';
      case 'admin': return '/admin/marketplace';
      case 'guest': return '/guest/marketplace';
      default: return '/guest/marketplace';
    }
  };

  // Fetch properties
  const { data: propertiesData, isLoading } = useQuery({
    queryKey: ['marketplace-properties', searchTerm, selectedCity, selectedStars],
    queryFn: async () => {
      const params: any = {};
      if (searchTerm) params.search = searchTerm;
      if (selectedCity) params.city = selectedCity;
      if (selectedStars) params.stars = selectedStars;

      const { data } = await apiClient.get('/public/properties', { params });
      return data;
    }
  });

  // Fetch cities for filter
  const { data: citiesData } = useQuery({
    queryKey: ['marketplace-cities'],
    queryFn: async () => {
      const { data } = await apiClient.get('/public/cities');
      return data;
    }
  });

  const properties: Property[] = propertiesData?.data || [];
  const cities: Array<{ city: string; country: string }> = citiesData?.data || [];

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCity('');
    setSelectedStars('');
  };

  const hasActiveFilters = searchTerm || selectedCity || selectedStars;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold mb-4">{t('marketplace.title')}</h1>
          <p className="text-xl text-blue-100 mb-8">{t('marketplace.subtitle')}</p>

          {/* Search Bar */}
          <div className="max-w-3xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder={t('marketplace.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="mb-8">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50"
          >
            <Filter className="h-5 w-5" />
            {t('common.filter')}
            {hasActiveFilters && (
              <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                {[searchTerm, selectedCity, selectedStars].filter(Boolean).length}
              </span>
            )}
          </button>

          {showFilters && (
            <div className="mt-4 p-6 bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* City Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('marketplace.filters.city')}
                  </label>
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">{t('marketplace.filters.allCities')}</option>
                    {cities.map((c, idx) => (
                      <option key={idx} value={c.city}>
                        {c.city}, {c.country}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Stars Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('marketplace.filters.stars')}
                  </label>
                  <select
                    value={selectedStars}
                    onChange={(e) => setSelectedStars(e.target.value ? parseInt(e.target.value) : '')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">{t('marketplace.filters.allStars')}</option>
                    {[5, 4, 3, 2, 1].map((star) => (
                      <option key={star} value={star}>
                        {star} {t('marketplace.filters.starLabel', { count: star })}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Clear Filters */}
                <div className="flex items-end">
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="w-full px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center justify-center gap-2"
                    >
                      <X className="h-4 w-4" />
                      {t('marketplace.filters.clear')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results Count */}
        <div className="mb-6">
          <p className="text-gray-600">
            {t('marketplace.resultsCount', { count: properties.length })}
          </p>
        </div>

        {/* Properties Grid */}
        {properties.length === 0 ? (
          <div className="text-center py-12">
            <MapPin className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {t('marketplace.noProperties')}
            </h3>
            <p className="text-gray-600">
              {t('marketplace.noPropertiesDesc')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map((property) => (
              <div
                key={property.id}
                onClick={() => navigate(`${getMarketplaceBasePath()}/properties/${property.id}`)}
                className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
              >
                {/* Property Image */}
                <div className="h-48 bg-gradient-to-br from-blue-400 to-blue-600 relative">
                  <img
                    src={parseImages(property.images).length > 0 ? parseImages(property.images)[0] : hotelFallbackImage}
                    alt={property.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = hotelFallbackImage;
                    }}
                  />
                  {/* Stars Badge */}
                  {property.stars > 0 && (
                    <div className="absolute top-4 right-4 bg-white rounded-full px-3 py-1 flex items-center gap-1 shadow-md">
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      <span className="font-semibold text-sm">{property.stars}</span>
                    </div>
                  )}
                </div>

                {/* Property Info */}
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {property.name}
                  </h3>
                  
                  <div className="flex items-center gap-2 text-gray-600 mb-3">
                    <MapPin className="h-4 w-4" />
                    <span className="text-sm">
                      {property.city}, {property.country}
                    </span>
                  </div>

                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {property.description}
                  </p>

                  {/* Amenities */}
                  {property.amenities && parseAmenities(property.amenities).length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {parseAmenities(property.amenities).slice(0, 3).map((amenity, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full"
                        >
                          {amenity}
                        </span>
                      ))}
                      {parseAmenities(property.amenities).length > 3 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                          +{parseAmenities(property.amenities).length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* View Details Button */}
                  <button
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {t('marketplace.viewDetails')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
