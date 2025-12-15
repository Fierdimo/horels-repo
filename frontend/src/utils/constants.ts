// Use relative URLs in development to leverage Vite proxy, absolute in production
export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/hotels';
export const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
export const ENV = import.meta.env.VITE_ENV || 'development';
export const ENABLE_WEBVIEW_BRIDGE = import.meta.env.VITE_ENABLE_WEBVIEW_BRIDGE === 'true';
export const ENABLE_EXPO_NOTIFICATIONS = import.meta.env.VITE_ENABLE_EXPO_NOTIFICATIONS === 'true';

// Week colors configuration
export const WEEK_COLORS = {
  red: { label: 'Red', nights: 6, color: '#EF4444' },
  blue: { label: 'Blue', nights: 5, color: '#3B82F6' },
  white: { label: 'White', nights: 4, color: '#6B7280' }
} as const;

export type WeekColor = keyof typeof WEEK_COLORS;

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
