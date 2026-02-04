import api from '../client';

// ==================== Types ====================

export interface CreditBalance {
  balance: number;
  accountId: number;
  userId: number;
  creditType: 'OWNER' | 'GUEST' | 'STAFF';
}

export interface CreditTransaction {
  id: number;
  accountId: number;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description?: string;
  referenceType?: string;
  referenceId?: number;
  createdAt: string;
}

// ==================== API Calls ====================

/**
 * Get user's credit balance
 */
export const getCreditBalance = async (): Promise<CreditBalance> => {
  const response = await api.get('/api/v2/credits/balance');
  return response.data.data;
};

/**
 * Get credit transaction history
 */
export const getCreditTransactions = async (page = 1, limit = 20): Promise<{
  transactions: CreditTransaction[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> => {
  const response = await api.get(`/api/v2/credits/transactions?page=${page}&limit=${limit}`);
  return response.data.data;
};
