// Credit System Types

export interface CreditWallet {
  id: number;
  user_id: number;
  balance: number;
  total_earned: number;
  total_spent: number;
  total_expired: number;
  total_refunded: number;
  created_at: string;
  updated_at: string;
}

export type TransactionType = 'DEPOSIT' | 'SPEND' | 'REFUND' | 'EXPIRE' | 'ADJUSTMENT';
export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'SPENT' | 'EXPIRED' | 'CANCELLED';

export interface CreditTransaction {
  id: number;
  user_id: number;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  description: string | null;
  reference_type: 'week' | 'booking' | 'swap' | 'adjustment' | null;
  reference_id: number | null;
  week_id: number | null;
  booking_id: number | null;
  swap_request_id: number | null;
  created_at: string;
  expires_at: string | null;
  spent_at: string | null;
  expired_at: string | null;
}

export type PropertyTierLevel = 'DIAMOND' | 'GOLD_HIGH' | 'GOLD' | 'SILVER_PLUS' | 'SILVER' | 'STANDARD';

export interface PropertyTier {
  id: number;
  level: PropertyTierLevel;
  multiplier: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export type RoomType = 'STANDARD' | 'SUPERIOR' | 'DELUXE' | 'SUITE' | 'PRESIDENTIAL';

export interface RoomTypeMultiplier {
  id: number;
  room_type: RoomType;
  multiplier: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export type SeasonType = 'RED' | 'WHITE' | 'BLUE';

export interface SeasonalCalendar {
  id: number;
  property_id: number;
  year: number;
  week_number: number;
  season_type: SeasonType;
  base_season_value: number;
  created_at: string;
  updated_at: string;
}

export interface BookingCost {
  id: number;
  property_id: number;
  room_type: RoomType;
  season_type: SeasonType;
  credit_cost: number;
  created_at: string;
  updated_at: string;
}

export interface PlatformSetting {
  id: number;
  setting_key: string;
  setting_value: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface SettingChangeLog {
  id: number;
  admin_user_id: number;
  change_type: 'tier' | 'multiplier' | 'calendar' | 'cost' | 'setting';
  table_name: string;
  record_id: number;
  old_value: string | null;
  new_value: string;
  description: string | null;
  created_at: string;
}

// API Response Types

export interface GetWalletResponse {
  success: boolean;
  wallet: CreditWallet;
}

export interface GetTransactionsResponse {
  success: boolean;
  transactions: CreditTransaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DepositWeekRequest {
  userId: number;
  weekId: number;
  seasonType: SeasonType;
  locationMultiplier: number;
  roomTypeMultiplier: number;
}

export interface DepositWeekResponse {
  success: boolean;
  message: string;
  wallet: CreditWallet;
  transaction: CreditTransaction;
  creditsEarned: number;
  expirationDate: string;
}

export interface EstimateCreditsRequest {
  seasonType: SeasonType;
  locationMultiplier: number;
  roomTypeMultiplier: number;
}

export interface EstimateCreditsResponse {
  success: boolean;
  estimatedCredits: number;
  breakdown: {
    baseSeasonValue: number;
    locationMultiplier: number;
    roomTypeMultiplier: number;
  };
  expirationDate: string;
}

export interface CheckAffordabilityRequest {
  userId: number;
  requiredCredits: number;
}

export interface CheckAffordabilityResponse {
  success: boolean;
  canAfford: boolean;
  currentBalance: number;
  requiredCredits: number;
  shortfall: number;
}

export interface SpendCreditsRequest {
  userId: number;
  amount: number;
  bookingId?: number;
  description?: string;
}

export interface SpendCreditsResponse {
  success: boolean;
  message: string;
  wallet: CreditWallet;
  creditsUsed: number;
  remainingBalance: number;
  transactionsUsed: CreditTransaction[];
}

export interface RefundCreditsRequest {
  bookingId: number;
  reason?: string;
}

export interface RefundCreditsResponse {
  success: boolean;
  message: string;
  wallet: CreditWallet;
  creditsRefunded: number;
  newBalance: number;
  transaction: CreditTransaction;
}

export interface GetRateResponse {
  success: boolean;
  rate: number;
  currency: string;
}

export interface GetExpiringCreditsResponse {
  success: boolean;
  expiringCredits: {
    total: number;
    transactions: CreditTransaction[];
  };
  daysUntilExpiration: number;
}

// Admin API Response Types

export interface GetTiersResponse {
  success: boolean;
  tiers: PropertyTier[];
}

export interface UpdateTierRequest {
  multiplier?: number;
  description?: string;
}

export interface UpdateTierResponse {
  success: boolean;
  message: string;
  tier: PropertyTier;
}

export interface AssignTierRequest {
  tierLevel: PropertyTierLevel;
}

export interface AssignTierResponse {
  success: boolean;
  message: string;
  property: {
    id: number;
    name: string;
    tier_level: PropertyTierLevel;
  };
}

export interface GetRoomMultipliersResponse {
  success: boolean;
  multipliers: RoomTypeMultiplier[];
}

export interface UpdateRoomMultiplierRequest {
  multiplier?: number;
  description?: string;
}

export interface UpdateRoomMultiplierResponse {
  success: boolean;
  message: string;
  multiplier: RoomTypeMultiplier;
}

export interface GetSeasonalCalendarResponse {
  success: boolean;
  calendar: SeasonalCalendar[];
}

export interface CreateSeasonalCalendarRequest {
  propertyId: number;
  year: number;
  weekNumber: number;
  seasonType: SeasonType;
  baseSeasonValue: number;
}

export interface CreateSeasonalCalendarResponse {
  success: boolean;
  message: string;
  entry: SeasonalCalendar;
}

export interface GetBookingCostsResponse {
  success: boolean;
  costs: BookingCost[];
}

export interface UpdateBookingCostsRequest {
  costs: Array<{
    roomType: RoomType;
    seasonType: SeasonType;
    creditCost: number;
  }>;
}

export interface UpdateBookingCostsResponse {
  success: boolean;
  message: string;
  updatedCount: number;
}

export interface GetSettingsResponse {
  success: boolean;
  settings: PlatformSetting[];
}

export interface UpdateSettingRequest {
  value: string;
  description?: string;
}

export interface UpdateSettingResponse {
  success: boolean;
  message: string;
  setting: PlatformSetting;
}

export interface GetChangeLogResponse {
  success: boolean;
  logs: SettingChangeLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Helper Types for UI

export interface CreditBreakdown {
  baseSeasonValue: number;
  seasonType: SeasonType;
  locationMultiplier: number;
  roomTypeMultiplier: number;
  totalCredits: number;
}

export interface TransactionFilters {
  type?: TransactionType[];
  status?: TransactionStatus[];
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface CreditStats {
  totalBalance: number;
  totalEarned: number;
  totalSpent: number;
  totalExpired: number;
  totalRefunded: number;
  expiringIn30Days: number;
  expiringIn7Days: number;
  avgMonthlyEarned: number;
  avgMonthlySpent: number;
}
