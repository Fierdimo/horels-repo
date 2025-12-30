import { User, DashboardStats } from './models';

// Re-export ApiResponse from models
export type { ApiResponse } from './models';

// Auth API types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
  roleName: 'owner' | 'guest' | 'staff' | 'admin';
  pms_property_id?: string; // External ID from PMS (for staff)
  property_data?: {
    name: string;
    location?: string;
  };
}

export interface RegisterResponse {
  message: string;
  token: string;
  user: User;
  userId: number;
  status: string;
  propertyId?: number;
}

// Timeshare API types
export interface ConfirmWeekRequest {
  extraNights?: number;
  paymentIntentId?: string;
}

export interface CreateSwapRequest {
  requester_week_id: number | string; // Can be number or "booking_X"
  desired_start_date?: string;
  desired_property_id?: number;
}

export interface AcceptSwapRequest {
  responderWeekId: number;
}

export interface UseCreditsRequest {
  propertyId: number;
  checkIn: string;
  checkOut: string;
  roomType: string;
  idempotencyKey?: string;
}

// Hotel Guest API types
export interface RequestServiceRequest {
  bookingToken: string;
  serviceType: string;
  description: string;
  urgency: 'low' | 'medium' | 'high';
  amount?: number;
  currency?: string;
}

// Payment API types
export interface CreatePaymentIntentRequest {
  amount: number;
  currency: string;
  type: 'swap_fee' | 'hotel_payment' | 'service_fee' | 'night_credit_extra';
  metadata?: Record<string, any>;
}

// Night Credit Request API types
export interface CreateNightCreditRequestDto {
  creditId: number;
  propertyId: number;
  checkIn: string;
  checkOut: string;
  nightsRequested: number;
  additionalNights?: number;
  roomType?: string;
}

export interface NightCreditRequestDetail {
  id: number;
  owner_id: number;
  property_id: number;
  check_in: string;
  check_out: string;
  nights_requested: number;
  additional_nights: number;
  total_amount: number;
  additional_price: number;
  status: string;
  Property?: any;
  NightCredit?: any;
}

export interface PaymentIntentResponse {
  paymentIntentId: string;
  clientSecret: string;
  amount: number;
  currency: string;
}

export interface StaffRequestDetail {
  request: NightCreditRequestDetail;
  availability: AvailabilityCheck;
}

export interface AvailabilityCheck {
  available: boolean;
  conflicts?: Array<{
    type: 'booking' | 'week' | 'swap';
    id: number;
    dates: {
      start: string;
      end: string;
    };
  }>;
}

// Dashboard API types
export interface DashboardResponse {
  user: User;
  stats: DashboardStats;
  recentActivity: Array<{
    type: string;
    description: string;
    timestamp: string;
  }>;
}

export interface OwnerDashboardStats {
  totalWeeks: number;
  availableWeeks: number;
  activeSwaps: number;
  upcomingBookings: number;
}

export interface OwnerCreditsInfo {
  total: number;
  available: number;
  expiringSoon: number;
}

export interface OwnerDashboardResponse {
  stats: OwnerDashboardStats;
  credits: OwnerCreditsInfo | null;
  recentActivity: {
    weeks: any[];
    swaps: any[];
  };
}
