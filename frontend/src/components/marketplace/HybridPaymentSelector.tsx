import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Wallet, CreditCard, AlertCircle, Check, Sparkles } from 'lucide-react';
import { Elements, useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import toast from 'react-hot-toast';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

interface PaymentOption {
  type: 'credits_only' | 'credits_plus_cash' | 'cash_only';
  creditsUsed: number;
  cashAmount: number;
  description: string;
  canAfford: boolean;
}

interface HybridPaymentSelectorProps {
  availableCredits: number;
  requiredCredits: number;
  creditsPerNight: number;
  nights: number;
  season: string;
  roomType: string;
  creditToEurRate: number;
  onPaymentMethodSelected: (method: {
    paymentType: 'credits_only' | 'credits_plus_cash';
    creditsToUse: number;
    cashAmount: number;
    stripePaymentMethodId?: string;
  }) => void;
}

/**
 * Componente para seleccionar método de pago híbrido (créditos + Stripe)
 * Calcula automáticamente el déficit y muestra opciones disponibles
 */
export default function HybridPaymentSelector({
  availableCredits,
  requiredCredits,
  creditsPerNight,
  nights,
  season,
  roomType,
  creditToEurRate,
  onPaymentMethodSelected
}: HybridPaymentSelectorProps) {
  const { t } = useTranslation();
  const [selectedOption, setSelectedOption] = useState<PaymentOption | null>(null);
  const [showStripeForm, setShowStripeForm] = useState(false);

  const hasEnoughCredits = availableCredits >= requiredCredits;
  const creditDeficit = Math.max(0, requiredCredits - availableCredits);
  const deficitInEUR = Math.ceil(creditDeficit * creditToEurRate);

  // Generate payment options
  const paymentOptions: PaymentOption[] = [];

  // Option 1: Credits Only (if sufficient)
  if (hasEnoughCredits) {
    paymentOptions.push({
      type: 'credits_only',
      creditsUsed: requiredCredits,
      cashAmount: 0,
      description: t('marketplace.payWithCreditsOnly', 'Solo Créditos'),
      canAfford: true
    });
  }

  // Option 2: Hybrid Payment (if deficit exists)
  if (!hasEnoughCredits && availableCredits > 0) {
    paymentOptions.push({
      type: 'credits_plus_cash',
      creditsUsed: availableCredits,
      cashAmount: deficitInEUR,
      description: t('marketplace.payWithCreditsAndCard', 'Créditos + Tarjeta'),
      canAfford: true
    });
  }

  // Auto-select first option
  useEffect(() => {
    if (paymentOptions.length > 0 && !selectedOption) {
      setSelectedOption(paymentOptions[0]);
    }
  }, [paymentOptions.length]);

  const handleOptionSelect = (option: PaymentOption) => {
    setSelectedOption(option);
    setShowStripeForm(option.cashAmount > 0);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
      {/* Header */}
      <div className="border-b pb-4">
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          💳 {t('marketplace.paymentMethod', 'Método de Pago')}
        </h2>
        <p className="text-sm text-gray-600">
          {t('marketplace.selectPaymentOption', 'Selecciona cómo deseas pagar esta reserva')}
        </p>
      </div>

      {/* Credit Balance Summary */}
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-4 border-2 border-purple-200">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-600 uppercase mb-1">
              {t('credits.available', 'Disponibles')}
            </p>
            <p className="text-2xl font-bold text-purple-600">
              {availableCredits.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">{t('credits.credits', 'créditos')}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600 uppercase mb-1">
              {t('credits.required', 'Requeridos')}
            </p>
            <p className="text-2xl font-bold text-gray-900">
              {requiredCredits.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">{t('credits.credits', 'créditos')}</p>
          </div>
        </div>

        {/* Deficit Warning */}
        {!hasEnoughCredits && (
          <div className="mt-4 flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg p-3 border border-amber-200">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">
                {t('marketplace.insufficientCredits', 'Créditos insuficientes')}
              </p>
              <p>
                {t('marketplace.creditDeficit', {
                  credits: creditDeficit.toLocaleString(),
                  amount: `€${deficitInEUR.toFixed(2)}`
                }, `Faltan ${creditDeficit.toLocaleString()} créditos (≈ €${deficitInEUR.toFixed(2)})`)}
              </p>
            </div>
          </div>
        )}

        {/* Calculation Breakdown */}
        <div className="mt-4 pt-4 border-t border-purple-200 space-y-2 text-sm">
          <div className="flex justify-between text-gray-700">
            <span>{t('bookings.season', 'Temporada')}:</span>
            <span className="font-semibold">{season}</span>
          </div>
          <div className="flex justify-between text-gray-700">
            <span>{t('bookings.roomType', 'Tipo')}:</span>
            <span className="font-semibold">{roomType}</span>
          </div>
          <div className="flex justify-between text-gray-700">
            <span>{t('bookings.creditsPerNight', 'Por noche')}:</span>
            <span className="font-semibold">{creditsPerNight.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-gray-700 pt-2 border-t border-purple-200">
            <span className="font-semibold">{nights} {t('common.nights', 'noches')}:</span>
            <span className="font-bold text-purple-600">
              {requiredCredits.toLocaleString()} {t('credits.credits', 'créditos')}
            </span>
          </div>
        </div>
      </div>

      {/* Payment Options */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-700">
          {t('marketplace.choosePaymentOption', 'Opciones de pago disponibles')}:
        </p>

        {paymentOptions.map((option, index) => (
          <button
            key={index}
            type="button"
            onClick={() => handleOptionSelect(option)}
            className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
              selectedOption === option
                ? 'border-emerald-500 bg-emerald-50'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                {option.type === 'credits_only' ? (
                  <Wallet className="h-6 w-6 text-purple-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <div className="flex -space-x-2">
                    <Wallet className="h-6 w-6 text-purple-600 flex-shrink-0" />
                    <CreditCard className="h-6 w-6 text-blue-600 flex-shrink-0" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                    {option.description}
                    {option.type === 'credits_only' && (
                      <Sparkles className="h-4 w-4 text-yellow-500" />
                    )}
                  </h3>
                  <div className="space-y-1 text-sm text-gray-600">
                    {option.creditsUsed > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-purple-600">✨</span>
                        <span>
                          {t('marketplace.useCredits', {
                            credits: option.creditsUsed.toLocaleString()
                          }, `Usar ${option.creditsUsed.toLocaleString()} créditos`)}
                        </span>
                      </div>
                    )}
                    {option.cashAmount > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-blue-600">💳</span>
                        <span>
                          {t('marketplace.payWithCard', {
                            amount: `€${option.cashAmount.toFixed(2)}`
                          }, `Pagar €${option.cashAmount.toFixed(2)} con tarjeta`)}
                        </span>
                      </div>
                    )}
                  </div>
                  {option.type === 'credits_only' && (
                    <p className="text-xs text-emerald-600 mt-2 font-medium">
                      ✓ {t('marketplace.noCardRequired', 'No se requiere tarjeta')}
                    </p>
                  )}
                </div>
              </div>
              {selectedOption === option && (
                <div className="bg-emerald-500 rounded-full p-1 ml-2">
                  <Check className="h-5 w-5 text-white" />
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Stripe Payment Form (if cash payment needed) */}
      {selectedOption && selectedOption.cashAmount > 0 && showStripeForm && (
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-blue-600" />
            {t('marketplace.cardPayment', 'Pago con Tarjeta')}
          </h3>
          <StripePaymentForm
            amount={selectedOption.cashAmount}
            onSuccess={(paymentMethodId) => {
              onPaymentMethodSelected({
                paymentType: selectedOption.type as 'credits_only' | 'credits_plus_cash',
                creditsToUse: selectedOption.creditsUsed,
                cashAmount: selectedOption.cashAmount,
                stripePaymentMethodId: paymentMethodId
              });
            }}
          />
        </div>
      )}

      {/* Confirm Button (for credits_only) */}
      {selectedOption && selectedOption.cashAmount === 0 && (
        <button
          type="button"
          onClick={() => {
            onPaymentMethodSelected({
              paymentType: 'credits_only',
              creditsToUse: selectedOption.creditsUsed,
              cashAmount: 0
            });
          }}
          className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md"
        >
          {t('marketplace.confirmWithCredits', 'Confirmar Pago con Créditos')}
        </button>
      )}

      {/* Conversion Rate Info */}
      <div className="text-xs text-gray-500 text-center pt-4 border-t">
        <p>
          {t('marketplace.conversionRate', {
            rate: `€${creditToEurRate.toFixed(2)}`
          }, `Tasa de conversión: 1 crédito = €${creditToEurRate.toFixed(2)}`)}
        </p>
      </div>
    </div>
  );
}

/**
 * Stripe Payment Form Component
 */
interface StripePaymentFormProps {
  amount: number;
  onSuccess: (paymentMethodId: string) => void;
}

function StripePaymentForm({ amount, onSuccess }: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      // Submit the payment
      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        elements
      });

      if (error) {
        toast.error(error.message || 'Error al procesar el pago');
        return;
      }

      if (paymentMethod) {
        onSuccess(paymentMethod.id);
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      toast.error(error.message || 'Error al procesar el pago');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <PaymentElement />
      </div>

      <div className="flex items-center justify-between text-sm text-gray-700 bg-blue-50 rounded-lg p-3 border border-blue-200">
        <span>Total a cobrar:</span>
        <span className="font-bold text-lg text-blue-600">€{amount.toFixed(2)}</span>
      </div>

      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
            Procesando...
          </span>
        ) : (
          `Pagar €${amount.toFixed(2)}`
        )}
      </button>
    </form>
  );
}

/**
 * Wrapper Component with Stripe Elements
 */
export function HybridPaymentSelectorWithStripe(props: HybridPaymentSelectorProps) {
  const options: StripeElementsOptions = {
    mode: 'payment',
    amount: Math.round(props.requiredCredits * props.creditToEurRate * 100), // Convert to cents
    currency: 'eur',
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#10b981',
      },
    },
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      <HybridPaymentSelector {...props} />
    </Elements>
  );
}
