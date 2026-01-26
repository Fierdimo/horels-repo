import axios from 'axios';

const API_BASE = '/hotels/api/marketplace';

// ==================== TYPES ====================

export interface Week {
  id: number;
  owner_id: number;
  property_id: number;
  start_date: string | null;
  end_date: string | null;
  nights: number | null;
  accommodation_type: string;
  season_type: 'RED' | 'WHITE' | 'BLUE';
  status: string;
}

export interface InventoryItem {
  id: number;
  week_id: number;
  owner_id: number;
  property_id: number;
  start_date: string | null;
  end_date: string | null;
  nights: number | null;
  accommodation_type: string;
  season_type: 'RED' | 'WHITE' | 'BLUE';
  credit_price: number;
  credit_price_breakdown: {
    seasonType: string;
    baseValue: number;
    tierMultiplier: number;
    locationMultiplier: number;
    roomTypeMultiplier: number;
    propertyName?: string;
    propertyTier?: string;
    roomType?: string;
  } | null;
  status: 'available' | 'reserved' | 'sold' | 'expired' | 'withdrawn';
  released_at: string;
  property?: any;
  week?: Week;
}

export interface ReleaseEstimate {
  weekId: number;
  estimatedCredits: number;
  breakdown: any;
  propertyName: string;
  accommodationType: string;
  seasonType: string;
}

export interface PaymentOption {
  type: 'credits_only' | 'credits_plus_cash' | 'cash_only';
  creditsUsed: number;
  cashAmount: number;
  description: string;
  canAfford: boolean;
}

export interface PaymentCalculation {
  availableCredits: number;
  requiredCredits: number;
  difference: number;
  options: PaymentOption[];
}

export interface SearchFilters {
  propertyId?: number;
  propertyIds?: number[];
  accommodationType?: string;
  seasonType?: 'RED' | 'WHITE' | 'BLUE';
  startDate?: string;
  endDate?: string;
  minCredits?: number;
  maxCredits?: number;
  minNights?: number;
  maxNights?: number;
  isFloating?: boolean;
  page?: number;
  pageSize?: number;
}

export interface SearchResult {
  success: boolean;
  items: InventoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface BookingRequest {
  inventoryItemId: number;
  paymentType: 'credits_only' | 'credits_plus_cash' | 'cash_only';
  creditsToUse: number;
  cashAmount?: number;
  stripePaymentMethodId?: string;
}

// ==================== API FUNCTIONS ====================

// Week Release APIs
export const getEligibleWeeks = async (): Promise<{ weeks: Week[]; count: number }> => {
  const response = await axios.get(`${API_BASE}/weeks/eligible`);
  return response.data;
};

export const estimateWeekValue = async (weekId: number): Promise<ReleaseEstimate> => {
  const response = await axios.post(`${API_BASE}/weeks/${weekId}/estimate`);
  return response.data.estimate;
};

export const releaseWeek = async (weekId: number): Promise<{
  inventoryItemId: number;
  creditsEarned: number;
  walletBalance: number;
  breakdown: any;
  releasedAt: string;
}> => {
  const response = await axios.post(`${API_BASE}/weeks/${weekId}/release`);
  return response.data.data;
};

export const canReleaseWeek = async (weekId: number): Promise<{
  canRelease: boolean;
  reason?: string;
}> => {
  const response = await axios.post(`${API_BASE}/weeks/${weekId}/can-release`);
  return response.data;
};

export const withdrawFromInventory = async (itemId: number): Promise<{
  success: boolean;
  creditsRefunded?: number;
  message: string;
}> => {
  const response = await axios.post(`${API_BASE}/inventory/${itemId}/withdraw`);
  return response.data;
};

// Inventory Search APIs
export const searchInventory = async (filters: SearchFilters): Promise<SearchResult> => {
  const params = new URLSearchParams();
  
  if (filters.propertyId) params.append('propertyId', filters.propertyId.toString());
  if (filters.propertyIds) params.append('propertyIds', filters.propertyIds.join(','));
  if (filters.accommodationType) params.append('accommodationType', filters.accommodationType);
  if (filters.seasonType) params.append('seasonType', filters.seasonType);
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  if (filters.minCredits !== undefined) params.append('minCredits', filters.minCredits.toString());
  if (filters.maxCredits !== undefined) params.append('maxCredits', filters.maxCredits.toString());
  if (filters.minNights !== undefined) params.append('minNights', filters.minNights.toString());
  if (filters.maxNights !== undefined) params.append('maxNights', filters.maxNights.toString());
  if (filters.isFloating !== undefined) params.append('isFloating', filters.isFloating.toString());
  if (filters.page) params.append('page', filters.page.toString());
  if (filters.pageSize) params.append('pageSize', filters.pageSize.toString());

  const response = await axios.get(`${API_BASE}/inventory/search?${params.toString()}`);
  return response.data;
};

export const getInventoryItem = async (itemId: number): Promise<InventoryItem> => {
  const response = await axios.get(`${API_BASE}/inventory/${itemId}`);
  return response.data.item;
};

export const getInventoryStats = async (): Promise<{
  totalAvailable: number;
  totalReserved: number;
  totalSold: number;
  byProperty: Record<number, number>;
  bySeason: Record<string, number>;
}> => {
  const response = await axios.get(`${API_BASE}/inventory/stats`);
  return response.data.stats;
};

export const getMyInventory = async (includeWithdrawn: boolean = false): Promise<{
  items: InventoryItem[];
  count: number;
}> => {
  const params = includeWithdrawn ? '?includeWithdrawn=true' : '';
  const response = await axios.get(`${API_BASE}/my-inventory${params}`);
  return response.data;
};

// Booking APIs
export const calculatePaymentOptions = async (itemId: number): Promise<PaymentCalculation> => {
  const response = await axios.post(`${API_BASE}/inventory/${itemId}/payment-options`);
  return response.data;
};

export const previewBooking = async (itemId: number): Promise<{
  item: InventoryItem;
  paymentOptions: PaymentCalculation;
  estimatedCheckIn?: string;
  estimatedCheckOut?: string;
  nights?: number;
}> => {
  const response = await axios.post(`${API_BASE}/inventory/${itemId}/preview`);
  return response.data;
};

export const reserveItem = async (itemId: number, expiresInMinutes?: number): Promise<{
  success: boolean;
  expiresAt?: string;
}> => {
  const response = await axios.post(`${API_BASE}/inventory/${itemId}/reserve`, {
    expiresInMinutes
  });
  return response.data;
};

export const releaseReservation = async (itemId: number): Promise<{
  success: boolean;
  message: string;
}> => {
  const response = await axios.post(`${API_BASE}/inventory/${itemId}/release-reservation`);
  return response.data;
};

export const bookWithCredits = async (request: BookingRequest): Promise<{
  bookingId: number;
  creditsUsed: number;
  cashPaid: number;
  walletBalance: number;
}> => {
  const response = await axios.post(`${API_BASE}/book`, request);
  return response.data.data;
};

export const getMyCreditBookings = async (): Promise<{
  bookings: any[];
  count: number;
}> => {
  const response = await axios.get(`${API_BASE}/my-bookings`);
  return response.data;
};

export const cancelBooking = async (bookingId: number, reason: string): Promise<{
  success: boolean;
  creditsRefunded: number;
  cashRefunded: number;
  message: string;
}> => {
  const response = await axios.post(`${API_BASE}/bookings/${bookingId}/cancel`, { reason });
  return response.data;
};

export default {
  // Week Release
  getEligibleWeeks,
  estimateWeekValue,
  releaseWeek,
  canReleaseWeek,
  withdrawFromInventory,
  
  // Inventory Search
  searchInventory,
  getInventoryItem,
  getInventoryStats,
  getMyInventory,
  
  // Booking
  calculatePaymentOptions,
  previewBooking,
  reserveItem,
  releaseReservation,
  bookWithCredits,
  getMyCreditBookings,
  cancelBooking
};
