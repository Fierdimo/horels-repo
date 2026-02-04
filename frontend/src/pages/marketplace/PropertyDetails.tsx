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
  id: string | number;
  name: string;
  type?: string;
  description: string;
  capacity: number;
  basePrice: number;
  customPrice?: number | null;
  guestPrice?: number;
  rate?: number; // For Mock PMS
  amenities: string[];
  images: string[];
  status?: string;
  isMarketplaceEnabled?: boolean;
  available?: boolean;
  availableRooms?: number;
  totalRooms?: number;
}

interface Property {
  id: string | number;
  name: string;
  location?: string;
  address?: string;
  description: string;
  city: string;
  country: string;
  stars?: number;
  images: string[];
  amenities: string[];
  check_in_time?: string;
  check_out_time?: string;
  checkInTime?: string;
  checkOutTime?: string;
  roomTypes?: Room[];
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
      const { data } = await apiClient.get(`/api/marketplace/properties/${id}`);
      console.log('🏨 Property Data received:', data);
      console.log('🏨 Property roomTypes:', data?.data?.roomTypes);
      return data;
    },
    enabled: !!id
  });

  // Fetch available rooms
  const { data: roomsData, isLoading: loadingRooms } = useQuery({
    queryKey: ['property-rooms', id, guests, checkIn, checkOut],
    queryFn: async () => {
      console.log('🔍 Fetching rooms with:', { checkIn, checkOut, guests });
      
      // For Mock PMS, rooms are included in property details
      // But we can also check availability if dates are provided
      if (checkIn && checkOut) {
        try {
          const params = new URLSearchParams({
            checkIn,
            checkOut
          });
          console.log('📅 Fetching availability for dates:', checkIn, checkOut);
          const { data } = await apiClient.get(`/api/marketplace/properties/${id}/availability?${params}`);
          console.log('✅ Availability response:', data);
          return data;
        } catch (error) {
          console.warn('⚠️ Could not fetch availability, using property room types:', error);
          console.log('🔄 Fallback to propertyData:', propertyData?.data);
          // Return property data as fallback
          return { data: propertyData?.data || null };
        }
      }
      // Return property data when no dates selected
      console.log('📋 No dates selected, using property data:', propertyData?.data);
      return { data: propertyData?.data || null };
    },
    enabled: !!id && !!propertyData,
    staleTime: 30000 // 30 seconds
  });

  const property: Property | null = propertyData?.data || null;
  
  console.log('🏢 Property object:', property);
  console.log('🛏️ roomsData:', roomsData);
  console.log('🗓️ checkIn/checkOut:', checkIn, checkOut);
  
  // Log complete property.roomTypes to see what fields we have
  if (property?.roomTypes) {
    console.log('📋 property.roomTypes FULL:', JSON.stringify(property.roomTypes, null, 2));
  }
  
  // Get rooms from either roomsData or property.roomTypes (Mock PMS)
  let rooms: Room[] = [];
  
  // Priority 0: If PMS availability data with details exists (has roomCategory, description, etc.)
  if (checkIn && checkOut && roomsData?.data?.details && Array.isArray(roomsData.data.details)) {
    console.log('✅ Priority 0: Using PMS details data');
    console.log('📦 PMS details:', roomsData.data.details);
    rooms = roomsData.data.details.map((rt: any) => ({
      id: rt.roomCategory, // Use roomCategory as ID
      name: rt.roomCategory, // This is the room type name from PMS (e.g., "Studios", "Deluxe Suite")
      description: rt.description || '',
      capacity: rt.capacity || 2,
      basePrice: rt.rate || 0,
      rate: rt.rate || 0,
      guestPrice: rt.rate || 0,
      amenities: rt.amenities || [],
      images: rt.images || [],
      available: (rt.availableRooms || 0) > 0,
      availableRooms: rt.availableRooms || 0,
      totalRooms: rt.totalRooms || 0,
      type: rt.roomCategory || '',
      bedrooms: rt.bedrooms,
      bathrooms: rt.bathrooms,
      sizeSqm: rt.sizeSqm
    }));
  }
  // Priority 1: If dates are selected and availability data exists
  else if (checkIn && checkOut && roomsData?.data?.availability && roomsData.data.availability.length > 0) {
    console.log('✅ Priority 1: Using availability data');
    console.log('📦 Raw availability data:', roomsData.data.availability);
    
    // Create a map of availability by unitId for quick lookup
    const availabilityMap = new Map(
      roomsData.data.availability.map((avail: any) => [avail.unitId, avail])
    );
    
    // Merge property.roomTypes with availability data
    if (property?.roomTypes && property.roomTypes.length > 0) {
      console.log('🔄 Merging property.roomTypes with availability data');
      rooms = property.roomTypes.map((rt: any) => {
        const availData = availabilityMap.get(rt.id);
        console.log(`  Room ${rt.id}:`, { 
          originalRoom: rt, 
          availData,
          merged: availData ? true : false 
        });
        
        return {
          id: rt.id,
          name: availData?.unitName || rt.name || rt.roomTypeName || rt.type || `Room ${rt.id}`,
          description: rt.description || '',
          capacity: rt.capacity || rt.maxOccupancy || rt.maxGuests || 2,
          basePrice: availData?.price || rt.basePrice || rt.rate || 0,
          rate: availData?.price || rt.rate || rt.basePrice || 0,
          guestPrice: availData?.price || rt.guestPrice || rt.basePrice || rt.rate || 0,
          amenities: rt.amenities || [],
          images: rt.images || [],
          available: availData ? availData.available : (rt.available !== false),
          availableRooms: availData ? availData.availableUnits : rt.quantity,
          totalRooms: availData ? availData.totalUnits : rt.quantity,
          bookedUnits: availData ? availData.bookedUnits : 0,
          releasedWeeks: availData ? availData.releasedWeeks : 0,
          type: rt.type || '',
          bedrooms: rt.bedrooms,
          bathrooms: rt.bathrooms,
          sizeSqm: rt.sizeSqm
        };
      });
    } else {
      console.log('⚠️ No property.roomTypes to merge, using availability data only');
      // Fallback: use only availability data (will have limited info)
      rooms = roomsData.data.availability.map((avail: any) => ({
        id: avail.unitId,
        name: `Room ${avail.unitId}`,
        description: '',
        capacity: 2,
        basePrice: avail.price,
        rate: avail.price,
        guestPrice: avail.price,
        amenities: [],
        images: [],
        available: avail.available,
        availableRooms: avail.availableUnits,
        totalRooms: avail.totalUnits,
        bookedUnits: avail.bookedUnits,
        releasedWeeks: avail.releasedWeeks,
        type: ''
      }));
    }
  } 
  // Priority 2: Use room types from property data (Mock PMS or default)
  else if (property?.roomTypes && property.roomTypes.length > 0) {
    console.log('✅ Priority 2: Using property.roomTypes');
    console.log('📦 property.roomTypes:', property.roomTypes);
    rooms = property.roomTypes.map((rt: any) => ({
      id: rt.id,
      name: rt.name,
      description: rt.description || '',
      capacity: rt.capacity || 2,
      basePrice: rt.basePrice || rt.rate || 0,
      rate: rt.basePrice || rt.rate || 0,
      guestPrice: rt.guestPrice || rt.basePrice || rt.rate || 0,
      amenities: rt.amenities || [],
      images: rt.images || [],
      available: rt.available !== false,
      availableRooms: rt.quantity
    }));
  } 
  // Priority 3: Check if roomsData.data is directly the rooms array
  else if (roomsData?.data && Array.isArray(roomsData.data)) {
    console.log('✅ Priority 3: Using roomsData.data array');
    rooms = roomsData.data;
  }
  // Priority 4: Check if roomsData.data.data exists (nested structure)
  else if (roomsData?.data?.data && Array.isArray(roomsData.data.data)) {
    console.log('✅ Priority 4: Using roomsData.data.data array (nested)');
    rooms = roomsData.data.data;
  }
  else {
    console.log('⚠️ NO ROOMS FOUND - Debug info:');
    console.log('  - checkIn:', checkIn);
    console.log('  - checkOut:', checkOut);
    console.log('  - roomsData?.data?.availability:', roomsData?.data?.availability);
    console.log('  - property?.roomTypes:', property?.roomTypes);
    console.log('  - roomsData?.data:', roomsData?.data);
  }
  
  console.log('🎯 Final rooms array:', rooms);
  console.log('🎯 Final rooms count:', rooms.length);

  const handleBookRoom = (roomType: string) => {
    console.log('🔵 handleBookRoom called with roomType:', roomType);
    console.log('🔵 checkIn:', checkIn);
    console.log('🔵 checkOut:', checkOut);
    console.log('🔵 guests:', guests);
    console.log('🔵 user:', user);
    console.log('🔵 user.role:', user?.role);
    
    if (!checkIn || !checkOut) {
      console.log('❌ Missing dates - showing alert');
      alert(t('marketplace.selectDates'));
      return;
    }
    
    // Find the room data to pass pricing info
    const selectedRoom = rooms.find(r => r.name === roomType || r.roomCategory === roomType);
    console.log('🔵 selectedRoom:', selectedRoom);
    
    // Always use /guest/marketplace path for checkout (public access)
    const navigationPath = `/guest/marketplace/properties/${id}/room-types/${encodeURIComponent(roomType)}/checkout`;
    const navigationState = { 
      checkIn, 
      checkOut, 
      guests,
      // Pass room pricing data
      roomData: selectedRoom ? {
        name: selectedRoom.name || selectedRoom.roomCategory,
        description: selectedRoom.description,
        basePrice: selectedRoom.basePrice || selectedRoom.rate,
        guestPrice: selectedRoom.guestPrice || selectedRoom.rate,
        rate: selectedRoom.rate
      } : null,
      // Pre-fill guest info if user is logged in
      guestName: user?.email ? `${(user as any).firstName || ''} ${(user as any).lastName || ''}`.trim() : '',
      guestEmail: user?.email || '',
      guestPhone: (user as any)?.phone || ''
    };
    
    console.log('✅ Navigating to:', navigationPath);
    console.log('✅ With state:', navigationState);
    
    // Navigate directly to checkout (skip intermediate booking form)
    navigate(navigationPath, { state: navigationState });
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
              <p className="text-lg font-semibold text-gray-900">
                {property.check_in_time || property.checkInTime || '15:00'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">{t('marketplace.checkOutTime')}</p>
              <p className="text-lg font-semibold text-gray-900">
                {property.check_out_time || property.checkOutTime || '11:00'}
              </p>
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
                    {num} {num === 1 ? 'huésped' : 'huéspedes'}
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
              {rooms.map((room, index) => (
                <div key={room.id || `room-${index}`} className="bg-white rounded-lg shadow-sm overflow-hidden flex flex-col md:flex-row">
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
                        <h3 className="text-3xl font-bold text-blue-600 mb-2">
                          {room.name}
                        </h3>
                        {room.type && <p className="text-sm text-gray-600 mb-2">{room.type}</p>}
                        <div className="flex items-center gap-2 text-gray-600">
                          <Users className="h-4 w-4" />
                          <span className="text-sm">
                            Hasta {room.capacity} {room.capacity === 1 ? 'huésped' : 'huéspedes'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center justify-end gap-1 text-3xl font-bold text-gray-900">
                          <Euro className="h-7 w-7" />
                          {Number(room.guestPrice || room.rate || room.basePrice || 0).toFixed(2)}
                        </div>
                        <p className="text-sm text-gray-600">{t('marketplace.perNight')}</p>
                        {room.availableRooms !== undefined && (
                          <div className="mt-1 text-sm">
                            <p className={`font-medium ${room.availableRooms > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {room.availableRooms > 0 
                                ? `${room.availableRooms} disponibles` 
                                : 'No disponible'}
                            </p>
                            {room.totalRooms !== undefined && (
                              <p className="text-gray-500 text-xs">
                                de {room.totalRooms} unidades totales
                                {(room as any).bookedUnits !== undefined && ` (${(room as any).bookedUnits} reservadas)`}
                              </p>
                            )}
                          </div>
                        )}
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
                      onClick={() => handleBookRoom(room.name)}
                      disabled={!checkIn || !checkOut || (room.available === false)}
                      className="w-full md:w-auto px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      {!checkIn || !checkOut 
                        ? t('marketplace.selectDatesToBook') 
                        : room.available === false
                        ? 'No disponible'
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
