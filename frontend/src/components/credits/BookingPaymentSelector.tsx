import { useState } from 'react';
import { CreditCard, Euro, Wallet } from 'lucide-react';

export type PaymentMethod = 'credits' | 'stripe' | 'hybrid';

interface BookingPaymentSelectorProps {
  requiredCredits: number;
  availableCredits: number;
  priceInEuros: number;
  onPaymentMethodChange: (method: PaymentMethod, creditsToUse?: number) => void;
  disabled?: boolean;
}

/**
 * Component to select payment method for booking
 * Allows choosing between full credits, full Stripe, or hybrid payment
 */
export function BookingPaymentSelector({
  requiredCredits,
  availableCredits,
  priceInEuros,
  onPaymentMethodChange,
  disabled = false
}: BookingPaymentSelectorProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('credits');
  const [creditsToUse, setCreditsToUse] = useState(Math.min(requiredCredits, availableCredits));

  const canPayFullCredits = availableCredits >= requiredCredits;
  const creditToEuroRate = priceInEuros / requiredCredits; // Approximate rate

  const handleMethodChange = (method: PaymentMethod) => {
    setSelectedMethod(method);
    
    if (method === 'credits') {
      setCreditsToUse(Math.min(requiredCredits, availableCredits));
      onPaymentMethodChange(method, Math.min(requiredCredits, availableCredits));
    } else if (method === 'stripe') {
      setCreditsToUse(0);
      onPaymentMethodChange(method, 0);
    } else {
      // hybrid - use all available credits
      setCreditsToUse(availableCredits);
      onPaymentMethodChange(method, availableCredits);
    }
  };

  const handleCreditsChange = (credits: number) => {
    const validCredits = Math.max(0, Math.min(credits, availableCredits, requiredCredits));
    setCreditsToUse(validCredits);
    onPaymentMethodChange('hybrid', validCredits);
  };

  const remainingEuros = selectedMethod === 'hybrid' 
    ? ((requiredCredits - creditsToUse) * creditToEuroRate)
    : selectedMethod === 'stripe' 
      ? priceInEuros 
      : 0;

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-900">Select Payment Method</h3>

      <div className="space-y-3">
        {/* Full Credits Payment */}
        <label
          className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
            selectedMethod === 'credits'
              ? 'border-primary bg-primary/5'
              : 'border-gray-200 hover:border-gray-300'
          } ${!canPayFullCredits || disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input
            type="radio"
            name="payment"
            value="credits"
            checked={selectedMethod === 'credits'}
            onChange={() => handleMethodChange('credits')}
            disabled={!canPayFullCredits || disabled}
            className="mt-1"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              <span className="font-medium">Pay with Credits</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Use {requiredCredits.toLocaleString()} credits from your balance
            </p>
            {!canPayFullCredits && (
              <p className="text-sm text-red-600 mt-1">
                Insufficient credits (need {(requiredCredits - availableCredits).toLocaleString()} more)
              </p>
            )}
          </div>
        </label>

        {/* Stripe Payment */}
        <label
          className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
            selectedMethod === 'stripe'
              ? 'border-primary bg-primary/5'
              : 'border-gray-200 hover:border-gray-300'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input
            type="radio"
            name="payment"
            value="stripe"
            checked={selectedMethod === 'stripe'}
            onChange={() => handleMethodChange('stripe')}
            disabled={disabled}
            className="mt-1"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <span className="font-medium">Pay with Card</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Pay €{priceInEuros.toFixed(2)} via Stripe
            </p>
          </div>
        </label>

        {/* Hybrid Payment */}
        {availableCredits > 0 && availableCredits < requiredCredits && (
          <label
            className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
              selectedMethod === 'hybrid'
                ? 'border-primary bg-primary/5'
                : 'border-gray-200 hover:border-gray-300'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <input
              type="radio"
              name="payment"
              value="hybrid"
              checked={selectedMethod === 'hybrid'}
              onChange={() => handleMethodChange('hybrid')}
              disabled={disabled}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Euro className="h-5 w-5 text-primary" />
                <span className="font-medium">Hybrid Payment</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Use your available credits + pay the rest with card
              </p>

              {selectedMethod === 'hybrid' && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-700 min-w-[100px]">
                      Credits to use:
                    </label>
                    <input
                      type="range"
                      min="0"
                      max={Math.min(availableCredits, requiredCredits)}
                      value={creditsToUse}
                      onChange={(e) => handleCreditsChange(Number(e.target.value))}
                      className="flex-1"
                      disabled={disabled}
                    />
                    <input
                      type="number"
                      min="0"
                      max={Math.min(availableCredits, requiredCredits)}
                      value={creditsToUse}
                      onChange={(e) => handleCreditsChange(Number(e.target.value))}
                      className="w-24 px-2 py-1 border rounded text-sm"
                      disabled={disabled}
                    />
                  </div>
                  
                  <div className="text-sm space-y-1 bg-gray-50 p-3 rounded">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Credits used:</span>
                      <span className="font-medium">{creditsToUse.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Card payment:</span>
                      <span className="font-medium">€{remainingEuros.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </label>
        )}
      </div>

      {/* Summary */}
      <div className="border-t pt-4">
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Total booking cost:</span>
            <span className="font-medium">{requiredCredits.toLocaleString()} credits</span>
          </div>
          {selectedMethod !== 'stripe' && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Credits to use:</span>
              <span className="font-medium text-primary">{creditsToUse.toLocaleString()} credits</span>
            </div>
          )}
          {remainingEuros > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Card payment:</span>
              <span className="font-medium text-primary">€{remainingEuros.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm pt-2 border-t">
            <span className="text-gray-600">Remaining balance:</span>
            <span className="font-medium">
              {(availableCredits - (selectedMethod === 'stripe' ? 0 : creditsToUse)).toLocaleString()} credits
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
