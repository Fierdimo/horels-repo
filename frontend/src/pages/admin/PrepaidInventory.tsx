import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Filter, Download, TrendingUp } from 'lucide-react';
import { prepaidInventoryApi, PrepaidAllocation } from '@/api/prepaidInventory';
import { AllocationTable } from '@/components/admin/prepaid/AllocationTable';
import { AllocationForm } from '@/components/admin/prepaid/AllocationForm';
import { AllocationStats } from '@/components/admin/prepaid/AllocationStats';
import { BulkImportModal } from '@/components/admin/prepaid/BulkImportModal';
import toast from 'react-hot-toast';

export default function PrepaidInventoryPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [selectedAllocation, setSelectedAllocation] = useState<PrepaidAllocation | null>(null);
  const [filters, setFilters] = useState({
    property_id: '',
    status: '',
    room_type: '',
    is_released: '',
    page: 1,
    limit: 20,
  });

  const queryClient = useQueryClient();

  // Fetch allocations
  const { data: allocationsData, isLoading } = useQuery({
    queryKey: ['prepaid-allocations', filters],
    queryFn: () => prepaidInventoryApi.list(filters),
  });

  // Fetch statistics
  const { data: statsData } = useQuery({
    queryKey: ['prepaid-stats', filters.property_id],
    queryFn: () => prepaidInventoryApi.getStats(filters.property_id),
  });

  // Create allocation mutation
  const createMutation = useMutation({
    mutationFn: prepaidInventoryApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prepaid-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['prepaid-stats'] });
      toast.success('Allocation created successfully');
      setIsCreateModalOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create allocation');
    },
  });

  // Update allocation mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      prepaidInventoryApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prepaid-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['prepaid-stats'] });
      toast.success('Allocation updated successfully');
      setSelectedAllocation(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update allocation');
    },
  });

  // Delete allocation mutation
  const deleteMutation = useMutation({
    mutationFn: prepaidInventoryApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prepaid-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['prepaid-stats'] });
      toast.success('Allocation deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete allocation');
    },
  });

  const handleEdit = (allocation: PrepaidAllocation) => {
    setSelectedAllocation(allocation);
    setIsCreateModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this allocation?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleSubmit = (data: any) => {
    if (selectedAllocation) {
      updateMutation.mutate({ id: selectedAllocation.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-green-600" />
                Prepaid Inventory Management
              </h1>
              <p className="text-gray-600 mt-1">
                Manage hotel rooms with 100% margin (zero marginal cost)
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setIsBulkImportOpen(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Bulk Import
              </button>
              <button
                onClick={() => {
                  setSelectedAllocation(null);
                  setIsCreateModalOpen(true);
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Allocation
              </button>
            </div>
          </div>
        </div>

        {/* Statistics */}
        {statsData && <AllocationStats stats={statsData.data} />}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-5 w-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Filters</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="EXPIRED">Expired</option>
            </select>

            <select
              value={filters.room_type}
              onChange={(e) => setFilters({ ...filters, room_type: e.target.value, page: 1 })}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="">All Room Types</option>
              <option value="standard">Standard</option>
              <option value="deluxe">Deluxe</option>
              <option value="suite">Suite</option>
              <option value="studio">Studio</option>
            </select>

            <select
              value={filters.is_released}
              onChange={(e) => setFilters({ ...filters, is_released: e.target.value, page: 1 })}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="">All Availability</option>
              <option value="false">Available</option>
              <option value="true">Released</option>
            </select>

            <button
              onClick={() => setFilters({
                property_id: '',
                status: '',
                room_type: '',
                is_released: '',
                page: 1,
                limit: 20,
              })}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Allocations Table */}
        <div className="bg-white rounded-lg shadow-sm">
          <AllocationTable
            allocations={allocationsData?.data.allocations || []}
            pagination={allocationsData?.data.pagination}
            isLoading={isLoading}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onPageChange={(page) => setFilters({ ...filters, page })}
          />
        </div>
      </div>

      {/* Create/Edit Modal */}
      {isCreateModalOpen && (
        <AllocationForm
          allocation={selectedAllocation}
          onSubmit={handleSubmit}
          onClose={() => {
            setIsCreateModalOpen(false);
            setSelectedAllocation(null);
          }}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* Bulk Import Modal */}
      {isBulkImportOpen && (
        <BulkImportModal
          onClose={() => setIsBulkImportOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['prepaid-allocations'] });
            queryClient.invalidateQueries({ queryKey: ['prepaid-stats'] });
          }}
        />
      )}
    </div>
  );
}
