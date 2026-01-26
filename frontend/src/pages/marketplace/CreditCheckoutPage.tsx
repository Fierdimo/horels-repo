import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Calendar, MapPin, Coins, CreditCard, Check, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import * as marketplaceApi from '@/api/marketplace';
import type { InventoryItem, PaymentCalculation, PaymentOption } from '@/api/marketplace';

export function CreditCheckoutPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [item, setItem] = useState<InventoryItem | null>(null);
  const [paymentCalc, setPaymentCalc] = useState<PaymentCalculation | null>(null);
  const [selectedOption, setSelectedOption] = useState<PaymentOption | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false);
  const [reservationExpiry, setReservationExpiry] = useState<Date | null>(null);

  useEffect(() => {
    if (itemId) {
      loadItemAndOptions();
      reserveItem();
    }
  }, [itemId]);

  // Countdown timer for reservation
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

  const loadItemAndOptions = async () => {
    setIsLoading(true);
    try {
      const preview = await marketplaceApi.previewBooking(parseInt(itemId!));
      setItem(preview.item);
      setPaymentCalc(preview.paymentOptions);
      
      // Auto-select first option
      if (preview.paymentOptions.options.length > 0) {
        setSelectedOption(preview.paymentOptions.options[0]);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al cargar detalles');
      navigate('/marketplace');
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleConfirmBooking = async () => {
    if (!selectedOption || !item) return;

    if (!window.confirm('¿Confirmar reserva?')) return;

    setIsBooking(true);
    try {
      const request = {
        inventoryItemId: item.id,
        paymentType: selectedOption.type,
        creditsToUse: selectedOption.creditsUsed,
        cashAmount: selectedOption.cashAmount > 0 ? selectedOption.cashAmount : undefined,
        stripePaymentMethodId: selectedOption.type !== 'credits_only' ? 'pm_card_visa' : undefined // TODO: Real Stripe integration
      };

      const result = await marketplaceApi.bookWithCredits(request);
      
      toast.success('¡Reserva confirmada!');
      navigate(`/bookings/${result.bookingId}`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al confirmar reserva');
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

  const formatDate = (date: string | null) => {
    if (!date) return 'Fecha flexible';
    return new Date(date).toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const getTimeRemaining = () => {
    if (!reservationExpiry) return '';
    const now = new Date();
    const diff = reservationExpiry.getTime() - now.getTime();
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-2 border-emerald-600"></div>
          <p className="mt-4 text-gray-600">Cargando checkout...</p>
        </div>
      </div>
    );
  }

  if (!item || !paymentCalc) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <button
            onClick={handleCancel}
            className="flex items-center gap-2 text-emerald-100 hover:text-white mb-4"
          >
            <ArrowLeft className="h-5 w-5" />
            Volver a búsqueda
          </button>
          <h1 className="text-3xl font-bold">Confirmar Reserva</h1>
          <p className="text-emerald-100 mt-2">Revisa los detalles y confirma tu reserva</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Reservation Timer */}
        {reservationExpiry && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-yellow-400 mr-3" />
              <div className="flex-1">
                <p className="text-sm text-yellow-800">
                  <strong>Reserva temporal:</strong> Tienes <strong>{getTimeRemaining()}</strong> para completar tu reserva
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Week Details */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Detalles de la Semana</h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg text-emerald-600">
                    {item.property?.name || 'Propiedad'}
                  </h3>
                  <p className="text-gray-600">{item.property?.location}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-2">
                    <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <div className="text-sm text-gray-500">Check-in</div>
                      <div className="font-medium">{formatDate(item.start_date)}</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <div className="text-sm text-gray-500">Check-out</div>
                      <div className="font-medium">{formatDate(item.end_date)}</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-gray-400" />
                  <span className="capitalize">{item.accommodation_type}</span>
                </div>
              </div>
            </div>

            {/* Payment Options */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Opciones de Pago</h2>

              <div className="space-y-3">
                {paymentCalc.options.map((option, index) => (
                  <div
                    key={index}
                    onClick={() => setSelectedOption(option)}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      selectedOption === option
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-gray-200 hover:border-emerald-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {option.type === 'credits_only' && <Coins className="h-5 w-5 text-emerald-600" />}
                          {option.type !== 'credits_only' && <CreditCard className="h-5 w-5 text-blue-600" />}
                          <span className="font-semibold text-gray-900">{option.description}</span>
                        </div>

                        <div className="text-sm text-gray-600 space-y-1">
                          {option.creditsUsed > 0 && (
                            <div>• Usar {option.creditsUsed.toLocaleString()} créditos</div>
                          )}
                          {option.cashAmount > 0 && (
                            <div>• Pagar €{option.cashAmount.toFixed(2)} con tarjeta</div>
                          )}
                        </div>
                      </div>

                      {selectedOption === option && (
                        <div className="bg-emerald-600 rounded-full p-1">
                          <Check className="h-5 w-5 text-white" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-md p-6 sticky top-4">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Resumen</h2>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Precio en créditos</span>
                  <span className="font-semibold">{item.credit_price.toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Tus créditos</span>
                  <span className="font-semibold">{paymentCalc.availableCredits.toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                  <span className="text-gray-600">Diferencia</span>
                  <span className={`font-semibold ${
                    paymentCalc.difference >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {paymentCalc.difference >= 0 ? '+' : ''}{paymentCalc.difference.toLocaleString()}
                  </span>
                </div>
              </div>

              {selectedOption && (
                <div className="bg-emerald-50 rounded-lg p-4 mb-6">
                  <div className="text-sm text-gray-600 mb-2">Pagarás:</div>
                  {selectedOption.creditsUsed > 0 && (
                    <div className="flex items-center gap-2 text-emerald-700 font-medium">
                      <Coins className="h-4 w-4" />
                      {selectedOption.creditsUsed.toLocaleString()} créditos
                    </div>
                  )}
                  {selectedOption.cashAmount > 0 && (
                    <div className="flex items-center gap-2 text-blue-700 font-medium mt-1">
                      <CreditCard className="h-4 w-4" />
                      €{selectedOption.cashAmount.toFixed(2)}
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={handleConfirmBooking}
                disabled={isBooking || !selectedOption}
                className="w-full px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-lg mb-3"
              >
                {isBooking ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Procesando...
                  </span>
                ) : (
                  'Confirmar Reserva'
                )}
              </button>

              <button
                onClick={handleCancel}
                disabled={isBooking}
                className="w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancelar
              </button>

              <p className="text-xs text-gray-500 text-center mt-4">
                Al confirmar, aceptas los términos y condiciones del marketplace
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
