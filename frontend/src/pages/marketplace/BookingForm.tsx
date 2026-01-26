import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import apiClient from '@/api/client';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ArrowLeft, Calendar, User, Mail, Phone, CreditCard, CheckCircle, AlertCircle } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import CreditPaymentOption from '@/components/marketplace/CreditPaymentOption';

interface Room {
  id: number;
  name: string;
  type: string;
  guestPrice?: number; // Legacy field
  pricing?: {
    guestPrice: number;
    breakdown: any;
  };
}

interface Property {
  id: number;
  name: string;
  location: string;
}

export default function BookingForm() {
  const { propertyId, roomId } = useParams<{ propertyId: string; roomId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const location = useLocation();
  const state = location.state as { checkIn: string; checkOut: string; guests: number } || {};

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

  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [checkIn, setCheckIn] = useState(state.checkIn || '');
  const [checkOut, setCheckOut] = useState(state.checkOut || '');
  const [specialRequests, setSpecialRequests] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'credits' | null>(null);
  const [creditCalculation, setCreditCalculation] = useState<any>(null);

  // Fetch user profile if logged in
  const { data: profileData } = useQuery({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const { data } = await apiClient.get('/auth/profile');
      return data;
    },
    enabled: !!user,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Precargar datos del perfil si existen
  useEffect(() => {
    if (profileData?.data) {
      const profile = profileData.data;
      setGuestName(`${profile.firstName || ''} ${profile.lastName || ''}`.trim() || '');
      setGuestEmail(profile.email || user?.email || '');
      setGuestPhone(profile.phone || '');
    } else if (user?.email) {
      setGuestEmail(user.email);
    }
  }, [profileData, user]);

  // Fetch credit calculation when credits payment method is selected
  const { data: creditCalcData } = useQuery({
    queryKey: ['credit-calculation', propertyId, roomId, checkIn, checkOut],
    queryFn: async () => {
      const { data } = await apiClient.post(
        `/public/properties/${propertyId}/rooms/${roomId}/calculate-credit-cost`,
        { checkIn, checkOut }
      );
      return data.data;
    },
    enabled: !!(paymentMethod === 'credits' && propertyId && roomId && checkIn && checkOut),
    staleTime: 60000 // 1 minute
  });

  useEffect(() => {
    if (creditCalcData) {
      setCreditCalculation(creditCalcData);
    }
  }, [creditCalcData]);

  // Mutation para actualizar perfil
  const updateProfileMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string; phone: string }) => {
      const response = await apiClient.put('/auth/profile', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success(t('profile.updated'));
    }
  });

  // Fetch room details
  const { data: roomData, isLoading: loadingRoom } = useQuery({
    queryKey: ['room-details', propertyId, roomId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/public/properties/${propertyId}/rooms/${roomId}`);
      return data;
    },
    enabled: !!propertyId && !!roomId
  });

  const room: Room | null = roomData?.data || null;
  const property: Property | null = room ? {
    id: parseInt(propertyId!),
    name: roomData?.data?.property?.name || '',
    location: roomData?.data?.property?.location || ''
  } : null;

  const nights = checkIn && checkOut ? differenceInDays(parseISO(checkOut), parseISO(checkIn)) : 0;
  
  // Get price from room, use test price of 10 EUR in development if no price set
  const roomPrice = room?.pricing?.guestPrice || room?.guestPrice || 0;
  const pricePerNight = import.meta.env.DEV && roomPrice === 0 ? 10 : roomPrice;
  
  const totalAmount = nights * pricePerNight;

  // Debug logging
  console.log('BookingForm Debug:', {
    checkIn,
    checkOut,
    nights,
    roomPrice,
    pricePerNight,
    totalAmount,
    isDev: import.meta.env.DEV,
    room,
    pricing: room?.pricing,
    state
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!guestName || !guestEmail || !checkIn || !checkOut) {
      toast.error(t('marketplace.fillAllFields'));
      return;
    }

    // Redirigir al checkout de Stripe con la información del formulario
    navigate(`${getMarketplaceBasePath()}/properties/${propertyId}/rooms/${roomId}/checkout`, {
      state: {
        checkIn,
        checkOut,
        guests: state.guests || 1,
        guestName,
        guestEmail,
        guestPhone
      }
    });
  };

  if (loadingRoom) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!room || !property) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-16 w-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {t('marketplace.roomNotFound')}
          </h2>
          <button
            onClick={() => navigate(`${getMarketplaceBasePath()}/properties/${propertyId}`)}
            className="text-blue-600 hover:text-blue-700"
          >
            {t('marketplace.backToProperty')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <button
          onClick={() => navigate(`${getMarketplaceBasePath()}/properties/${propertyId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="h-5 w-5" />
          {t('marketplace.backToProperty')}
        </button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t('marketplace.completeBooking')}
          </h1>
          <p className="text-gray-600">
            {property.name} - {room.name}
          </p>
          {/* Debug Info - Remove after testing */}
          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
            <strong>Debug:</strong> pricePerNight={pricePerNight}, 
            nights={nights}, totalAmount={totalAmount}, 
            room.pricing.guestPrice={room?.pricing?.guestPrice}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Booking Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-6">
              {/* Guest Information */}
              <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {t('marketplace.guestInformation')}
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('marketplace.fullName')} *
                    </label>
                    <input
                      type="text"
                      required
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder={t('marketplace.fullNamePlaceholder')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('marketplace.email')} *
                    </label>
                    <input
                      type="email"
                      required
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      placeholder={t('marketplace.emailPlaceholder')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('marketplace.phone')}
                    </label>
                    <input
                      type="tel"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      placeholder={t('marketplace.phonePlaceholder')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Stay Dates */}
              <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {t('marketplace.stayDates')}
                </h2>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('marketplace.checkIn')} *
                    </label>
                    <input
                      type="date"
                      required
                      value={checkIn}
                      onChange={(e) => setCheckIn(e.target.value)}
                      min={format(new Date(), 'yyyy-MM-dd')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('marketplace.checkOut')} *
                    </label>
                    <input
                      type="date"
                      required
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                      min={checkIn || format(new Date(), 'yyyy-MM-dd')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {nights > 0 && (
                  <p className="mt-2 text-sm text-gray-600">
                    {nights === 1 ? '1 noche en total' : `${nights} noches en total`}
                  </p>
                )}
              </div>

              {/* Special Requests */}
              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('marketplace.specialRequests')}
                </label>
                <textarea
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  rows={4}
                  placeholder={t('marketplace.specialRequestsPlaceholder')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Payment Options Section */}
              <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  {t('marketplace.paymentMethod')}
                </h2>

                {/* Payment Method Selector */}
                {!paymentMethod && (
                  <div className="space-y-4">
                    {/* Credit Payment Option (only for owners) */}
                    {user && user.role === 'owner' && checkIn && checkOut && guestName && guestEmail && nights > 0 && (
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('credits')}
                        className="w-full p-6 bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg hover:border-purple-400 hover:shadow-md transition-all text-left"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-3 bg-purple-100 rounded-lg">
                              <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-gray-900">{t('marketplace.payWithCredits')}</h3>
                              <p className="text-sm text-gray-600">{t('marketplace.payWithCreditsDescription')}</p>
                            </div>
                          </div>
                          <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    )}

                    {/* Card Payment Option */}
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('card')}
                      className="w-full p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg hover:border-blue-400 hover:shadow-md transition-all text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-blue-100 rounded-lg">
                            <CreditCard className="h-6 w-6 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">{t('marketplace.payWithCard')}</h3>
                            <p className="text-sm text-gray-600">{t('marketplace.securePaymentWithStripe')}</p>
                          </div>
                        </div>
                        <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  </div>
                )}

                {/* Credit Payment Card (when selected) */}
                {paymentMethod === 'credits' && user && user.role === 'owner' && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod(null)}
                      className="mb-4 text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Cambiar método de pago
                    </button>
                    <CreditPaymentOption
                      propertyId={propertyId!}
                      roomId={roomId!}
                      checkIn={checkIn}
                      checkOut={checkOut}
                      guests={state.guests || 1}
                      guestName={guestName}
                      guestEmail={guestEmail}
                      guestPhone={guestPhone}
                      totalAmount={totalAmount}
                      nights={nights}
                    />
                  </div>
                )}

                {/* Card Payment Form (when selected) */}
                {paymentMethod === 'card' && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod(null)}
                      className="mb-4 text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Cambiar método de pago
                    </button>
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border-2 border-blue-200">
                      <h3 className="text-lg font-bold text-gray-900 mb-2">
                        {t('marketplace.payWithCard')}
                      </h3>
                      <p className="text-sm text-gray-600 mb-4">
                        {t('marketplace.securePaymentWithStripe')}
                      </p>

                      <button
                        type="submit"
                        className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-semibold"
                      >
                        <CreditCard className="h-5 w-5" />
                        {t('marketplace.continueToPayment')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </form>
          </div>

          {/* Booking Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-24">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {t('marketplace.bookingSummary')}
              </h2>

              <div className="space-y-4 mb-6">
                <div className="pb-4 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-1">{room.name}</h3>
                  <p className="text-sm text-gray-600">{room.type}</p>
                </div>

                {checkIn && checkOut && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">{t('marketplace.checkIn')}</span>
                      <span className="font-medium text-gray-900">
                        {format(parseISO(checkIn), 'PP')}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">{t('marketplace.checkOut')}</span>
                      <span className="font-medium text-gray-900">
                        {format(parseISO(checkOut), 'PP')}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                      <span className="text-gray-600">{nights === 1 ? 'Noche' : 'Noches'}</span>
                      <span className="font-medium text-gray-900">{nights}</span>
                    </div>
                  </div>
                )}

                {nights > 0 && (
                  <>
                    {/* Mostrar precio en créditos o EUR según método de pago */}
                    {paymentMethod === 'credits' && creditCalculation ? (
                      <>
                        <div className="pt-4 border-t border-gray-200 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">
                              {creditCalculation.creditsPerNight} créditos × {nights} {nights === 1 ? 'noche' : 'noches'}
                            </span>
                            <span className="font-medium text-purple-900">
                              {creditCalculation.creditsRequired} créditos
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Temporada:</span>
                            <span className="font-medium text-gray-700">
                              {creditCalculation.season === 'RED' && '🔴 RED'}
                              {creditCalculation.season === 'WHITE' && '⚪ WHITE'}
                              {creditCalculation.season === 'BLUE' && '🔵 BLUE'}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Tipo de habitación:</span>
                            <span className="font-medium text-gray-700">{creditCalculation.roomType}</span>
                          </div>
                        </div>

                        <div className="pt-4 border-t-2 border-purple-300 bg-purple-50 -mx-6 px-6 py-3">
                          <div className="flex justify-between">
                            <span className="text-lg font-bold text-purple-900">
                              {t('marketplace.total')}
                            </span>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-purple-900">
                                {creditCalculation.creditsRequired} créditos
                              </div>
                              <div className="text-xs text-gray-600">
                                (≈ €{creditCalculation.totalAmountEUR?.toFixed(2)})
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="pt-4 border-t border-gray-200 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">
                              €{pricePerNight.toFixed(2)} × {nights} {nights === 1 ? 'noche' : 'noches'}
                            </span>
                            <span className="font-medium text-gray-900">
                              €{totalAmount.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        <div className="pt-4 border-t-2 border-gray-300">
                          <div className="flex justify-between">
                            <span className="text-lg font-bold text-gray-900">
                              {t('marketplace.total')}
                            </span>
                            <span className="text-2xl font-bold text-gray-900">
                              €{totalAmount.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900 mb-1">
                      {t('marketplace.awaitingApproval')}
                    </p>
                    <p className="text-xs text-blue-700">
                      {t('marketplace.awaitingApprovalDesc')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
