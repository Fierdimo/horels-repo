// User types
export interface User {
  id: number;
  email: string;
  role: 'owner' | 'guest' | 'staff' | 'admin';
  status?: 'pending' | 'approved' | 'rejected';
  property_id?: number | null;
  property?: Property | null;
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  created_at: string;
}

// Property types
export interface Property {
  id: number;
  name: string;
  location: string;
  city?: string;
  country?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

// Week types
export interface Week {
  id: number | string;
  owner_id: number;
  property_id: number;
  start_date: string;
  end_date: string;
  accommodation_type: string; // e.g., 'sencilla', 'duplex', 'suite'
  status: 'available' | 'confirmed' | 'converted' | 'used' | 'checked_out';
  source?: 'timeshare' | 'booking';
  nights?: number;
  valid_until?: string;
  Property?: Property;
}

// Swap types
export interface SwapRequest {
  id?: number;
  requester_id?: number;
  requester_week_id?: number;
  responder_week_id?: number;
  responder_id?: number;
  accommodation_type?: string;
  status?: 'pending' | 'matched' | 'awaiting_payment' | 'completed' | 'cancelled';
  staff_approval_status?: 'pending_review' | 'approved' | 'rejected';
  responder_acceptance?: 'pending' | 'accepted' | 'rejected';
  swap_fee?: number;
  payment_intent_id?: string;
  payment_status?: 'pending' | 'succeeded' | 'failed';
  staff_notes?: string;
  staff_review_date?: string;
  reviewed_by_staff_id?: number;
  created_at?: string;
  RequesterWeek?: Week;
  ResponderWeek?: Week;
  RequesterBookings?: Booking[];
  responder_source_type?: 'week' | 'booking';
  responder_source_id?: number;
  Requester?: User;
  Responder?: User;
}

// Night Credit types
export interface NightCredit {
  id: number;
  user_id: number;
  week_id: number;
  nights_available: number;
  nights_used: number;
  expires_at: string;
  created_at: string;
}

// Night Credit Request types
export interface NightCreditRequest {
  id: number;
  owner_id: number;
  credit_id: number;
  property_id: number;
  check_in: string;
  check_out: string;
  nights_requested: number;
  additional_nights: number;
  room_type?: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid' | 'completed' | 'cancelled';
  total_amount: number;
  additional_price: number;
  additional_commission: number;
  stripe_payment_intent_id?: string;
  staff_notes?: string;
  rejection_reason?: string;
  approved_by?: number;
  approved_at?: string;
  booking_id?: number;
  created_at: string;
  updated_at: string;
  Property?: Property;
  User?: User;
  NightCredit?: NightCredit;
  Booking?: Booking;
}

// Booking types
export interface Booking {
  id: number;
  property_id: number;
  user_id?: number;
  guest_token?: string;
  check_in: string;
  check_out: string;
  room_type?: string;
  status: string;
  guest_name?: string;
  guest_email?: string;
  Property?: Property;
}

// Hotel Service types
export interface HotelService {
  id: number;
  booking_id: number;
  service_type: string;
  description?: string;
  status: 'requested' | 'confirmed' | 'completed' | 'cancelled';
  price?: number;
  requested_at: string;
}

// Payment types
export interface PaymentIntent {
  paymentIntentId: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: string;
}

// Dashboard stats
export interface DashboardStats {
  totalWeeks?: number;
  availableWeeks?: number;
  activeSwaps?: number;
  nightCredits?: number;
  upcomingBookings?: number;
  pendingServices?: number;
}

// API Response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
