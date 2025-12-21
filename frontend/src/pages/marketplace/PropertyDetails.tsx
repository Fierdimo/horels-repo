import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '@/api/client';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { MapPin, Star, ArrowLeft, Bed, Users, Euro, Calendar, Check } from 'lucide-react';
import { format } from 'date-fns';
import { useAuthStore } from '@/stores/authStore';
import roomFallbackImage from '@/assets/hotel-room-background.avif';
import hotelFallbackImage from '@/assets/hotel.avif';

// Helper functions to parse arrays from different formats
const parseArray = (data: any): string[] => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // If not JSON, try comma-separated
      return data.split(',').map(item => item.trim()).filter(Boolean);
    }
  }
  return [];
};

interface Room {
  id: number;
  name: string;
  type: string;
  description: string;
  capacity: number;
  basePrice: number;
  customPrice: number | null;
  guestPrice: number;
  amenities: string[];
  images: string[];
  status: string;
  isMarketplaceEnabled: boolean;
}

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
  check_in_time: string;
  check_out_time: string;
}

export default function PropertyDetails() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(1);

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

  // Fetch property details
  const { data: propertyData, isLoading: loadingProperty } = useQuery({
    queryKey: ['property', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/public/properties/${id}`);
      return data;
    },
    enabled: !!id
  });

  // Fetch available rooms
  const { data: roomsData, isLoading: loadingRooms } = useQuery({
    queryKey: ['property-rooms', id, guests, checkIn, checkOut],
    queryFn: async () => {
      const params: any = {};
      if (guests) params.min_capacity = guests;
      if (checkIn) params.checkIn = checkIn;
      if (checkOut) params.checkOut = checkOut;
      
      const { data } = await apiClient.get(`/public/properties/${id}/rooms`, { params });
      return data;
    },
    enabled: !!id
  });

  const property: Property | null = propertyData?.data || null;
  const rooms: Room[] = roomsData?.data || [];

  const handleBookRoom = (roomId: number) => {
    if (!checkIn || !checkOut) {
      alert(t('marketplace.selectDates'));
      return;
    }
    navigate(`${getMarketplaceBasePath()}/properties/${id}/rooms/${roomId}/book`, {
      state: { checkIn, checkOut, guests }
    });
  };

  if (loadingProperty) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {t('marketplace.propertyNotFound')}
          </h2>
          <button
            onClick={() => navigate(getMarketplaceBasePath())}
            className="text-blue-600 hover:text-blue-700"
          >
            {t('marketplace.backToMarketplace')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Back Button */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => navigate(getMarketplaceBasePath())}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
            {t('marketplace.backToProperties')}
          </button>
        </div>
      </div>

      {/* Property Header */}
      <div className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                {property.name}
              </h1>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin className="h-5 w-5" />
                  <span>{property.city}, {property.country}</span>
                </div>
                {property.stars > 0 && (
                  <div className="flex items-center gap-1">
                    {Array.from({ length: property.stars }).map((_, idx) => (
                      <Star key={idx} className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Property Image Gallery */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {parseArray(property.images).length > 0 ? (
              <>
                <div className="h-80 rounded-lg overflow-hidden">
                  <img
                    src={parseArray(property.images)[0]}
                    alt={property.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = hotelFallbackImage;
                    }}
                  />
                </div>
                {parseArray(property.images)[1] && (
                  <div className="grid grid-cols-2 gap-4">
                    {parseArray(property.images).slice(1, 5).map((img, idx) => (
                      <div key={idx} className="h-38 rounded-lg overflow-hidden">
                        <img
                          src={img}
                          alt={`${property.name} ${idx + 2}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = hotelFallbackImage;
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="h-80 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg overflow-hidden">
                <img
                  src={hotelFallbackImage}
                  alt={property.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>

          {/* Description */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {t('marketplace.aboutProperty')}
            </h2>
            <p className="text-gray-600 leading-relaxed">
              {property.description}
            </p>
          </div>

          {/* Amenities */}
          {parseArray(property.amenities).length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {t('marketplace.amenities')}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {parseArray(property.amenities).map((amenity, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-600" />
                    <span className="text-gray-700">{amenity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Check-in/out times */}
          <div className="grid grid-cols-2 gap-4 mb-8 p-4 bg-blue-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-600 mb-1">{t('marketplace.checkInTime')}</p>
              <p className="text-lg font-semibold text-gray-900">{property.check_in_time || '15:00'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">{t('marketplace.checkOutTime')}</p>
              <p className="text-lg font-semibold text-gray-900">{property.check_out_time || '11:00'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Availability */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {t('marketplace.checkAvailability')}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('marketplace.checkIn')}
              </label>
              <input
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('marketplace.checkOut')}
              </label>
              <input
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                min={checkIn || format(new Date(), 'yyyy-MM-dd')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('marketplace.guests')}
              </label>
              <select
                value={guests}
                onChange={(e) => setGuests(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {[1, 2, 3, 4, 5, 6].map((num) => (
                  <option key={num} value={num}>
                    {num} {t('marketplace.guestsLabel', { count: num })}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Available Rooms */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {t('marketplace.availableRooms')}
          </h2>

          {loadingRooms ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : rooms.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg">
              <Bed className="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {t('marketplace.noRoomsAvailable')}
              </h3>
              <p className="text-gray-600">
                {t('marketplace.noRoomsAvailableDesc')}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {rooms.map((room) => (
                <div key={room.id} className="bg-white rounded-lg shadow-sm overflow-hidden flex flex-col md:flex-row">
                  {/* Room Image */}
                  <div className="w-full md:w-80 h-64 bg-gradient-to-br from-gray-300 to-gray-500">
                    <img
                      src={parseArray(room.images).length > 0 ? parseArray(room.images)[0] : roomFallbackImage}
                      alt={room.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = roomFallbackImage;
                      }}
                    />
                  </div>

                  {/* Room Info */}
                  <div className="flex-1 p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">
                          {room.name}
                        </h3>
                        <p className="text-sm text-gray-600 mb-2">{room.type}</p>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Users className="h-4 w-4" />
                          <span className="text-sm">
                            {t('marketplace.maxGuests', { count: room.capacity })}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center justify-end gap-1 text-3xl font-bold text-gray-900">
                          <Euro className="h-7 w-7" />
                          {room.guestPrice.toFixed(2)}
                        </div>
                        <p className="text-sm text-gray-600">{t('marketplace.perNight')}</p>
                      </div>
                    </div>

                    {room.description && (
                      <p className="text-gray-600 mb-4">{room.description}</p>
                    )}

                    {/* Room Amenities */}
                    {parseArray(room.amenities).length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {parseArray(room.amenities).map((amenity, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                          >
                            {amenity}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Book Button */}
                    <button
                      onClick={() => handleBookRoom(room.id)}
                      disabled={!checkIn || !checkOut}
                      className="w-full md:w-auto px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      {!checkIn || !checkOut 
                        ? t('marketplace.selectDatesToBook') 
                        : t('marketplace.bookNow')
                      }
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
