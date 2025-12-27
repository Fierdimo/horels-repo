import apiClient from './client';
import type {
  GetWalletResponse,
  GetTransactionsResponse,
  DepositWeekRequest,
  DepositWeekResponse,
  EstimateCreditsRequest,
  EstimateCreditsResponse,
  CheckAffordabilityRequest,
  CheckAffordabilityResponse,
  SpendCreditsRequest,
  SpendCreditsResponse,
  RefundCreditsRequest,
  RefundCreditsResponse,
  GetRateResponse,
  GetExpiringCreditsResponse,
} from '@/types/credits';

/**
 * Credit System API Service
 * Handles all API calls related to the variable credit system
 */
export const creditsApi = {
  /**
   * Get user's credit wallet
   */
  getWallet: async (userId: number): Promise<GetWalletResponse> => {
    const { data } = await apiClient.get<GetWalletResponse>(`/credits/wallet/${userId}`);
    return data;
  },

  /**
   * Get user's transaction history with pagination
   */
  getTransactions: async (
    userId: number,
    page: number = 1,
    limit: number = 20
  ): Promise<GetTransactionsResponse> => {
    const { data } = await apiClient.get<GetTransactionsResponse>(
      `/credits/transactions/${userId}?page=${page}&limit=${limit}`
    );
    return data;
  },

  /**
   * Deposit a week for credits
   */
  depositWeek: async (payload: DepositWeekRequest): Promise<DepositWeekResponse> => {
    const { data } = await apiClient.post<DepositWeekResponse>('/credits/deposit', payload);
    return data;
  },

  /**
   * Estimate credits for a potential deposit
   */
  estimateCredits: async (payload: EstimateCreditsRequest): Promise<EstimateCreditsResponse> => {
    const { data } = await apiClient.post<EstimateCreditsResponse>('/credits/estimate', payload);
    return data;
  },

  /**
   * Check if user can afford a booking
   */
  checkAffordability: async (payload: CheckAffordabilityRequest): Promise<CheckAffordabilityResponse> => {
    const { data } = await apiClient.post<CheckAffordabilityResponse>('/credits/check-affordability', payload);
    return data;
  },

  /**
   * Spend credits for a booking
   */
  spendCredits: async (payload: SpendCreditsRequest): Promise<SpendCreditsResponse> => {
    const { data } = await apiClient.post<SpendCreditsResponse>('/credits/spend', payload);
    return data;
  },

  /**
   * Refund credits from a cancelled booking
   */
  refundCredits: async (payload: RefundCreditsRequest): Promise<RefundCreditsResponse> => {
    const { data } = await apiClient.post<RefundCreditsResponse>('/credits/refund', payload);
    return data;
  },

  /**
   * Get current credit-to-euro conversion rate
   */
  getRate: async (): Promise<GetRateResponse> => {
    const { data } = await apiClient.get<GetRateResponse>('/credits/rate');
    return data;
  },

  /**
   * Get credits expiring within the next 30 days
   */
  getExpiringCredits: async (userId: number, days: number = 30): Promise<GetExpiringCreditsResponse> => {
    const { data } = await apiClient.get<GetExpiringCreditsResponse>(
      `/credits/expiring/${userId}?days=${days}`
    );
    return data;
  },
};
