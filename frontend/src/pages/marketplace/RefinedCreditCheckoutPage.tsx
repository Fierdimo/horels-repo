import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Calendar, MapPin, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { HybridPaymentSelectorWithStripe } from '@/components/marketplace/HybridPaymentSelector';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import * as marketplaceApi from '@/api/marketplace';
import { timeshareApi } from '@/api/timeshare';

/**
 * Página de Checkout Refinada para Marketplace de Créditos
 * 
 * Características:
 * - Cálculo automático de créditos usando Fórmula Maestra
 * - Detección de déficit y oferta de pago híbrido
 * - Integración completa con Stripe
 * - Reserva temporal con countdown
 */
export function RefinedCreditCheckoutPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();

  const [isBooking, setIsBooking] = useState(false);
  const [reservationExpiry, setReservationExpiry] = useState<Date | null>(null);

  // Fetch item details and payment options
  const { data: previewData = {}, isLoading: loadingPreview } = useQuery({
    queryKey: ['marketplace-preview', itemId],
    queryFn: () => marketplaceApi.previewBooking(parseInt(itemId!)),
    enabled: !!itemId
  });

  // Fetch credit wallet
  const { data: walletData } = useQuery({
    queryKey: ['credit-wallet'],
    queryFn: timeshareApi.getCreditWallet,
    staleTime: 30000
  });

  // Fetch credit to EUR rate
  const { data: creditToEurRate } = useQuery({
    queryKey: ['credit-to-eur-rate'],
    queryFn: timeshareApi.getCreditToEurRate,
    staleTime: 30000
  });

  // Fetch credit calculation (Master Formula)
  const { data: creditCalculation } = useQuery({
    queryKey: ['credit-calculation-item', itemId],
    queryFn: async () => {
      if (!(previewData as any)?.item) return null;
      const item = (previewData as any).item;
      
      return await timeshareApi.calculateCreditCost({
        propertyId: item.property_id,
        roomType: item.room_category || 'Standard',
        checkIn: item.start_date || new Date().toISOString(),
        checkOut: item.end_date || new Date().toISOString()
      });
    },
    enabled: !!(previewData as any)?.item,
    staleTime: 60000
  });

  // Reserve item on mount
  useEffect(() => {
    if (itemId) {
      reserveItem();
    }
  }, [itemId]);

  // Countdown timer
  useEffect(() => {
    if (!reservationExpiry) return;

    const interval = setInterval(() => {
      const now = new Date();
      if (reservationExpiry <= now) {
        toast.error('Tu reserva temporal ha expirado');
        navigate('/marketplace');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [reservationExpiry]);

  const reserveItem = async () => {
    try {
      const result = await marketplaceApi.reserveItem(parseInt(itemId!), 15);
      if (result.success && result.expiresAt) {
        setReservationExpiry(new Date(result.expiresAt));
      }
    } catch (error: any) {
      toast.error('No se pudo reservar temporalmente el item');
    }
  };

  const handlePaymentMethodSelected = async (paymentDetails: {
    paymentType: 'credits_only' | 'credits_plus_cash';
    creditsToUse: number;
    cashAmount: number;
    stripePaymentMethodId?: string;
  }) => {
    setIsBooking(true);

    try {
      const result = await marketplaceApi.bookWithCredits({
        inventoryItemId: parseInt(itemId!),
        paymentType: paymentDetails.paymentType,
        creditsToUse: paymentDetails.creditsToUse,
        cashAmount: paymentDetails.cashAmount,
        stripePaymentMethodId: paymentDetails.stripePaymentMethodId
      });

      toast.success('¡Reserva confirmada exitosamente!');
      navigate(`/bookings/${result.bookingId}`, {
        state: {
          creditsUsed: paymentDetails.creditsToUse,
          cashPaid: paymentDetails.cashAmount
        }
      });
    } catch (error: any) {
      console.error('Booking error:', error);
      toast.error(error.response?.data?.error || 'Error al confirmar la reserva');
    } finally {
      setIsBooking(false);
    }
  };

  const handleCancel = async () => {
    if (itemId) {
      await marketplaceApi.releaseReservation(parseInt(itemId));
    }
    navigate('/marketplace');
  };

  const getTimeRemaining = () => {
    if (!reservationExpiry) return '';
    const now = new Date();
    const diff = reservationExpiry.getTime() - now.getTime();
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (loadingPreview) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!previewData || !creditCalculation || !walletData) {
    return null;
  }

  const { item } = previewData as any;
  const wallet = walletData.wallet;
  const nights = creditCalculation.nights || 7;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <button
            onClick={handleCancel}
            className="flex items-center gap-2 text-emerald-100 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            Volver a búsqueda
          </button>
          <h1 className="text-3xl font-bold">Confirmar Reserva</h1>
          <p className="text-emerald-100 mt-2">
            Revisa los detalles y selecciona tu método de pago
          </p>
        </div>
      </div>

      {/* Timer Warning */}
      {reservationExpiry && (
        <div className="bg-yellow-50 border-b border-yellow-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <p className="text-sm text-yellow-800 text-center">
              ⏰ <strong>Reserva temporal:</strong> Completa tu reserva en{' '}
              <strong className="font-mono text-lg">{getTimeRemaining()}</strong>
            </p>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Week Details */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                📍 Detalles de la Semana
              </h2>

              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg text-emerald-600">
                    {item.property?.name || 'Propiedad'}
                  </h3>
                  <div className="flex items-center gap-2 text-gray-600 mt-1">
                    <MapPin className="h-4 w-4" />
                    <span>{item.property?.location || 'Ubicación'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div className="flex items-start gap-2">
                    <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <div className="text-sm text-gray-500">Check-in</div>
                      <div className="font-medium">
                        {item.start_date
                          ? new Date(item.start_date).toLocaleDateString('es-ES', {
                              weekday: 'long',
                              day: 'numeric',
                              month: 'long'
                            })
                          : 'Fecha flexible'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <div className="text-sm text-gray-500">Check-out</div>
                      <div className="font-medium">
                        {item.end_date
                          ? new Date(item.end_date).toLocaleDateString('es-ES', {
                              weekday: 'long',
                              day: 'numeric',
                              month: 'long'
                            })
                          : 'Fecha flexible'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-4 border-t">
                  <Users className="h-5 w-5 text-gray-400" />
                  <span className="text-gray-700">
                    <span className="font-semibold">{item.accommodation_type}</span> - Hasta{' '}
                    {item.capacity || 4} huéspedes
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Payment Selector */}
          <div className="lg:col-span-1">
            <HybridPaymentSelectorWithStripe
              availableCredits={wallet?.totalBalance || 0}
              requiredCredits={creditCalculation.creditsRequired}
              creditsPerNight={creditCalculation.creditsPerNight}
              nights={nights}
              season={creditCalculation.season}
              roomType={creditCalculation.roomType}
              creditToEurRate={creditToEurRate || 0.10}
              onPaymentMethodSelected={handlePaymentMethodSelected}
            />
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      {isBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 text-center">
            <LoadingSpinner />
            <p className="mt-4 text-gray-700 font-medium">Procesando tu reserva...</p>
          </div>
        </div>
      )}
    </div>
  );
}
