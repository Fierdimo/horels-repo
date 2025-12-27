import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/client';
import CheckoutForm from './CheckoutForm';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ArrowLeft, CreditCard } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { useAuthStore } from '@/stores/authStore';
import { extractUserFromToken } from '@/utils/tokenUtils';

// Inicializar Stripe (usa tu clave pública)
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

interface Room {
  id: number;
  name: string;
  type: string;
  guestPrice: number;
}

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
}

export default function MarketplaceCheckout() {
  const { propertyId, roomId } = useParams<{ propertyId: string; roomId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, setAuth } = useAuthStore();
  const location = useLocation();
  const state = location.state as {
    checkIn: string;
    checkOut: string;
    guests: number;
    guestName: string;
    guestEmail: string;
    guestPhone?: string;
  } || {};

  const [clientSecret, setClientSecret] = useState<string>('');
  const [paymentIntentId, setPaymentIntentId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [useNewCard, setUseNewCard] = useState<boolean>(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [saveCard, setSaveCard] = useState<boolean>(false);
  const [processing, setProcessing] = useState<boolean>(false);  const [isTestPrice, setIsTestPrice] = useState<boolean>(false);
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

  // Fetch room details
  const { data: roomData, isLoading: loadingRoom } = useQuery({
    queryKey: ['room-details', propertyId, roomId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/public/properties/${propertyId}/rooms/${roomId}`);
      return data;
    },
    enabled: !!propertyId && !!roomId
  });

  // Fetch saved payment methods if user is authenticated
  const { data: paymentMethodsData, isLoading: loadingPaymentMethods } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: async () => {
      const { data } = await apiClient.get('/auth/payment-methods');
      return data;
    },
    enabled: !!user,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const paymentMethods: PaymentMethod[] = paymentMethodsData?.data || [];

  const room: Room | null = roomData?.data || null;
  const nights = state.checkIn && state.checkOut 
    ? differenceInDays(parseISO(state.checkOut), parseISO(state.checkIn)) 
    : 0;
  const pricePerNight = room?.guestPrice || 0;
  const totalAmount = nights * pricePerNight;

  // Inicialmente usar tarjeta nueva si no hay tarjetas guardadas
  useEffect(() => {
    if (paymentMethods.length === 0) {
      setUseNewCard(true);
    }
  }, [paymentMethods]);

  // Crear Payment Intent cuando el componente se monte o cambien opciones
  useEffect(() => {
    if (!propertyId || !roomId || !state.checkIn || !state.checkOut || !state.guestName || !state.guestEmail) {
      setError('Missing required booking information');
      return;
    }

    const createPaymentIntent = async () => {
      try {
        const { data } = await apiClient.post(
          `/public/properties/${propertyId}/rooms/${roomId}/create-payment-intent`,
          {
            guestName: state.guestName,
            guestEmail: state.guestEmail,
            guestPhone: state.guestPhone,
            checkIn: state.checkIn,
            checkOut: state.checkOut,
            savePaymentMethod: saveCard
          }
        );

        setClientSecret(data.data.clientSecret);
        setPaymentIntentId(data.data.paymentIntentId);
        setIsTestPrice(data.data.isTestPrice || false);
        
        if (data.data.isTestPrice) {
          console.warn('⚠️ Using test pricing for development');
        }
      } catch (error: any) {
        console.error('Error creating payment intent:', error);
        setError(error.response?.data?.error || 'Failed to initialize payment');
      }
    };

    createPaymentIntent();
  }, [propertyId, roomId, state, saveCard]);

  if (loadingRoom) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => navigate(`${getMarketplaceBasePath()}/properties/${propertyId}`)}
            className="flex items-center text-blue-600 hover:text-blue-700 mb-6"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            {t('common.back')}
          </button>
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-red-600 mb-4">{t('common.error')}</h2>
              <p className="text-gray-700">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const appearance = {
    theme: 'stripe' as const,
  };

  const options = {
    clientSecret,
    appearance,
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate(`${getMarketplaceBasePath()}/properties/${propertyId}`)}
          className="flex items-center text-blue-600 hover:text-blue-700 mb-6"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          {t('common.back')}
        </button>

        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold mb-8">{t('marketplace.checkout')}</h1>

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            {/* Booking Summary */}
            <div>
              <h2 className="text-xl font-bold mb-4">{t('marketplace.bookingSummary')}</h2>
              <div className="space-y-3 text-gray-700">
                <div>
                  <span className="font-semibold">{t('marketplace.property')}:</span> {roomData?.data?.property?.name}
                </div>
                <div>
                  <span className="font-semibold">{t('marketplace.room')}:</span> {room?.name}
                </div>
                <div>
                  <span className="font-semibold">{t('marketplace.checkIn')}:</span>{' '}
                  {state.checkIn && format(parseISO(state.checkIn), 'MMM dd, yyyy')}
                </div>
                <div>
                  <span className="font-semibold">{t('marketplace.checkOut')}:</span>{' '}
                  {state.checkOut && format(parseISO(state.checkOut), 'MMM dd, yyyy')}
                </div>
                <div>
                  <span className="font-semibold">{t('marketplace.nights')}:</span> {nights}
                </div>
                <div>
                  <span className="font-semibold">{t('marketplace.guests')}:</span> {state.guests}
                </div>
                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between">
                    <span>{t('marketplace.pricePerNight')}:</span>
                    <span>€{pricePerNight.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg mt-2">
                    <span>{t('marketplace.total')}:</span>
                    <span>€{totalAmount.toFixed(2)}</span>
                  </div>
                  {isTestPrice && (
                    <div className="mt-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
                      ⚠️ Using test pricing for development
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Payment Form */}
            <div>
              <h2 className="text-xl font-bold mb-4">{t('marketplace.paymentDetails')}</h2>
              
              {/* Saved Payment Methods */}
              {user && paymentMethods.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">{t('marketplace.savedCards')}</h3>
                  <div className="space-y-2">
                    {paymentMethods.map((pm) => (
                      <label
                        key={pm.id}
                        className={`flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                          !useNewCard && selectedPaymentMethod === pm.id ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          checked={!useNewCard && selectedPaymentMethod === pm.id}
                          onChange={() => {
                            setUseNewCard(false);
                            setSelectedPaymentMethod(pm.id);
                          }}
                          className="mr-3"
                        />
                        <CreditCard className="w-5 h-5 mr-2 text-gray-600" />
                        <span className="capitalize">{pm.brand}</span>
                        <span className="ml-2">****  {pm.last4}</span>
                        <span className="ml-auto text-sm text-gray-500">
                          {pm.exp_month}/{pm.exp_year}
                        </span>
                      </label>
                    ))}
                    
                    <label
                      className={`flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                        useNewCard ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={useNewCard}
                        onChange={() => {
                          setUseNewCard(true);
                          setSelectedPaymentMethod('');
                        }}
                        className="mr-3"
                      />
                      <CreditCard className="w-5 h-5 mr-2 text-gray-600" />
                      <span>{t('marketplace.useNewCard')}</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Save Card Checkbox */}
              {user && useNewCard && (
                <div className="mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveCard}
                      onChange={(e) => setSaveCard(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">
                      {t('marketplace.saveCardForFuture')}
                    </span>
                  </label>
                </div>
              )}

              {/* Stripe Elements Form */}
              {(useNewCard || !user || paymentMethods.length === 0) && (
                <Elements options={options} stripe={stripePromise}>
                  <CheckoutForm
                    paymentIntentId={paymentIntentId}
                    propertyId={propertyId!}
                    guestEmail={state.guestEmail}
                  />
                </Elements>
              )}

              {/* Pay with Saved Card Button */}
              {!useNewCard && selectedPaymentMethod && (
                <button
                  onClick={async () => {
                    setProcessing(true);
                    setError('');
                    
                    try {
                      const { data } = await apiClient.post('/public/bookings/confirm-payment-with-saved-card', {
                        payment_intent_id: paymentIntentId,
                        payment_method_id: selectedPaymentMethod
                      });

                      if (data.requiresAction && data.clientSecret) {
                        // Requiere autenticación 3D Secure
                        const stripe = await stripePromise;
                        if (!stripe) throw new Error('Stripe not loaded');

                        const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
                          data.clientSecret
                        );

                        if (confirmError) {
                          throw new Error(confirmError.message);
                        }

                        if (paymentIntent?.status === 'succeeded') {
                          // Confirmar booking después de autenticación exitosa
                          const response = await apiClient.post('/public/bookings/confirm-payment', {
                            payment_intent_id: paymentIntent.id
                          });

                          // Invalidar cache de bookings para que se recarguen
                          queryClient.invalidateQueries({ queryKey: ['myBookings'] });
                          
                          // El token ahora viene en response.data.token (raíz)
                          const token = response.data.token;
                          
                          if (token) {
                            const newUser = extractUserFromToken(token);
                            if (newUser) {
                              setAuth(token, newUser as any);
                              localStorage.setItem('sw2_token', token);
                              localStorage.setItem('sw2_user', JSON.stringify(newUser));
                              
                              // Navegar a la ruta del owner con delay para Zustand
                              const ownerPath = newUser.role === 'owner' ? '/owner/marketplace' : '/guest/marketplace';
                              setTimeout(() => {
                                navigate(ownerPath);
                              }, 100);
                              return;
                            }
                          }
                          
                          navigate(`${getMarketplaceBasePath()}/booking-success`, {
                            state: { paymentIntentId: paymentIntent.id }
                          });
                        }
                      } else if (data.success) {
                        // Pago exitoso sin autenticación adicional
                        // Invalidar cache de bookings para que se recarguen
                        queryClient.invalidateQueries({ queryKey: ['myBookings'] });

                        // El token ahora viene en data.token (raíz)
                        const token = data.token;
                        
                        if (token) {
                          const newUser = extractUserFromToken(token);
                          if (newUser) {
                            setAuth(token, newUser as any);
                            localStorage.setItem('sw2_token', token);
                            localStorage.setItem('sw2_user', JSON.stringify(newUser));
                            
                            // Navegar a la ruta del owner con delay para Zustand
                            const ownerPath = newUser.role === 'owner' ? '/owner/marketplace' : '/guest/marketplace';
                            setTimeout(() => {
                              navigate(ownerPath);
                            }, 100);
                            return;
                          }
                        }
                        
                        navigate(`${getMarketplaceBasePath()}/booking-success`, {
                          state: { paymentIntentId }
                        });
                      } else {
                        throw new Error(data.error || 'Payment failed');
                      }
                    } catch (err: any) {
                      console.error('Error processing payment:', err);
                      setError(err.response?.data?.error || err.message || 'Failed to process payment');
                    } finally {
                      setProcessing(false);
                    }
                  }}
                  disabled={processing}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {processing ? (
                    <>
                      <LoadingSpinner size="sm" />
                      {t('marketplace.processing')}
                    </>
                  ) : (
                    t('marketplace.completePayment')
                  )}
                </button>
              )}

              {/* Error Message */}
              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
