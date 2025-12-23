import { useState, useEffect } from 'react';
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
        toast.error(error.message || 'Error al configurar el método de pago');
        return;
      }

      if (setupIntent?.payment_method) {
        await paymentMethodApi.savePaymentMethod(setupIntent.payment_method as string);
        toast.success('Método de pago configurado exitosamente');
        onSuccess();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al guardar el método de pago');
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
        {isProcessing ? 'Procesando...' : 'Guardar Método de Pago'}
      </button>
    </form>
  );
}

export default function PaymentMethodSetup() {
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
      toast.error(error.response?.data?.message || 'Error al iniciar configuración');
    },
  });

  // Remove payment method mutation
  const removeMutation = useMutation({
    mutationFn: paymentMethodApi.removePaymentMethod,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
      queryClient.invalidateQueries({ queryKey: ['payment-method-status'] });
      toast.success('Método de pago eliminado');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al eliminar método de pago');
    },
  });

  const handleAddPaymentMethod = () => {
    createSetupMutation.mutate();
  };

  const handleRemovePaymentMethod = (methodId: string) => {
    if (confirm('¿Estás seguro de eliminar este método de pago?')) {
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
        <h2 className="text-xl font-semibold mb-4">Métodos de Pago</h2>
        <p className="text-gray-500">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Métodos de Pago</h2>
        {!showForm && (
          <button
            onClick={handleAddPaymentMethod}
            disabled={createSetupMutation.isPending}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {createSetupMutation.isPending ? 'Cargando...' : '+ Agregar Tarjeta'}
          </button>
        )}
      </div>

      {/* Current payment methods */}
      {paymentMethods && paymentMethods.length > 0 && (
        <div className="mb-6 space-y-3">
          <h3 className="text-sm font-medium text-gray-700">Tarjetas Guardadas</h3>
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
                    Expira {method.card?.exp_month}/{method.card?.exp_year}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleRemovePaymentMethod(method.id)}
                disabled={removeMutation.isPending}
                className="text-red-600 hover:text-red-800 text-sm font-medium"
              >
                Eliminar
              </button>
            </div>
          ))}
        </div>
      )}

      {/* No payment methods message */}
      {(!paymentMethods || paymentMethods.length === 0) && !showForm && (
        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-500 mb-2">No tienes métodos de pago configurados</p>
          <p className="text-sm text-gray-400">
            Necesitas agregar un método de pago para crear o aceptar intercambios
          </p>
        </div>
      )}

      {/* Add payment method form */}
      {showForm && clientSecret && (
        <div className="border rounded-lg p-4 bg-gray-50">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium">Agregar Nueva Tarjeta</h3>
            <button
              onClick={() => {
                setShowForm(false);
                setClientSecret(null);
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              Cancelar
            </button>
          </div>
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
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
          <span className="font-medium">ℹ️ Nota:</span> Los métodos de pago se utilizan para procesar
          automáticamente las tarifas de intercambio cuando el staff aprueba una solicitud.
        </p>
      </div>
    </div>
  );
}
