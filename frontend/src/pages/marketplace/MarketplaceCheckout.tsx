import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/client';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ArrowLeft, CreditCard, User, Mail, Phone } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { useAuthStore } from '@/stores/authStore';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { CreditPaymentSelector } from '@/components/marketplace/CreditPaymentSelector';

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

function CheckoutForm({ 
  propertyId, 
  roomType, 
  checkIn, 
  checkOut, 
  guests, 
  totalAmount,
  user,
  navigate
}: {
  propertyId: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  totalAmount: number;
  user: any;
  navigate: any;
}) {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'credits' | 'hybrid'>('card');
  const [creditsToUse, setCreditsToUse] = useState(0);

  // Credits only available for owners booking timeshare units.
  // Guests always pay by card. Hotel rooms (room-*) always pay by card even for owners.
  const allowCredits = user?.role === 'owner' && !String(roomType).startsWith('room-');

  // Guest information form - prefilled from user data
  const [guestInfo, setGuestInfo] = useState({
    name: user?.firstName && user?.lastName 
      ? `${user.firstName} ${user.lastName}`.trim()
      : user?.firstName || user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || ''
  });

  console.log('🎨 CheckoutForm rendered', { stripe: !!stripe, elements: !!elements, user: !!user });

  const handlePaymentMethodChange = (method: 'card' | 'credits' | 'hybrid', credits?: number) => {
    setPaymentMethod(method);
    setCreditsToUse(credits || 0);
    console.log('💳 Payment method changed:', { method, credits });
  };

  const createPaymentIntent = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post(
        `/api/marketplace/properties/${propertyId}/room-types/${encodeURIComponent(roomType)}/create-payment-intent`,
        data
      );
      return response.data;
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('🔵 handleSubmit called', { paymentMethod, creditsToUse });
    
    if (!guestInfo.name || !guestInfo.email) {
      console.log('❌ Missing guest info');
      setError('Please fill in all required fields');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Si paga solo con créditos (no necesita Stripe)
      if (paymentMethod === 'credits') {
        console.log('💜 Creating booking with credits only...');
        
        const bookingPayload = {
          propertyId,
          roomType,
          checkIn,
          checkOut,
          guests,
          guestName: guestInfo.name,
          guestEmail: guestInfo.email,
          guestPhone: guestInfo.phone,
          userId: user?.id,
          creditsToUse: Number(creditsToUse) // Convertir a número
        };
        
        console.log('📦 Credits-only booking payload:', bookingPayload);
        
        const bookingResponse = await apiClient.post('/api/marketplace/bookings/with-credits', bookingPayload);
        
        console.log('✅ Booking created with credits:', bookingResponse.data);
        
        await queryClient.invalidateQueries({ queryKey: ['myBookings'] });
        navigate('/guest/marketplace/booking-success', {
          state: { 
            booking: bookingResponse.data.data,
            message: `Booking confirmed! You used ${Number(creditsToUse).toLocaleString()} credits.`,
            type: 'success'
          }
        });
        return;
      }

      // Para pago con tarjeta o híbrido, necesitamos Stripe
      if (!stripe || !elements) {
        console.log('❌ Stripe not loaded');
        setError('Payment system not loaded. Please refresh the page.');
        return;
      }

      // Obtener el precio real basado en la fórmula maestra del backend
      const creditPriceResponse = await apiClient.post(
        `/api/marketplace/properties/${propertyId}/room-types/${encodeURIComponent(roomType)}/calculate-credit-price`,
        { checkIn, checkOut, guests }
      );
      const creditPrice = creditPriceResponse.data.data;
      const actualTotalEur = creditPrice.totalEur;
      const creditToEurRate = creditPrice.creditToEurRate;

      // Calcular el monto que va a la tarjeta
      let cardAmount = actualTotalEur;
      if (paymentMethod === 'hybrid') {
        const creditsValueEur = creditsToUse * creditToEurRate;
        cardAmount = Math.max(0, actualTotalEur - creditsValueEur);
        console.log('💳 Hybrid payment:', { actualTotalEur, creditsToUse, creditsValueEur, cardAmount, creditPrice });
      } else {
        console.log('💳 Card-only payment:', { actualTotalEur, creditPrice });
      }

      console.log('🔵 Creating payment intent for €', cardAmount);
      
      // Step 1: Create payment intent con el monto correcto (ya descontados los créditos)
      const { data: paymentData } = await createPaymentIntent.mutateAsync({
        guestName: guestInfo.name,
        guestEmail: guestInfo.email,
        guestPhone: guestInfo.phone,
        checkIn,
        checkOut,
        guests,
        amount: cardAmount // Pasar el monto exacto a cobrar (ya con créditos descontados)
      });

      console.log('✅ Payment intent created:', paymentData);

      if (!paymentData?.clientSecret) {
        throw new Error('Failed to create payment intent');
      }

      console.log('🔵 Confirming card payment...');
      
      // Step 2: Confirm payment with Stripe
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        paymentData.clientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: guestInfo.name,
              email: guestInfo.email,
              phone: guestInfo.phone
            }
          }
        }
      );

      if (stripeError) {
        throw new Error(stripeError.message);
      }

      console.log('✅ Payment confirmed:', paymentIntent?.status);

      if (paymentIntent?.status === 'succeeded') {
        console.log('🔵 Creating booking record...');
        
        // Step 3: Create booking record in database
        try {
          let bookingResponse;
          
          if (paymentMethod === 'hybrid') {
            // Booking híbrido: créditos + tarjeta
            console.log('📦 Hybrid booking payload:', {
              propertyId,
              roomType,
              checkIn,
              checkOut,
              guests,
              guestName: guestInfo.name,
              guestEmail: guestInfo.email,
              guestPhone: guestInfo.phone,
              userId: user?.id,
              creditsToUse: Number(creditsToUse), // Asegurar que sea número
              paymentIntentId: paymentIntent.id
            });
            
            bookingResponse = await apiClient.post('/api/marketplace/bookings/with-credits', {
              propertyId,
              roomType,
              checkIn,
              checkOut,
              guests,
              guestName: guestInfo.name,
              guestEmail: guestInfo.email,
              guestPhone: guestInfo.phone,
              userId: user?.id,
              creditsToUse: Number(creditsToUse), // Convertir a número
              paymentIntentId: paymentIntent.id
            });
          } else {
            // Solo tarjeta
            bookingResponse = await apiClient.post('/api/marketplace/bookings', {
              propertyId,
              roomType,
              checkIn,
              checkOut,
              guests,
              guestName: guestInfo.name,
              guestEmail: guestInfo.email,
              guestPhone: guestInfo.phone,
              userId: user?.id || null,
              paymentIntentId: paymentIntent.id,
              totalAmount: paymentData.amount,
              currency: paymentData.currency,
              nights: paymentData.nights
            });
          }
          
          console.log('✅ Booking created:', bookingResponse.data);
          
          await queryClient.invalidateQueries({ queryKey: ['myBookings'] });
          
          // Navigate to success page with booking data
          const message = paymentMethod === 'hybrid' 
            ? `Booking confirmed! You used ${creditsToUse.toLocaleString()} credits + €${cardAmount.toFixed(2)}.`
            : 'Booking confirmed! Check your email for details.';
          
          queryClient.invalidateQueries({ queryKey: ['myBookings'] });
          navigate('/guest/marketplace/booking-success', {
            state: { 
              booking: bookingResponse.data.data,
              message,
              type: 'success'
            }
          });
        } catch (bookingError: any) {
          console.error('❌ Error creating booking:', bookingError);
          console.error('❌ Error response:', bookingError.response?.data);
          const errorMessage = bookingError.response?.data?.error || bookingError.message || 'Unknown error';
          setError(`Payment successful but booking creation failed: ${errorMessage}. Please contact support with payment ID: ` + paymentIntent.id);
        }
      } else {
        throw new Error('Payment was not successful');
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Guest Information */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <User className="w-5 h-5 mr-2" />
          {t('marketplace.checkout.guestInformation')}
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('marketplace.checkout.fullNameRequired')}
            </label>
            <input
              type="text"
              value={guestInfo.name}
              onChange={(e) => setGuestInfo({ ...guestInfo, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="John Doe"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('marketplace.checkout.emailAddressRequired')}
            </label>
            <input
              type="email"
              value={guestInfo.email}
              onChange={(e) => setGuestInfo({ ...guestInfo, email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="john@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('marketplace.checkout.phoneNumber')}
            </label>
            <input
              type="tel"
              value={guestInfo.phone}
              onChange={(e) => setGuestInfo({ ...guestInfo, phone: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="+1 (555) 123-4567"
            />
          </div>
        </div>
      </div>

      {/* Payment Method Selector */}
      <CreditPaymentSelector
        userId={user?.id || null}
        propertyId={propertyId}
        roomType={roomType}
        checkIn={checkIn}
        checkOut={checkOut}
        guests={guests}
        totalAmount={totalAmount}
        allowCredits={allowCredits}
        onPaymentMethodChange={handlePaymentMethodChange}
      />

      {/* Card Payment Information (only if paying with card or hybrid) */}
      {(paymentMethod === 'card' || paymentMethod === 'hybrid') && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <CreditCard className="w-5 h-5 mr-2" />
            {paymentMethod === 'hybrid' ? t('marketplace.checkout.cardPaymentRemaining') : t('marketplace.checkout.cardPayment')}
          </h2>
          
          <div className="border border-gray-300 rounded-lg p-4">
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#424770',
                    '::placeholder': {
                      color: '#aab7c4',
                    },
                  },
                  invalid: {
                    color: '#9e2146',
                  },
                },
              }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={(!stripe && paymentMethod !== 'credits') || isProcessing}
        onClick={() => console.log('🔴 Button clicked!', { paymentMethod, creditsToUse, stripe: !!stripe, isProcessing })}
        className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold text-lg"
      >
        {isProcessing 
          ? t('marketplace.checkout.processing') 
          : paymentMethod === 'credits' 
            ? t('marketplace.checkout.bookWithCredits', { count: creditsToUse })
            : paymentMethod === 'hybrid'
              ? t('marketplace.checkout.bookWithCreditsAndCard', { count: creditsToUse })
              : t('marketplace.checkout.payAmount', { amount: totalAmount.toFixed(2) })
        }
      </button>

      <p className="text-xs text-gray-500 text-center">
        {paymentMethod === 'credits' 
          ? t('marketplace.checkout.creditsSecurityNote')
          : t('marketplace.checkout.paymentSecurityNote')
        }
      </p>
    </form>
  );
}

export default function MarketplaceCheckout() {
  const { propertyId, roomType } = useParams<{ propertyId: string; roomType: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const location = useLocation();
  const state = location.state as {
    checkIn: string;
    checkOut: string;
    guests: number;
    roomData?: {
      name: string;
      description?: string;
      basePrice: number;
      guestPrice: number;
      rate: number;
    };
  } | null;

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

  // Fetch room type details from V2 marketplace API (only when state.roomData is missing)
  const { data: roomData, isLoading: loadingRoom } = useQuery({
    queryKey: ['room-type-details-v2', propertyId, roomType, state?.checkIn, state?.checkOut],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (state?.checkIn) params.set('checkIn', state.checkIn);
      if (state?.checkOut) params.set('checkOut', state.checkOut);
      const { data } = await apiClient.get(
        `/api/marketplace/properties/${propertyId}?${params}`
      );
      // Extract the matching room type from the property detail response
      const matchingRoom = (data?.data?.roomTypes || []).find(
        (rt: any) => String(rt.id) === String(roomType) || rt.name === roomType
      );
      return { success: true, data: matchingRoom || null };
    },
    // Skip the API call entirely if we already have roomData from navigation state
    enabled: !!propertyId && !!roomType && !state?.roomData
  });

  if (!state?.checkIn || !state?.checkOut) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {t('marketplace.checkout.missingBookingInfo')}
            </h2>
            <p className="text-gray-600 mb-6">
              {t('marketplace.checkout.selectDatesFirst')}
            </p>
            <button
              onClick={() => navigate(`${getMarketplaceBasePath()}/properties/${propertyId}`)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
            >
              {t('marketplace.checkout.backToProperty')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Only block with loading/error if we actually need the API (state.roomData is absent)
  if (!state?.roomData && loadingRoom) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!state?.roomData && !roomData?.data) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {t('marketplace.checkout.roomTypeNotAvailable')}
            </h2>
            <p className="text-gray-600 mb-6">
              {t('marketplace.checkout.roomNotAvailableDates')}
            </p>
            <button
              onClick={() => navigate(`${getMarketplaceBasePath()}/properties/${propertyId}`)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
            >
              {t('marketplace.checkout.backToProperty')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Use state.roomData (from PropertyDetails navigation) or fall back to API response
  const room = state.roomData || roomData?.data || {};
  const nights = differenceInDays(parseISO(state.checkOut), parseISO(state.checkIn));
  const pricePerNight = Number(
    (room as any).guestPrice
    || (room as any).basePrice
    || (room as any).rate
    || (roomData?.data as any)?.pricing?.guestPrice
    || 0
  );
  const totalAmount = nights * pricePerNight;

  return (
    <Elements stripe={stripePromise}>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => navigate(`${getMarketplaceBasePath()}/properties/${propertyId}`)}
              className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              {t('marketplace.checkout.backToProperty')}
            </button>
            <h1 className="text-3xl font-bold text-gray-900">{t('marketplace.checkout.title')}</h1>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content - Forms */}
            <div className="lg:col-span-2">
              <CheckoutForm
                propertyId={propertyId!}
                roomType={roomType!}
                checkIn={state.checkIn}
                checkOut={state.checkOut}
                guests={state.guests}
                totalAmount={totalAmount}
                user={user}
                navigate={navigate}
              />
            </div>

            {/* Sidebar - Booking Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-lg p-6 sticky top-6">
                <h2 className="text-xl font-semibold mb-4">{t('marketplace.checkout.bookingSummary')}</h2>
                
                <div className="space-y-4 mb-6">
                  <div>
                    <p className="text-sm text-gray-600">{t('marketplace.checkout.roomType')}</p>
                    <p className="font-semibold">{(room as any).name || roomType}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">{t('marketplace.checkout.checkInLabel')}</p>
                      <p className="font-medium">{format(parseISO(state.checkIn), 'MMM dd')}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">{t('marketplace.checkout.checkOutLabel')}</p>
                      <p className="font-medium">{format(parseISO(state.checkOut), 'MMM dd')}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600">{t('marketplace.checkout.guestsLabel')}</p>
                    <p className="font-medium">{state.guests} {state.guests === 1 ? t('marketplace.guestSingular') : t('marketplace.guestPlural')}</p>
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>€{pricePerNight.toFixed(2)} × {nights} {t('marketplace.checkout.nights')}</span>
                      <span>€{totalAmount.toFixed(2)}</span>
                    </div>
                    
                    <div className="flex justify-between text-lg font-bold">
                      <span>{t('marketplace.checkout.total')}</span>
                      <span>€{totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Elements>
  );
}
