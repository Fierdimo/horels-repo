import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { paymentMethodApi } from '@/api/paymentMethod';
import type { PaymentMethod } from '@/api/paymentMethod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

function PaymentForm({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useTranslation();
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
      const { error, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: 'if_required',
      });

      if (error) {
        toast.error(error.message || t('owner.profile.failedToSave'));
        return;
      }

      if (setupIntent?.payment_method) {
        await paymentMethodApi.savePaymentMethod(setupIntent.payment_method as string);
        toast.success(t('owner.profile.cardSaved'));
        onSuccess();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('owner.profile.failedToSave'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isProcessing ? t('common.processing') : t('owner.profile.saveCard')}
      </button>
    </form>
  );
}

export default function PaymentMethodSetup() {
  const { t, i18n } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Get payment methods
  const { data: paymentMethods, isLoading } = useQuery<PaymentMethod[]>({
    queryKey: ['payment-methods'],
    queryFn: paymentMethodApi.getPaymentMethods,
  });

  // Create setup intent mutation
  const createSetupMutation = useMutation({
    mutationFn: paymentMethodApi.createSetupIntent,
    onSuccess: (data) => {
      setClientSecret(data.clientSecret);
      setShowForm(true);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || t('owner.profile.failedToSave'));
    },
  });

  // Remove payment method mutation
  const removeMutation = useMutation({
    mutationFn: paymentMethodApi.removePaymentMethod,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
      queryClient.invalidateQueries({ queryKey: ['payment-method-status'] });
      toast.success(t('owner.profile.cardRemoved'));
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || t('owner.profile.failedToRemove'));
    },
  });

  const handleAddPaymentMethod = () => {
    createSetupMutation.mutate();
  };

  const handleRemovePaymentMethod = (methodId: string) => {
    if (confirm(t('owner.profile.removePaymentMethod') + '?')) {
      removeMutation.mutate(methodId);
    }
  };

  const handleSuccess = () => {
    setShowForm(false);
    setClientSecret(null);
    queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
    queryClient.invalidateQueries({ queryKey: ['payment-method-status'] });
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">{t('owner.profile.paymentMethods')}</h2>
        <p className="text-gray-500">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">{t('owner.profile.paymentMethods')}</h2>
        {!showForm && (
          <button
            onClick={handleAddPaymentMethod}
            disabled={createSetupMutation.isPending}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {createSetupMutation.isPending ? t('common.loading') : t('owner.profile.addPaymentMethod')}
          </button>
        )}
      </div>

      {/* Current payment methods */}
      {paymentMethods && paymentMethods.length > 0 && (
        <div className="mb-6 space-y-3">
          <h3 className="text-sm font-medium text-gray-700">{t('marketplace.savedCards')}</h3>
          {paymentMethods.map((method) => (
            <div
              key={method.id}
              className="flex items-center justify-between p-4 border rounded-lg bg-gray-50"
            >
              <div className="flex items-center space-x-3">
                <div className="text-2xl">
                  {method.card?.brand === 'visa' && '💳'}
                  {method.card?.brand === 'mastercard' && '💳'}
                  {method.card?.brand === 'amex' && '💳'}
                  {!method.card?.brand && '💳'}
                </div>
                <div>
                  <p className="font-medium capitalize">
                    {method.card?.brand || method.type} •••• {method.card?.last4}
                  </p>
                  <p className="text-sm text-gray-500">
                    {t('owner.profile.expires')} {method.card?.exp_month}/{method.card?.exp_year}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleRemovePaymentMethod(method.id)}
                disabled={removeMutation.isPending}
                className="text-red-600 hover:text-red-800 text-sm font-medium"
              >
                {t('common.delete')}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* No payment methods message */}
      {(!paymentMethods || paymentMethods.length === 0) && !showForm && (
        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-500 mb-2">{t('owner.profile.noPaymentMethods')}</p>
          <p className="text-sm text-gray-400">
            {t('owner.profile.addCardPrompt')}
          </p>
        </div>
      )}

      {/* Add payment method form */}
      {showForm && clientSecret && (
        <div className="border rounded-lg p-4 bg-gray-50">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium">{t('owner.profile.addPaymentMethod')}</h3>
            <button
              onClick={() => {
                setShowForm(false);
                setClientSecret(null);
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              {t('common.cancel')}
            </button>
          </div>
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              locale: i18n.language as any,
              appearance: {
                theme: 'stripe',
              },
            }}
          >
            <PaymentForm onSuccess={handleSuccess} />
          </Elements>
        </div>
      )}

      {/* Info message */}
      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <span className="font-medium">ℹ️ {t('common.note')}:</span> {t('owner.profile.paymentMethodNote')}
        </p>
      </div>
    </div>
  );
}
