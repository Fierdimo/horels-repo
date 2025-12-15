import { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import apiClient from '@/api/client';
import toast from 'react-hot-toast';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useAuthStore } from '@/stores/authStore';

interface CheckoutFormProps {
  paymentIntentId: string;
  propertyId: string;
  guestEmail: string;
}

export default function CheckoutForm({ paymentIntentId, propertyId, guestEmail }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string>('');

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      // Confirmar el pago con Stripe
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/marketplace/booking-success`,
          receipt_email: guestEmail,
        },
        redirect: 'if_required',
      });

      if (error) {
        setMessage(error.message || 'An unexpected error occurred.');
        toast.error(error.message || t('marketplace.paymentError'));
        setIsLoading(false);
        return;
      }

      if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Pago exitoso, confirmar el booking en nuestro backend
        try {
          await apiClient.post('/public/bookings/confirm-payment', {
            payment_intent_id: paymentIntent.id
          });

          toast.success(t('marketplace.bookingConfirmed'));
          
          // Redirigir a la página de confirmación
          navigate(`${getMarketplaceBasePath()}/booking-success`, {
            state: { paymentIntentId: paymentIntent.id }
          });
        } catch (error: any) {
          console.error('Error confirming booking:', error);
          toast.error(t('marketplace.bookingConfirmationError'));
          setMessage('Payment succeeded but booking confirmation failed. Please contact support.');
        }
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      setMessage(error.message || 'An unexpected error occurred.');
      toast.error(t('marketplace.paymentError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      
      {message && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {message}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || !stripe || !elements}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
      >
        {isLoading ? (
          <>
            <LoadingSpinner size="sm" />
            <span className="ml-2">{t('marketplace.processing')}</span>
          </>
        ) : (
          t('marketplace.completePayment')
        )}
      </button>

      <p className="text-sm text-gray-600 text-center">
        {t('marketplace.securePayment')}
      </p>
    </form>
  );
}
