import apiClient from './client';

export interface PrepaidAllocation {
  id: number;
  property_id: number;
  pms_resource_id: string;
  pms_provider: 'mews' | 'cloudbeds' | 'opera' | 'resnexus' | 'other';
  room_number?: string;
  room_type: string;
  floor_number?: string;
  valid_from: string;
  valid_until: string;
  allocation_type: 'ANNUAL_CONTRACT' | 'PERPETUAL' | 'SEASONAL';
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'SUSPENDED';
  is_released: boolean;
  current_week_owner_id?: number;
  prepaid_amount?: number;
  condominium_fee?: number;
  currency?: string;
  notes?: string;
  contract_reference?: string;
  last_sync_at?: string;
  property?: {
    id: number;
    name: string;
  };
  currentOwner?: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface AllocationStats {
  total: number;
  active: number;
  expired: number;
  suspended: number;
  expiring_soon: number;
  assigned: number;
  available: number;
  total_prepaid_amount: number;
  by_property: Array<{
    property_id: number;
    property_name: string;
    count: number;
    active: number;
    prepaid_amount: number;
  }>;
}

export interface CreateAllocationInput {
  property_id: number;
  pms_resource_id: string;
  pms_provider?: string;
  room_number?: string;
  room_type: string;
  floor_number?: string;
  valid_from: string;
  valid_until: string;
  allocation_type: string;
  prepaid_amount?: number;
  condominium_fee?: number;
  currency?: string;
  notes?: string;
  contract_reference?: string;
}

export interface BulkImportInput {
  property_id: number;
  resource_ids: string[];
  config: {
    valid_from: string;
    valid_until: string;
    allocation_type: string;
    prepaid_amount?: number;
    currency?: string;
  };
}

export const prepaidInventoryApi = {
  // List allocations
  list: async (params?: any) => {
    const { data } = await apiClient.get('/admin/prepaid-inventory', { params });
    return data;
  },

  // Get single allocation
  get: async (id: number) => {
    const { data } = await apiClient.get(`/admin/prepaid-inventory/${id}`);
    return data;
  },

  // Create allocation
  create: async (input: CreateAllocationInput) => {
    const { data } = await apiClient.post('/admin/prepaid-inventory', input);
    return data;
  },

  // Update allocation
  update: async (id: number, input: Partial<CreateAllocationInput>) => {
    const { data } = await apiClient.put(`/admin/prepaid-inventory/${id}`, input);
    return data;
  },

  // Delete allocation
  delete: async (id: number) => {
    const { data } = await apiClient.delete(`/admin/prepaid-inventory/${id}`);
    return data;
  },

  // Get statistics
  getStats: async (propertyId?: string) => {
    const { data } = await apiClient.get('/admin/prepaid-inventory/stats', {
      params: propertyId ? { property_id: propertyId } : {},
    });
    return data;
  },

  // Bulk import from PMS
  bulkImport: async (input: BulkImportInput) => {
    const { data } = await apiClient.post('/admin/prepaid-inventory/bulk-import', input);
    return data;
  },

  // Sync with PMS
  syncWithPMS: async (id: number) => {
    const { data } = await apiClient.post(`/admin/prepaid-inventory/${id}/sync`);
    return data;
  },
};
