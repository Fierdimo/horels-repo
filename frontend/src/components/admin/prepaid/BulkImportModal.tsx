import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, Upload, AlertCircle } from 'lucide-react';
import { prepaidInventoryApi } from '@/api/prepaidInventory';
import { propertiesApi } from '@/api/properties';
import toast from 'react-hot-toast';

interface BulkImportModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkImportModal({ onClose, onSuccess }: BulkImportModalProps) {
  const [formData, setFormData] = useState({
    property_id: '',
    resource_ids: '',
    valid_from: '',
    valid_until: '',
    allocation_type: 'ANNUAL_CONTRACT',
    prepaid_amount: '',
    currency: 'EUR',
  });

  const { data: propertiesData } = useQuery({
    queryKey: ['properties'],
    queryFn: propertiesApi.getAll,
  });

  const bulkImportMutation = useMutation({
    mutationFn: prepaidInventoryApi.bulkImport,
    onSuccess: (data) => {
      toast.success(
        `Bulk import completed: ${data.data.created} created, ${data.data.updated} updated`
      );
      if (data.data.errors.length > 0) {
        toast.error(`${data.data.errors.length} errors occurred`);
      }
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Bulk import failed');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Parse resource IDs (comma or newline separated)
    const resourceIds = formData.resource_ids
      .split(/[\n,]+/)
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    if (resourceIds.length === 0) {
      toast.error('Please enter at least one resource ID');
      return;
    }

    bulkImportMutation.mutate({
      property_id: parseInt(formData.property_id),
      resource_ids: resourceIds,
      config: {
        valid_from: formData.valid_from,
        valid_until: formData.valid_until,
        allocation_type: formData.allocation_type,
        prepaid_amount: formData.prepaid_amount ? parseFloat(formData.prepaid_amount) : undefined,
        currency: formData.currency,
      },
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">Bulk Import from PMS</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">How Bulk Import Works:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li>Enter PMS resource IDs (comma or newline separated)</li>
                <li>System will fetch room details from PMS</li>
                <li>Existing allocations will be updated, new ones created</li>
                <li>Validation errors will be reported at the end</li>
              </ul>
            </div>
          </div>

          {/* Property Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Property / Hotel *
            </label>
            <select
              value={formData.property_id}
              onChange={(e) => setFormData({ ...formData, property_id: e.target.value })}
              required
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a property / hotel</option>
              {propertiesData?.data?.map((property: any) => (
                <option key={property.id} value={property.id}>
                  {property.name} {property.city && property.country ? `- ${property.city}, ${property.country}` : property.location ? `- ${property.location}` : ''}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Select the hotel where these rooms are located
            </p>
          </div>

          {/* Resource IDs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              PMS Resource IDs * (one per line or comma-separated)
            </label>
            <textarea
              value={formData.resource_ids}
              onChange={(e) => setFormData({ ...formData, resource_ids: e.target.value })}
              required
              rows={6}
              placeholder="room_001
room_002
room_003"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              {formData.resource_ids.split(/[\n,]+/).filter((id) => id.trim().length > 0).length} resource(s)
            </p>
          </div>

          {/* Validity Period */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valid From *
              </label>
              <input
                type="date"
                value={formData.valid_from}
                onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                required
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valid Until *
              </label>
              <input
                type="date"
                value={formData.valid_until}
                onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                required
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Allocation Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Allocation Type *
            </label>
            <select
              value={formData.allocation_type}
              onChange={(e) => setFormData({ ...formData, allocation_type: e.target.value })}
              required
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="ANNUAL_CONTRACT">Annual Contract</option>
              <option value="PERPETUAL">Perpetual</option>
              <option value="SEASONAL">Seasonal</option>
            </select>
          </div>

          {/* Financial Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prepaid Amount (optional)
              </label>
              <input
                type="number"
                value={formData.prepaid_amount}
                onChange={(e) => setFormData({ ...formData, prepaid_amount: e.target.value })}
                placeholder="6000"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Currency
              </label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={bulkImportMutation.isPending}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={bulkImportMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {bulkImportMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Import from PMS
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
