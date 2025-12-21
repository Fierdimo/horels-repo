// Use relative URLs in development to leverage Vite proxy, absolute in production
export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/hotels';
export const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
export const ENV = import.meta.env.VITE_ENV || 'development';
export const ENABLE_WEBVIEW_BRIDGE = import.meta.env.VITE_ENABLE_WEBVIEW_BRIDGE === 'true';
export const ENABLE_EXPO_NOTIFICATIONS = import.meta.env.VITE_ENABLE_EXPO_NOTIFICATIONS === 'true';

// Accommodation types configuration (displayed colors for UI only)
export const ACCOMMODATION_TYPES = {
  standard: { label: 'Standard', emoji: '🛏️', color: '#EF4444' },  // Red for visual distinction
  deluxe: { label: 'Deluxe', emoji: '🏠', color: '#3B82F6' },      // Blue for visual distinction
  suite: { label: 'Suite', emoji: '👑', color: '#10B981' },        // Green for visual distinction
  single: { label: 'Single', emoji: '🛏️', color: '#8B5CF6' },      // Purple for visual distinction
  double: { label: 'Double', emoji: '🛏️🛏️', color: '#EC4899' }    // Pink for visual distinction
} as const;

export type AccommodationType = keyof typeof ACCOMMODATION_TYPES;

// Week statuses
export const WEEK_STATUS = {
  available: 'available',
  confirmed: 'confirmed',
  converted: 'converted',
  used: 'used'
} as const;

export type WeekStatus = keyof typeof WEEK_STATUS;

// Swap statuses
export const SWAP_STATUS = {
  pending: 'pending',
  matched: 'matched',
  completed: 'completed',
  cancelled: 'cancelled'
} as const;

export type SwapStatus = keyof typeof SWAP_STATUS;

// Swap fee
export const SWAP_FEE = 10; // €10

// Credit expiry period (months)
export const CREDIT_EXPIRY_MONTHS = 18;

// Guest access expiry (days after checkout)
export const GUEST_ACCESS_DAYS = 30;
