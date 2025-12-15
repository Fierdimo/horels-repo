import apiClient from './client';
import type { PaymentIntent } from '@/types/models';
import type { CreatePaymentIntentRequest } from '@/types/api';

export const paymentsApi = {
  createPaymentIntent: async (request: CreatePaymentIntentRequest): Promise<PaymentIntent> => {
    const { data } = await apiClient.post<{ data: PaymentIntent }>('/payments/intent', request);
    return data.data;
  },

  confirmPayment: async (paymentIntentId: string): Promise<any> => {
    const { data } = await apiClient.get(`/payments/${paymentIntentId}/confirm`);
    return data;
  },

  cancelPayment: async (paymentIntentId: string): Promise<any> => {
    const { data } = await apiClient.delete(`/payments/${paymentIntentId}`);
    return data;
  }
};
