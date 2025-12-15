import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { paymentsApi } from '@/api/payments';

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  amount: number;
  currency: string;
  onPay: (paymentIntentId: string) => void;
  isLoading?: boolean;
}

export default function PaymentModal({ onPay, amount, onClose, open, currency, isLoading }: PaymentModalProps) {
  // Placeholder for Stripe Elements integration
  const { t } = useTranslation();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stripe = useStripe();
  const elements = useElements();

  if (!open) return null;

  const handlePay = async () => {
    setProcessing(true);
    setError(null);
    try {
      // 1. Create payment intent
      const paymentIntent = await paymentsApi.createPaymentIntent({
        amount,
        currency,
        type: 'hotel_payment',
      });
      if (!stripe || !elements) throw new Error('Stripe not loaded');
      // 2. Confirm card payment
      const result = await stripe.confirmCardPayment(paymentIntent.clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement)!,
        },
      });
      if (result.error) {
        setError(result.error.message || 'Payment failed');
        setProcessing(false);
        return;
      }
      if (result.paymentIntent && result.paymentIntent.status === 'succeeded') {
        onPay(result.paymentIntent.id);
      } else {
        setError('Payment not completed');
      }
    } catch (err: any) {
      setError(err.message || 'Payment error');
    }
    setProcessing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-2">{t('payment.title')}</h2>
        <p className="mb-4 text-gray-600">{t('payment.amount')}: <span className="font-semibold">{amount} {currency}</span></p>
        <div className="mb-4">
          <CardElement options={{ hidePostalCode: true }} className="p-2 border rounded bg-gray-50" />
        </div>
        {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200">
            {t('common.cancel')}
          </button>
          <button
            onClick={handlePay}
            className="px-4 py-2 rounded bg-primary text-white hover:bg-primary/90"
            disabled={processing || isLoading || !stripe}
          >
            {processing || isLoading ? t('payment.processing') : t('payment.pay')}
          </button>
        </div>
      </div>
    </div>
  );
}
