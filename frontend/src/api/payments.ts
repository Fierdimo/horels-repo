import apiClient from './client';
import type { PaymentIntent } from '@/types/models';
import type { CreatePaymentIntentRequest } from '@/types/api';

export interface PaymentHistory {
  id: number;
  booking_id: number;
  amount: number;
  currency: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  payment_method: string;
  transaction_id?: string;
  created_at: string;
  Booking?: {
    id: number;
    Property?: {
      name: string;
    };
  };
}

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
  },

  getPaymentHistory: async (): Promise<{ success: boolean; payments: PaymentHistory[] }> => {
    const { data } = await apiClient.get('/client/payments');
    return data;
  }
};
