import apiClient from './client';

// ==================== TYPES ====================

export interface UnifiedSearchFilters {
  location?: string;
  propertyId?: number;
  checkIn: string;
  checkOut: string;
  guests?: number;
  roomType?: string;
  minPrice?: number;
  maxPrice?: number;
  showAllOptions?: boolean;
}

export interface UnifiedSearchResult {
  id: string;
  source: 'TIMESHARE_PREPAID' | 'TIMESHARE_RELEASED' | 'HOTEL_PMS';
  priority: number;
  
  // Basic info
  propertyId: number;
  propertyName: string;
  location: string;
  roomType: string;
  roomNumber?: string;
  
  // Dates
  checkIn: string;
  checkOut: string;
  nights: number;
  
  // Pricing
  creditPrice?: number;
  cashPrice?: number;
  currency: string;
  
  // Availability
  isAvailable: boolean;
  
  // Internal metadata
  _internal: {
    source: string;
    priority: number;
    marginPercent: number;
    costToPlattform: number;
    allocationId?: number;
    inventoryItemId?: number;
    pmsResourceId?: string;
  };
}

export interface UnifiedSearchResponse {
  success: boolean;
  data: {
    results: UnifiedSearchResult[];
    total: number;
    filters: {
      location?: string;
      propertyId?: number;
      checkIn: string;
      checkOut: string;
      guests?: number;
      roomType?: string;
    };
    analytics: {
      byPriority: {
        prepaid: number;
        released: number;
        pms: number;
      };
      avgMargin: number;
      potentialRevenue: number;
    };
  };
}

// ==================== API METHODS ====================

/**
 * Search available rooms with prepaid prioritization
 */
export const unifiedSearch = async (
  filters: UnifiedSearchFilters
): Promise<UnifiedSearchResponse> => {
  const { data } = await apiClient.post('/api/unified-search', filters);
  return data;
};

/**
 * Get search statistics
 */
export const getSearchStats = async () => {
  const { data } = await apiClient.get('/api/unified-search/stats');
  return data;
};

/**
 * Get priority label for display
 */
export const getPriorityLabel = (priority: number): string => {
  switch (priority) {
    case 1:
      return 'Premium (Prepagado)';
    case 2:
      return 'Inventario Liberado';
    case 3:
      return 'Hotel Estándar';
    default:
      return 'Desconocido';
  }
};

/**
 * Get priority badge color
 */
export const getPriorityColor = (priority: number): string => {
  switch (priority) {
    case 1:
      return 'bg-gradient-to-r from-purple-500 to-pink-500 text-white';
    case 2:
      return 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white';
    case 3:
      return 'bg-gray-500 text-white';
    default:
      return 'bg-gray-400 text-white';
  }
};

/**
 * Get margin badge
 */
export const getMarginBadge = (marginPercent: number): {
  label: string;
  color: string;
} => {
  if (marginPercent === 100) {
    return {
      label: '100% Margen',
      color: 'bg-green-500 text-white',
    };
  } else if (marginPercent >= 70) {
    return {
      label: `${marginPercent}% Margen`,
      color: 'bg-blue-500 text-white',
    };
  } else {
    return {
      label: `${marginPercent}% Margen`,
      color: 'bg-gray-500 text-white',
    };
  }
};
