import { useState, useEffect } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { useOwnerNightCredits } from '@/hooks/useNightCredits';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';

interface PaymentModalProps {
  requestId: number;
  onClose: () => void;
}

export default function PaymentModal({ requestId, onClose }: PaymentModalProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { createPaymentIntent } = useOwnerNightCredits();

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    // Create payment intent when modal opens
    const initPayment = async () => {
      setLoading(true);
      try {
        const result = await createPaymentIntent.mutateAsync(requestId);
        setClientSecret(result.clientSecret);
      } catch (error) {
        toast.error('Failed to initialize payment');
        onClose();
      } finally {
        setLoading(false);
      }
    };

    initPayment();
  }, [requestId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/owner/night-credit-requests?payment=success`,
        },
      });

      if (error) {
        toast.error(error.message || 'Payment failed');
      }
    } catch (err) {
      toast.error('An error occurred during payment');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            Complete Payment
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : clientSecret ? (
            <form onSubmit={handleSubmit}>
              <PaymentElement />
              
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={processing}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!stripe || processing}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? 'Processing...' : 'Pay Now'}
                </button>
              </div>
            </form>
          ) : (
            <p className="text-center text-gray-600 py-8">
              Failed to load payment form
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
