import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import type { SwapRequest } from '@/types/models';
import { useSwaps } from '@/hooks/useSwaps';

interface SwapPaymentModalProps {
  swap: SwapRequest;
  onClose: () => void;
  onSuccess: () => void;
}

export function SwapPaymentModal({ swap, onClose, onSuccess }: SwapPaymentModalProps) {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const { createPaymentIntent, confirmPayment, creatingPaymentIntent, confirmingPayment } = useSwaps();
  
  const [error, setError] = useState<string | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState<'confirm' | 'payment'>('confirm');
  const [paymentIntentData, setPaymentIntentData] = useState<any>(null);

  const handleCreatePaymentIntent = async () => {
    setError(null);
    setProcessing(true);

    try {
      createPaymentIntent(swap.id!, {
        onSuccess: (data: any) => {
          setPaymentIntentData(data);
          setStep('payment');
          setProcessing(false);
        },
        onError: (err: any) => {
          setError(err?.response?.data?.message || t('common.error'));
          setProcessing(false);
        }
      } as any);
    } catch (err: any) {
      setError(err?.message || t('common.error'));
      setProcessing(false);
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      setError('Stripe is not initialized');
      return;
    }

    setError(null);
    setCardError(null);
    setProcessing(true);

    try {
      const cardElement = elements.getElement(CardElement);
      
      if (!cardElement) {
        setError('Card element not found');
        setProcessing(false);
        return;
      }

      // Confirm payment with Stripe
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        paymentIntentData.clientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              email: paymentIntentData.email || 'unknown@example.com'
            }
          }
        }
      );

      if (stripeError) {
        setCardError(stripeError.message || t('payment.error'));
        setProcessing(false);
        return;
      }

      if (paymentIntent?.status === 'succeeded') {
        // Confirm on backend
        confirmPayment(
          { 
            swapId: swap.id!, 
            paymentIntentId: paymentIntent.id 
          },
          {
            onSuccess: () => {
              setProcessing(false);
              onSuccess();
              onClose();
            },
            onError: (err: any) => {
              setError(err?.response?.data?.message || t('payment.confirmError'));
              setProcessing(false);
            }
          } as any
        );
      }
    } catch (err: any) {
      setError(err?.message || t('common.error'));
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
        <div className="sticky top-0 bg-gray-100 px-6 py-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">
            {t('payment.title', { defaultValue: 'Complete Payment' })}
          </h2>
          <button
            onClick={onClose}
            disabled={processing}
            className="text-gray-600 hover:text-gray-900 text-2xl leading-none disabled:opacity-50"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-4">
          {/* STEP 1: Confirmation */}
          {step === 'confirm' && (
            <div className="space-y-4">
              {/* Swap Summary */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">
                  {t('payment.swapSummary', { defaultValue: 'Your Swap' })}
                </p>
                <p className="font-semibold text-gray-900">
                  {swap.RequesterWeek?.Property?.name}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  {new Date(swap.RequesterWeek?.start_date || '').toLocaleDateString()} -{' '}
                  {new Date(swap.RequesterWeek?.end_date || '').toLocaleDateString()}
                </p>
              </div>

              {/* Fee Info */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-700">{t('payment.platformFee', { defaultValue: 'Platform Fee' })}</span>
                  <span className="text-2xl font-bold text-yellow-700">€{swap.swap_fee || 10}</span>
                </div>
                <p className="text-xs text-gray-600">
                  {t('payment.feeDescription', { 
                    defaultValue: 'This fee applies to both owners when the swap is completed' 
                  })}
                </p>
              </div>

              {/* Important Info */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-800">
                  <strong>{t('payment.important', { defaultValue: 'Important' })}:</strong>{' '}
                  {t('payment.paymentDescription', { 
                    defaultValue: 'Payment is required to finalize your swap. Once paid, the ownership transfer will be processed.' 
                  })}
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-xs text-red-800">{error}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={onClose}
                  disabled={processing}
                  className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 text-gray-800 rounded-lg font-semibold transition"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleCreatePaymentIntent}
                  disabled={processing || creatingPaymentIntent}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-semibold transition"
                >
                  {creatingPaymentIntent || processing
                    ? t('common.processing')
                    : t('payment.proceed', { defaultValue: 'Proceed to Payment' })}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Stripe Payment */}
          {step === 'payment' && (
            <form onSubmit={handlePayment} className="space-y-4">
              {/* Card Element */}
              <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  {t('payment.cardDetails', { defaultValue: 'Card Details' })}
                </label>
                <CardElement
                  options={{
                    style: {
                      base: {
                        fontSize: '16px',
                        color: '#333333',
                        fontFamily: 'system-ui, -apple-system, sans-serif'
                      },
                      invalid: {
                        color: '#ef4444'
                      }
                    }
                  }}
                  onChange={(e) => {
                    if (e.error) {
                      setCardError(e.error.message);
                    } else {
                      setCardError(null);
                    }
                  }}
                />
              </div>

              {/* Card Error */}
              {cardError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-xs text-red-800">{cardError}</p>
                </div>
              )}

              {/* Other Errors */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-xs text-red-800">{error}</p>
                </div>
              )}

              {/* Amount Display */}
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">{t('payment.amount', { defaultValue: 'Amount to Pay' })}</span>
                  <span className="text-xl font-bold text-blue-700">€{swap.swap_fee || 10}</span>
                </div>
              </div>

              {/* Test Card Info */}
              <div className="bg-gray-100 p-3 rounded-lg text-xs text-gray-600">
                <p className="font-semibold mb-1">{t('payment.testMode', { defaultValue: 'Test Mode' })}</p>
                <p>Card: 4242 4242 4242 4242</p>
                <p>Exp: Any future date</p>
                <p>CVC: Any 3 digits</p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!stripe || processing || confirmingPayment || !paymentIntentData}
                className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg font-semibold transition"
              >
                {confirmingPayment || processing
                  ? t('common.processing')
                  : t('payment.completePayment', { defaultValue: 'Complete Payment' })}
              </button>

              {/* Back Button */}
              <button
                type="button"
                onClick={() => setStep('confirm')}
                disabled={processing || confirmingPayment}
                className="w-full px-4 py-2 bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 text-gray-800 rounded-lg font-semibold transition"
              >
                {t('common.back')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
