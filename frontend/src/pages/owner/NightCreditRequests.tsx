import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { timeshareApi } from '@/api/timeshare';
import { useOwnerNightCredits } from '@/hooks/useNightCredits';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ArrowLeft, Calendar, Hotel, CreditCard, Info, Search } from 'lucide-react';
import { format, parseISO, differenceInDays, addDays } from 'date-fns';
import toast from 'react-hot-toast';
import apiClient from '@/api/client';

export default function CreateNightCreditRequest() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { createRequest } = useOwnerNightCredits();

  // Form state
  const [selectedCreditId, setSelectedCreditId] = useState<number | null>(null);
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [nightsRequested, setNightsRequested] = useState(0);
  const [additionalNights, setAdditionalNights] = useState(0);
  const [roomType, setRoomType] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [searchingRooms, setSearchingRooms] = useState(false);

  // Get available credits
  const { data: credits, isLoading: creditsLoading } = useQuery({
    queryKey: ['credits'],
    queryFn: timeshareApi.getCredits
  });

  // Get marketplace properties
  const { data: properties, isLoading: propertiesLoading } = useQuery({
    queryKey: ['marketplace-properties'],
    queryFn: async () => {
      const { data } = await apiClient.get('/public/properties');
      return Array.isArray(data) ? data : data?.data || [];
    },
    enabled: true
  });

  // Get available rooms when property and dates are selected
  const { data: availableRooms, isLoading: roomsLoading, refetch: refetchRooms } = useQuery({
    queryKey: ['available-rooms', propertyId, checkIn, checkOut],
    queryFn: async () => {
      if (!propertyId || !checkIn || !checkOut) return [];
      
      const { data } = await apiClient.get(`/api/rooms/availability/${propertyId}`, {
        params: {
          startDate: checkIn,
          endDate: checkOut
        }
      });
      return data?.data || [];
    },
    enabled: false
  });

  // Get commission settings
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await apiClient.get('/settings');
      return data;
    }
  });

  // Trigger room search when dates and property are set
  useEffect(() => {
    if (propertyId && checkIn && checkOut) {
      refetchRooms();
    }
  }, [propertyId, checkIn, checkOut, refetchRooms]);

  const availableCredits = credits?.filter(c => c.nights_available > c.nights_used) || [];

  const selectedCredit = availableCredits.find(c => c.id === selectedCreditId);
  const availableNights = selectedCredit 
    ? selectedCredit.nights_available - selectedCredit.nights_used 
    : 0;

  // Calculate total nights and costs
  const totalNights = checkIn && checkOut 
    ? differenceInDays(new Date(checkOut), new Date(checkIn))
    : 0;

  const nightsToUseFromCredit = Math.min(nightsRequested, availableNights);
  const extraNightsToBuy = Math.max(0, totalNights - nightsToUseFromCredit);

  const PRICE_PER_NIGHT = 100; // €100 per night
  const commissionRate = settings?.creditConversionFee ? Number(settings.creditConversionFee) / 100 : 0.05;
  
  const additionalPrice = extraNightsToBuy * PRICE_PER_NIGHT;
  const commission = additionalPrice * commissionRate;
  const totalCost = additionalPrice + commission;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCreditId || !propertyId || !checkIn || !checkOut || nightsRequested === 0) {
      toast.error(t('auth.pleaseFillAllFields'));
      return;
    }

    if (nightsRequested > availableNights) {
      toast.error(t('owner.nightCredits.insufficientNights', { nights: availableNights }));
      return;
    }

    if (totalNights > nightsRequested + additionalNights) {
      toast.error(t('owner.nightCredits.nightsMismatch'));
      return;
    }

    // Get room_type from selected room if available
    let finalRoomType = roomType || undefined;
    if (selectedRoomId && availableRooms) {
      const selectedRoom = availableRooms.find((r: any) => r.roomId === selectedRoomId);
      if (selectedRoom) {
        // Only use roomType field from PMS availability data
        finalRoomType = selectedRoom.roomType || roomType || undefined;
      }
    }

    try {
      await createRequest.mutateAsync({
        creditId: selectedCreditId,
        propertyId,
        checkIn,
        checkOut,
        nightsRequested,
        additionalNights: extraNightsToBuy,
        roomType: finalRoomType
      });

      toast.success(t('owner.nightCredits.createSuccess'));
      navigate('/owner/night-credit-requests');
    } catch (error) {
      // Error handled by hook
    }
  };

  if (creditsLoading || propertiesLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (availableCredits.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <button
            onClick={() => navigate('/owner/credits')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            {t('common.back')} {t('nav.credits')}
          </button>

          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <CreditCard className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {t('owner.credits.noCredits')}
            </h2>
            <p className="text-gray-600 mb-6">
              {t('owner.credits.noCreditsDesc')}
            </p>
            <button
              onClick={() => navigate('/owner/credits')}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t('owner.nightCredits.actions.goToCredits')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <button
          onClick={() => navigate('/owner/credits')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to Credits
        </button>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-blue-50 border-b border-blue-100">
            <h1 className="text-2xl font-bold text-gray-900">
              {t('owner.nightCredits.createRequest')}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {t('owner.credits.subtitle')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Select Credit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <CreditCard className="inline h-4 w-4 mr-2" />
                {t('owner.nightCredits.selectCredit')}
              </label>
              <select
                value={selectedCreditId || ''}
                onChange={(e) => setSelectedCreditId(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">{t('common.select')} {t('owner.credits.credits').toLowerCase()}</option>
                {availableCredits.map((credit) => {
                  const available = credit.nights_available - credit.nights_used;
                  return (
                    <option key={credit.id} value={credit.id}>
                      {t('owner.credits.credits')} #{credit.id} - {available} {t('common.nights').toLowerCase()} ({t('owner.credits.expiresAt').toLowerCase()} {format(parseISO(credit.expires_at), 'MMM d, yyyy')})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Property Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Hotel className="inline h-4 w-4 mr-2" />
                {t('common.property')}
              </label>
              <select
                value={propertyId || ''}
                onChange={(e) => {
                  setPropertyId(Number(e.target.value));
                  setSelectedRoomId(null); // Reset room selection
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">{t('common.select')}...</option>
                {Array.isArray(properties) && properties.map((property: any) => (
                  <option key={property.id} value={property.id}>
                    {property.name} - {property.city}, {property.country}
                  </option>
                ))}
              </select>
            </div>

            {/* Check-in Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="inline h-4 w-4 mr-2" />
                {t('owner.nightCredits.checkInDate')}
              </label>
              <input
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            {/* Check-out Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="inline h-4 w-4 mr-2" />
                {t('owner.nightCredits.checkOutDate')}
              </label>
              <input
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                min={checkIn || format(new Date(), 'yyyy-MM-dd')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            {/* Nights from Credit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('owner.nightCredits.nightsFromCredit')}
              </label>
              <input
                type="number"
                value={nightsRequested}
                onChange={(e) => setNightsRequested(Number(e.target.value))}
                min={0}
                max={availableNights}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                {t('owner.credits.availableNights')}: {availableNights} {t('common.nights').toLowerCase()}
              </p>
            </div>

            {/* Room Type (Optional) */}
            {availableRooms && availableRooms.length > 0 ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('owner.nightCredits.roomType')}
                </label>
                <select
                  value={selectedRoomId || ''}
                  onChange={(e) => {
                    const roomIdValue = e.target.value;
                    setSelectedRoomId(roomIdValue || null);
                    
                    // Auto-fill roomType from selected room
                    if (roomIdValue) {
                      const room = availableRooms.find((r: any) => r.roomId === roomIdValue);
                      if (room) {
                        // Use roomType field from the availability data
                        setRoomType(room.roomType || 'Standard');
                      }
                    } else {
                      setRoomType('');
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">{t('common.selectOption')}</option>
                  {availableRooms.map((room: any) => (
                    <option key={room.roomId} value={room.roomId}>
                      {room.roomType || 'Standard Room'}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {roomsLoading ? t('common.loading') : `${availableRooms.length} ${t('common.available').toLowerCase()}`}
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('owner.nightCredits.roomTypeOptional')}
                </label>
                <input
                  type="text"
                  value={roomType}
                  onChange={(e) => setRoomType(e.target.value)}
                  placeholder={t('owner.nightCredits.roomTypePlaceholder')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {!roomsLoading && propertyId && checkIn && checkOut && (
                  <p className="mt-1 text-xs text-yellow-600">
                    {t('owner.nightCredits.noRoomsAvailable')}
                  </p>
                )}
              </div>
            )}

            {/* Cost Summary */}
            {totalNights > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <Info className="h-5 w-5 text-blue-600 mr-3 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">
                      {t('owner.nightCredits.summary')}
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">{t('owner.nightCredits.totalNights')}:</span>
                        <span className="font-medium text-gray-900">{totalNights}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">{t('owner.nightCredits.usingFromCredit')}:</span>
                        <span className="font-medium text-green-600">{nightsToUseFromCredit} {t('owner.nightCredits.nights')} ({t('owner.nightCredits.free')})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">{t('owner.nightCredits.additionalNights')}:</span>
                        <span className="font-medium text-gray-900">{extraNightsToBuy} {t('owner.nightCredits.nights')}</span>
                      </div>
                      {extraNightsToBuy > 0 && (
                        <>
                          <div className="border-t border-blue-200 pt-2 mt-2"></div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">{t('owner.nightCredits.nightsCost')}:</span>
                            <span className="font-medium text-gray-900">€{additionalPrice.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">{t('owner.nightCredits.platformFee')}:</span>
                            <span className="font-medium text-gray-900">€{commission.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-base font-bold border-t border-blue-200 pt-2 mt-2">
                            <span className="text-gray-900">{t('owner.nightCredits.totalToPay')}:</span>
                            <span className="text-blue-600">€{totalCost.toFixed(2)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => navigate('/owner/credits')}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={createRequest.isPending}
                className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createRequest.isPending ? t('common.creating') : t('owner.nightCredits.createRequest')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
