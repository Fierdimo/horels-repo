import { useState, useEffect } from 'react';
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
  onPaymentMethodChange
}: CreditPaymentSelectorProps) {
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'credits' | 'hybrid'>('card');
  const [creditsToUse, setCreditsToUse] = useState(0);

  // Fetch user's credit balance
  const { data: creditBalance, isLoading: loadingBalance } = useQuery({
    queryKey: ['creditBalance', userId],
    queryFn: async () => {
      if (!userId) return null;
      const response = await apiClient.get(`/api/marketplace/credits/balance/${userId}`);
      return response.data.data;
    },
    enabled: !!userId
  });

  // Fetch credit price calculation
  const { data: creditPrice, isLoading: loadingPrice } = useQuery({
    queryKey: ['creditPrice', propertyId, roomType, checkIn, checkOut],
    queryFn: async () => {
      const response = await apiClient.post(
        `/api/marketplace/properties/${propertyId}/room-types/${encodeURIComponent(roomType)}/calculate-credit-price`,
        { checkIn, checkOut, guests }
      );
      return response.data.data;
    },
    enabled: !!userId
  });

  // Calculate remaining balance after using credits
  // IMPORTANTE: Usar el precio en EUR del cálculo de créditos del backend (creditPrice.totalEur)
  // NO usar totalAmount porque puede incluir comisiones adicionales
  const actualPriceEur = creditPrice?.totalEur || totalAmount;
  const remainingCredits = (creditBalance?.balance || 0) - creditsToUse;
  const creditsValueEur = creditPrice ? creditsToUse * creditPrice.creditToEurRate : 0;
  const cashNeeded = Math.max(0, actualPriceEur - creditsValueEur);

  useEffect(() => {
    onPaymentMethodChange(paymentMethod, creditsToUse);
  }, [paymentMethod, creditsToUse, onPaymentMethodChange]);

  // Si el usuario no está logueado, solo mostrar tarjeta
  if (!userId) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2 text-blue-800">
          <CreditCard className="h-5 w-5" />
          <span className="font-medium">Payment Method: Credit Card</span>
        </div>
        <p className="text-sm text-blue-700 mt-2">
          Sign in to use credits or pay with a hybrid method
        </p>
      </div>
    );
  }

  if (loadingBalance || loadingPrice) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
        <p className="text-gray-600">Loading payment options...</p>
      </div>
    );
  }

  const hasCredits = (creditBalance?.balance || 0) > 0;
  const canPayFullyWithCredits = creditPrice && (creditBalance?.balance || 0) >= creditPrice.creditsRequired;

  return (
    <div className="space-y-4 mb-6">
      <h3 className="text-lg font-semibold text-gray-900">Payment Method</h3>

      {/* Credit Balance Info */}
      {hasCredits && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-purple-600" />
              <span className="font-medium text-purple-900">Available Credits</span>
            </div>
            <span className="text-2xl font-bold text-purple-600">
              {creditBalance.balance.toLocaleString()}
            </span>
          </div>
          {creditPrice && (
            <p className="text-sm text-purple-700 mt-2">
              This booking requires <strong>{creditPrice.creditsRequired.toLocaleString()} credits</strong> ({creditPrice.nights} nights × {creditPrice.pricePerNightCredits.toLocaleString()} credits)
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
              <div className="font-medium text-gray-900">Credit Card</div>
                <div className="text-sm text-gray-600">Pay €{actualPriceEur.toFixed(2)} with card</div>
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
                <div className="font-medium text-gray-900">Pay with Credits</div>
                <div className="text-sm text-gray-600">
                  Use {creditPrice.creditsRequired.toLocaleString()} credits (Remaining: {(creditBalance.balance - creditPrice.creditsRequired).toLocaleString()})
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
                <div className="font-medium text-gray-900">Hybrid Payment</div>
                <div className="text-sm text-gray-600">
                  Use {creditBalance.balance.toLocaleString()} credits + €{((creditPrice.totalEur - (creditBalance.balance * creditPrice.creditToEurRate))).toFixed(2)} card
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
              Credits to use (max: {creditBalance.balance.toLocaleString()})
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
                <span className="font-medium text-purple-600">{creditsToUse.toLocaleString()} credits</span>
                <span className="text-gray-600"> = €{creditsValueEur.toFixed(2)}</span>
              </div>
              <div className="text-sm">
                <span className="font-medium text-blue-600">€{cashNeeded.toFixed(2)}</span>
                <span className="text-gray-600"> on card</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Payment Summary */}
      {(paymentMethod === 'credits' || paymentMethod === 'hybrid') && creditPrice && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">Payment Summary</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Price:</span>
              <span className="font-medium">€{actualPriceEur.toFixed(2)}</span>
            </div>
            {creditsToUse > 0 && (
              <>
                <div className="flex justify-between text-purple-600">
                  <span>Credits ({creditsToUse.toLocaleString()}):</span>
                  <span>-€{creditsValueEur.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t pt-1">
                  <span className="text-gray-600">Card Payment:</span>
                  <span className="font-medium text-blue-600">€{cashNeeded.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>Remaining Credits:</span>
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
            You don't have any credits. Release a week to earn credits or proceed with card payment.
          </p>
        </div>
      )}
    </div>
  );
}
