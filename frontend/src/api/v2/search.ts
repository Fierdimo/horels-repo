/**
 * V2 Search API
 * 
 * Unified search across timeshare + hotel inventory
 * Uses /api/v2/search endpoint
 */

import apiClient from '../client';

// ==================== TYPES ====================

export interface SearchFilters {
  location?: string;
  propertyId?: number;
  checkIn: string; // ISO date (YYYY-MM-DD)
  checkOut: string; // ISO date (YYYY-MM-DD)
  guests: number;
  includeTimeshare?: boolean; // Default: true
  includeHotels?: boolean; // Default: true
  minCredits?: number;
  maxCredits?: number;
  page?: number; // Default: 1
  limit?: number; // Default: 20, Max: 100
  sortBy?: 'credits' | 'date' | 'relevance'; // Default: 'credits'
}

export interface SearchResult {
  // Unique ID (prefixed with source)
  id: string; // Format: "ts_123" or "hotel_456"
  source: 'TIMESHARE' | 'HOTEL_PMS';

  // Property information
  property: {
    id: number;
    name: string;
    location: string; // "City, Region, Country"
    images: string[];
    rating?: number;
  };

  // Unit/Room information
  unit: {
    category: string;
    capacity: number;
    bedrooms?: number;
    amenities: string[];
  };

  // Dates
  dates: {
    checkIn: string; // ISO date
    checkOut: string; // ISO date
    nights: number;
  };

  // Pricing
  price: {
    credits: number; // Credit cost
    cash?: number; // Cash equivalent (for hotels)
    currency: string;
  };

  // Availability
  availability: {
    available: boolean;
    quantity: number; // How many available
  };

  // Metadata
  meta?: {
    weekAllocationId?: number; // If timeshare
    inventoryId?: number; // If hotel
  };
}

export interface SearchResponse {
  success: boolean;
  data: {
    results: SearchResult[];
    meta: {
      totalResults: number;
      timeshareResults: number;
      hotelResults: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
}

export interface AvailabilityCheckResponse {
  success: boolean;
  data: {
    propertyId: number;
    startDate: string;
    endDate: string;
    availability: Array<{
      date: string;
      available: boolean;
      credits: number;
      source: 'TIMESHARE' | 'HOTEL_PMS';
    }>;
  };
}

// ==================== API METHODS ====================

/**
 * Search unified inventory
 * 
 * @param filters - Search criteria
 * @returns Search results
 */
export const search = async (
  filters: SearchFilters
): Promise<SearchResponse> => {
  const { data } = await apiClient.post('/api/v2/search', filters);
  return data;
};

/**
 * Check availability for specific property
 * 
 * @param propertyId - Property ID
 * @param startDate - ISO date
 * @param endDate - ISO date
 * @param guests - Number of guests
 * @returns Availability calendar
 */
export const checkAvailability = async (
  propertyId: number,
  startDate: string,
  endDate: string,
  guests: number = 2
): Promise<AvailabilityCheckResponse> => {
  const { data } = await apiClient.get(
    `/api/v2/search/availability/${propertyId}`,
    {
      params: { startDate, endDate, guests },
    }
  );
  return data;
};

// ==================== UTILITY FUNCTIONS ====================

/**
 * Get source label for display
 */
export const getSourceLabel = (source: 'TIMESHARE' | 'HOTEL_PMS'): string => {
  return source === 'TIMESHARE' ? 'Timeshare' : 'Hotel';
};

/**
 * Get source badge color
 */
export const getSourceColor = (source: 'TIMESHARE' | 'HOTEL_PMS'): string => {
  return source === 'TIMESHARE'
    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
    : 'bg-gradient-to-r from-gray-500 to-gray-600 text-white';
};

/**
 * Calculate nights between two dates
 */
export const calculateNights = (checkIn: string, checkOut: string): number => {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diff = end.getTime() - start.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

/**
 * Format date for display
 */
export const formatDate = (isoDate: string): string => {
  const date = new Date(isoDate);
  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

/**
 * Format price
 */
export const formatPrice = (credits: number, cash?: number, currency?: string): string => {
  if (cash && currency) {
    return `${cash} ${currency} (${credits} créditos)`;
  }
  return `${credits} créditos`;
};

/**
 * Get result unique key for React lists
 */
export const getResultKey = (result: SearchResult): string => {
  return result.id;
};
