import apiClient from './client';
import type { ApiResponse } from '@/types/models';

export interface PaymentMethod {
  id: string;
  card?: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
  type: string;
}

export interface SetupIntentResponse {
  clientSecret: string;
  customerId: string;
}

export const paymentMethodApi = {
  // Create setup intent for adding payment method
  createSetupIntent: async (): Promise<SetupIntentResponse> => {
    const { data } = await apiClient.post<ApiResponse<SetupIntentResponse>>('/payment-methods/setup-intent');
    if (!data.data) throw new Error('No setup intent data received');
    return data.data;
  },

  // Save payment method
  savePaymentMethod: async (paymentMethodId: string): Promise<void> => {
    await apiClient.post('/payment-methods/save-method', { paymentMethodId });
  },

  // Get user's payment methods
  getPaymentMethods: async (): Promise<PaymentMethod[]> => {
    const { data } = await apiClient.get<ApiResponse<PaymentMethod[]>>('/payment-methods/methods');
    return data.data || [];
  },

  // Remove payment method
  removePaymentMethod: async (methodId: string): Promise<void> => {
    await apiClient.delete(`/payment-methods/methods/${methodId}`);
  },

  // Check if user has payment method
  hasPaymentMethod: async (): Promise<boolean> => {
    const { data } = await apiClient.get<ApiResponse<{ hasPaymentMethod: boolean }>>('/payment-methods/has-method');
    return data.data?.hasPaymentMethod || false;
  },
};
