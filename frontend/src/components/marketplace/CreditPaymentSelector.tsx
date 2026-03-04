import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Coins, CreditCard, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/api/client';

interface CreditPaymentSelectorProps {
  userId: number | null;
  propertyId: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  totalAmount: number;
  /** false for guest users or hotel rooms (room-*): forces card-only payment */
  allowCredits?: boolean;
  onPaymentMethodChange: (method: 'card' | 'credits' | 'hybrid', creditsToUse?: number) => void;
}

export function CreditPaymentSelector({
  userId,
  propertyId,
  roomType,
  checkIn,
  checkOut,
  guests,
  totalAmount,
  allowCredits = true,
  onPaymentMethodChange
}: CreditPaymentSelectorProps) {
  const { t } = useTranslation();
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'credits' | 'hybrid'>('card');
  const [creditsToUse, setCreditsToUse] = useState(0);

  // Fetch user's credit balance — only when credits are applicable
  const { data: creditBalance, isLoading: loadingBalance } = useQuery({
    queryKey: ['creditBalance', userId],
    queryFn: async () => {
      if (!userId) return null;
      const response = await apiClient.get(`/api/marketplace/credits/balance/${userId}`);
      return response.data.data;
    },
    enabled: !!userId && allowCredits
  });

  // Fetch credit price calculation — only when credits are applicable
  const { data: creditPrice, isLoading: loadingPrice } = useQuery({
    queryKey: ['creditPrice', propertyId, roomType, checkIn, checkOut],
    queryFn: async () => {
      const response = await apiClient.post(
        `/api/marketplace/properties/${propertyId}/room-types/${encodeURIComponent(roomType)}/calculate-credit-price`,
        { checkIn, checkOut, guests }
      );
      return response.data.data;
    },
    enabled: !!userId && allowCredits
  });

  // Calculate remaining balance after using credits
  // IMPORTANTE: totalAmount es el precio REAL de la habitación
  // Para esta reserva específica, los créditos requeridos deben cubrir el precio total
  // Entonces la tasa de conversión específica es: totalAmount / creditsRequired
  const actualPriceEur = totalAmount;
  const remainingCredits = (creditBalance?.balance || 0) - creditsToUse;
  
  // Calcular el valor de los créditos usados basado en la tasa específica de esta reserva
  // Si creditsRequired = 90 y totalAmount = €189, entonces cada crédito vale €2.10
  const creditValueForThisBooking = creditPrice ? (actualPriceEur / creditPrice.creditsRequired) : 0;
  const creditsValueEur = creditsToUse * creditValueForThisBooking;
  const cashNeeded = Math.max(0, actualPriceEur - creditsValueEur);

  useEffect(() => {
    onPaymentMethodChange(paymentMethod, creditsToUse);
  }, [paymentMethod, creditsToUse, onPaymentMethodChange]);

  // Card-only: not logged in, guest user, or hotel room (room-*)
  if (!userId || !allowCredits) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2 text-blue-800">
          <CreditCard className="h-5 w-5" />
          <span className="font-medium">{t('marketplace.checkout.payWithCard')}</span>
        </div>
        {!userId && (
          <p className="text-sm text-blue-700 mt-2">
            {t('marketplace.checkout.signInToUseCredits')}
          </p>
        )}
      </div>
    );
  }

  if (loadingBalance || loadingPrice) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
        <p className="text-gray-600">{t('marketplace.checkout.loadingPaymentOptions')}</p>
      </div>
    );
  }

  const hasCredits = (creditBalance?.balance || 0) > 0;
  const canPayFullyWithCredits = creditPrice && (creditBalance?.balance || 0) >= creditPrice.creditsRequired;

  return (
    <div className="space-y-4 mb-6">
      <h3 className="text-lg font-semibold text-gray-900">{t('marketplace.checkout.paymentMethod')}</h3>

      {/* Credit Balance Info */}
      {hasCredits && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-purple-600" />
              <span className="font-medium text-purple-900">{t('marketplace.checkout.availableCredits')}</span>
            </div>
            <span className="text-2xl font-bold text-purple-600">
              {(creditBalance?.balance ?? 0).toLocaleString()}
            </span>
          </div>
          {creditPrice && (
            <p className="text-sm text-purple-700 mt-2">
              {t('marketplace.checkout.bookingRequires')} <strong>{creditPrice.creditsRequired.toLocaleString()} {t('marketplace.checkout.creditsLabel')}</strong> ({creditPrice.nights} {t('marketplace.checkout.nightsLabel')} × {Math.ceil(creditPrice.creditsRequired / (creditPrice.nights || 1)).toLocaleString()} {t('marketplace.checkout.creditsLabel')}/noche)
            </p>
          )}
        </div>
      )}

      {/* Payment Method Options */}
      <div className="grid grid-cols-1 gap-3">
        {/* Option 1: Pay with Card */}
        <button
          type="button"
          onClick={() => {
            setPaymentMethod('card');
            setCreditsToUse(0);
          }}
          className={`p-4 border-2 rounded-lg text-left transition-all ${
            paymentMethod === 'card'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <CreditCard className={`h-5 w-5 ${paymentMethod === 'card' ? 'text-blue-600' : 'text-gray-400'}`} />
            <div className="flex-1">
              <div className="font-medium text-gray-900">{t('marketplace.checkout.creditCard')}</div>
                <div className="text-sm text-gray-600">{t('marketplace.checkout.payWithCardAmount', { amount: actualPriceEur.toFixed(2) })}</div>
            </div>
            {paymentMethod === 'card' && (
              <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white"></div>
              </div>
            )}
          </div>
        </button>

        {/* Option 2: Pay with Credits (if enough) */}
        {canPayFullyWithCredits && (
          <button
            type="button"
            onClick={() => {
              setPaymentMethod('credits');
              setCreditsToUse(creditPrice.creditsRequired);
            }}
            className={`p-4 border-2 rounded-lg text-left transition-all ${
              paymentMethod === 'credits'
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <Coins className={`h-5 w-5 ${paymentMethod === 'credits' ? 'text-purple-600' : 'text-gray-400'}`} />
              <div className="flex-1">
                <div className="font-medium text-gray-900">{t('marketplace.checkout.payWithCreditsOption')}</div>
                <div className="text-sm text-gray-600">
                  {t('marketplace.checkout.useCredits', { count: creditPrice.creditsRequired })} ({t('marketplace.checkout.remaining', { count: creditBalance.balance - creditPrice.creditsRequired })})
                </div>
              </div>
              {paymentMethod === 'credits' && (
                <div className="w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white"></div>
                </div>
              )}
            </div>
          </button>
        )}

        {/* Option 3: Hybrid Payment (if has some credits but not enough) */}
        {hasCredits && !canPayFullyWithCredits && creditPrice && (
          <button
            type="button"
            onClick={() => {
              setPaymentMethod('hybrid');
              setCreditsToUse(creditBalance.balance); // Use all available credits
            }}
            className={`p-4 border-2 rounded-lg text-left transition-all ${
              paymentMethod === 'hybrid'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                <Coins className={`h-5 w-5 ${paymentMethod === 'hybrid' ? 'text-green-600' : 'text-gray-400'}`} />
                <CreditCard className={`h-5 w-5 ${paymentMethod === 'hybrid' ? 'text-green-600' : 'text-gray-400'}`} />
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">{t('marketplace.checkout.hybridPayment')}</div>
                <div className="text-sm text-gray-600">
                  {t('marketplace.checkout.useCreditsAndCard', { 
                    credits: creditBalance.balance.toLocaleString(), 
                    amount: ((creditPrice.totalEur - (creditBalance.balance * creditPrice.creditToEurRate))).toFixed(2) 
                  })}
                </div>
              </div>
              {paymentMethod === 'hybrid' && (
                <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white"></div>
                </div>
              )}
            </div>
          </button>
        )}

        {/* If has credits but not enough, allow custom amount */}
        {hasCredits && paymentMethod === 'hybrid' && creditPrice && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('marketplace.checkout.creditsToUse')} ({t('marketplace.checkout.max', { count: creditBalance.balance.toLocaleString() })})
            </label>
            <input
              type="range"
              min="0"
              max={creditBalance.balance}
              step="100"
              value={creditsToUse}
              onChange={(e) => setCreditsToUse(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between items-center mt-2">
              <div className="text-sm">
                <span className="font-medium text-purple-600">{creditsToUse.toLocaleString()} {t('marketplace.checkout.creditsLabel')}</span>
                <span className="text-gray-600"> = €{creditsValueEur.toFixed(2)}</span>
              </div>
              <div className="text-sm">
                <span className="font-medium text-blue-600">€{cashNeeded.toFixed(2)}</span>
                <span className="text-gray-600"> {t('marketplace.checkout.onCard')}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Payment Summary */}
      {(paymentMethod === 'credits' || paymentMethod === 'hybrid') && creditPrice && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">{t('marketplace.checkout.paymentSummary')}</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">{t('marketplace.checkout.totalPrice')}</span>
              <span className="font-medium">€{actualPriceEur.toFixed(2)}</span>
            </div>
            {creditsToUse > 0 && (
              <>
                <div className="flex justify-between text-purple-600">
                  <span>{t('marketplace.checkout.credits')} ({creditsToUse.toLocaleString()}):</span>
                  <span>-€{creditsValueEur.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t pt-1">
                  <span className="text-gray-600">{t('marketplace.checkout.cardPaymentLabel')}</span>
                  <span className="font-medium text-blue-600">€{cashNeeded.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>{t('marketplace.checkout.remainingCredits')}</span>
                  <span>{remainingCredits.toLocaleString()}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Warning if not enough credits */}
      {!hasCredits && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-800">
            {t('marketplace.checkout.noCreditsWarning')}
          </p>
        </div>
      )}
    </div>
  );
}
