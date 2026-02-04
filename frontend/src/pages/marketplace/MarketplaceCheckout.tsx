import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import apiClient from '@/api/client';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ArrowLeft, CreditCard, User, Mail, Phone } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { useAuthStore } from '@/stores/authStore';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

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
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Guest information form - prefilled from user data
  const [guestInfo, setGuestInfo] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || ''
  });

  console.log('🎨 CheckoutForm rendered', { stripe: !!stripe, elements: !!elements, user: !!user });

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
    
    console.log('🔵 handleSubmit called');
    console.log('🔵 stripe:', !!stripe);
    console.log('🔵 elements:', !!elements);
    
    if (!stripe || !elements) {
      console.log('❌ Stripe not loaded');
      return;
    }

    if (!guestInfo.name || !guestInfo.email) {
      console.log('❌ Missing guest info');
      setError('Please fill in all required fields');
      return;
    }

    console.log('✅ Starting payment process...');
    setIsProcessing(true);
    setError(null);

    try {
      console.log('🔵 Creating payment intent...');
      // Step 1: Create payment intent
      const { data: paymentData } = await createPaymentIntent.mutateAsync({
        guestName: guestInfo.name,
        guestEmail: guestInfo.email,
        guestPhone: guestInfo.phone,
        checkIn,
        checkOut,
        guests
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
          const bookingResponse = await apiClient.post('/api/marketplace/bookings', {
            propertyId,
            roomType,
            checkIn,
            checkOut,
            guests,
            guestName: guestInfo.name,
            guestEmail: guestInfo.email,
            guestPhone: guestInfo.phone,
            userId: user?.id || null, // Include user ID if logged in
            paymentIntentId: paymentIntent.id,
            totalAmount: paymentData.amount,
            currency: paymentData.currency,
            nights: paymentData.nights
          });
          
          console.log('✅ Booking created:', bookingResponse.data);
          
          // Navigate to success page with booking data
          navigate('/guest/marketplace/booking-success', {
            state: { 
              booking: bookingResponse.data.data,
              message: 'Booking confirmed! Check your email for details.',
              type: 'success'
            }
          });
        } catch (bookingError: any) {
          console.error('❌ Error creating booking:', bookingError);
          // Payment succeeded but booking creation failed
          setError('Payment successful but booking creation failed. Please contact support with payment ID: ' + paymentIntent.id);
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
          Guest Information
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name *
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
              Email Address *
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
              Phone Number
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

      {/* Payment Information */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <CreditCard className="w-5 h-5 mr-2" />
          Payment Information
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

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || isProcessing}
        onClick={() => console.log('🔴 Button clicked!', { stripe: !!stripe, isProcessing })}
        className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold text-lg"
      >
        {isProcessing ? 'Processing Payment...' : `Pay €${totalAmount.toFixed(2)}`}
      </button>

      <p className="text-xs text-gray-500 text-center">
        Your payment is secure and encrypted. We never store your card details.
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

  // Fetch room type details from PMS
  const { data: roomData, isLoading: loadingRoom } = useQuery({
    queryKey: ['room-type-details', propertyId, roomType, state?.checkIn, state?.checkOut],
    queryFn: async () => {
      const { data } = await apiClient.get(
        `/public/properties/${propertyId}/room-types/${encodeURIComponent(roomType!)}`,
        {
          params: {
            checkIn: state?.checkIn,
            checkOut: state?.checkOut
          }
        }
      );
      return data;
    },
    enabled: !!propertyId && !!roomType && !!state?.checkIn && !!state?.checkOut
  });

  if (!state?.checkIn || !state?.checkOut) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Missing Booking Information
            </h2>
            <p className="text-gray-600 mb-6">
              Please select dates before proceeding to checkout.
            </p>
            <button
              onClick={() => navigate(`${getMarketplaceBasePath()}/properties/${propertyId}`)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
            >
              Back to Property
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loadingRoom) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!roomData?.data) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Room Type Not Available
            </h2>
            <p className="text-gray-600 mb-6">
              This room type is not available for the selected dates.
            </p>
            <button
              onClick={() => navigate(`${getMarketplaceBasePath()}/properties/${propertyId}`)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
            >
              Back to Property
            </button>
          </div>
        </div>
      </div>
    );
  }

  const room = roomData.data;
  const nights = differenceInDays(parseISO(state.checkOut), parseISO(state.checkIn));
  
  // Priority 1: Use roomData from navigation state (passed from PropertyDetails)
  // Priority 2: Use data from API call
  const pricePerNight = Number(state.roomData?.guestPrice 
    || room.pricing?.guestPrice 
    || room.basePrice 
    || room.rate 
    || 0);
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
              Back to Property
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
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
                <h2 className="text-xl font-semibold mb-4">Booking Summary</h2>
                
                <div className="space-y-4 mb-6">
                  <div>
                    <p className="text-sm text-gray-600">Room Type</p>
                    <p className="font-semibold">{room.roomCategory}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Check-in</p>
                      <p className="font-medium">{format(parseISO(state.checkIn), 'MMM dd')}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Check-out</p>
                      <p className="font-medium">{format(parseISO(state.checkOut), 'MMM dd')}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600">Guests</p>
                    <p className="font-medium">{state.guests} {state.guests === 1 ? 'guest' : 'guests'}</p>
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>€{pricePerNight.toFixed(2)} × {nights} nights</span>
                      <span>€{totalAmount.toFixed(2)}</span>
                    </div>
                    
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
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
