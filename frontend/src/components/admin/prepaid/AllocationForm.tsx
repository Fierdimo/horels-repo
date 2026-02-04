import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { PrepaidAllocation } from '@/api/prepaidInventory';
import { propertiesApi } from '@/api/properties';
import apiClient from '@/api/client';

interface Room {
  id: number;
  name: string;
  type?: string;
  floor?: string;
  pmsResourceId?: string;
}

interface AllocationFormProps {
  allocation: PrepaidAllocation | null;
  onSubmit: (data: any) => void;
  onClose: () => void;
  isSubmitting: boolean;
}

export function AllocationForm({ allocation, onSubmit, onClose, isSubmitting }: AllocationFormProps) {
  const [formData, setFormData] = useState({
    property_id: allocation?.property_id || '',
    pms_resource_id: allocation?.pms_resource_id || '',
    pms_provider: allocation?.pms_provider || 'other',
    room_number: allocation?.room_number || '',
    room_type: allocation?.room_type || 'standard',
    floor_number: allocation?.floor_number || '',
    valid_from: allocation?.valid_from?.split('T')[0] || '',
    valid_until: allocation?.valid_until?.split('T')[0] || '',
    allocation_type: allocation?.allocation_type || 'ANNUAL_CONTRACT',
    prepaid_amount: allocation?.prepaid_amount || '',
    condominium_fee: allocation?.condominium_fee || '',
    currency: allocation?.currency || 'EUR',
    notes: allocation?.notes || '',
    contract_reference: allocation?.contract_reference || '',
  });

  const [selectedRoom, setSelectedRoom] = useState<string>('');

  // Fetch properties
  const { data: propertiesData } = useQuery({
    queryKey: ['properties'],
    queryFn: propertiesApi.getAll,
  });

  // Debug: Log properties data
  useEffect(() => {
    console.log('Properties Data:', propertiesData);
    console.log('Properties Array:', propertiesData?.properties);
  }, [propertiesData]);

  // Fetch rooms for selected property
  const { data: roomsData, isLoading: roomsLoading } = useQuery({
    queryKey: ['rooms', formData.property_id],
    queryFn: async () => {
      if (!formData.property_id) return { data: [] };
      const response = await apiClient.get(`/admin/rooms?propertyId=${formData.property_id}`);
      console.log('Rooms API Response:', response.data);
      return response.data;
    },
    enabled: !!formData.property_id,
  });

  // Debug: Log rooms data
  useEffect(() => {
    if (formData.property_id) {
      console.log('Rooms Data:', roomsData);
      console.log('Rooms Loading:', roomsLoading);
    }
  }, [roomsData, roomsLoading, formData.property_id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePropertyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setFormData((prev) => ({
      ...prev,
      property_id: value,
      // Reset room-related fields when property changes
      pms_resource_id: '',
      room_number: '',
      room_type: 'standard',
      floor_number: '',
    }));
    setSelectedRoom('');
  };

  const handleRoomSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const roomId = e.target.value;
    setSelectedRoom(roomId);
    
    if (roomId && roomsData) {
      // Handle both array and single object responses
      const rooms = Array.isArray(roomsData) ? roomsData : roomsData.data || [];
      const room = rooms.find((r: any) => r.id.toString() === roomId);
      
      console.log('Selected room:', room);
      
      if (room) {
        setFormData((prev) => ({
          ...prev,
          pms_resource_id: room.pmsResourceId || '',
          room_number: room.name || '',
          room_type: room.type || 'standard',
          floor_number: '', // No floor data in current schema
        }));
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {allocation ? 'Edit Allocation' : 'Create New Allocation'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Property Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Property / Hotel *
            </label>
            <select
              name="property_id"
              value={formData.property_id}
              onChange={handlePropertyChange}
              required
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="">Select a property / hotel</option>
              {propertiesData?.properties && Array.isArray(propertiesData.properties) && propertiesData.properties.map((property: any, index: number) => (
                <option key={property.id || index} value={property.id || index}>
                  {property.name} {property.city && property.country ? `- ${property.city}, ${property.country}` : property.location ? `- ${property.location}` : ''}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Select the hotel where this prepaid inventory is located
            </p>
          </div>

          {/* Room Selection */}
          {formData.property_id && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Room (Optional - Auto-fills fields below)
              </label>
              <select
                value={selectedRoom}
                onChange={handleRoomSelect}
                disabled={roomsLoading}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
              >
                <option value="">Select a room or enter manually below</option>
                {roomsData && Array.isArray(roomsData) && roomsData.map((room: any) => (
                  <option key={room.id} value={room.id}>
                    {room.name} {room.type ? `(${room.type})` : ''}
                  </option>
                ))}
                {roomsData && !Array.isArray(roomsData) && roomsData.data && Array.isArray(roomsData.data) && roomsData.data.map((room: any) => (
                  <option key={room.id} value={room.id}>
                    {room.name} {room.type ? `(${room.type})` : ''}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {roomsLoading ? 'Loading rooms...' : `${Array.isArray(roomsData) ? roomsData.length : roomsData?.data?.length || 0} room(s) available`}
              </p>
            </div>
          )}

          {/* PMS Configuration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              PMS Resource ID *
            </label>
            <input
              type="text"
              name="pms_resource_id"
              value={formData.pms_resource_id}
              onChange={handleChange}
              required
              readOnly={!!selectedRoom}
              placeholder="room_001"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 read-only:bg-gray-50"
            />
            {selectedRoom && <p className="mt-1 text-xs text-gray-500">Auto-filled from selected room</p>}
          </div>

          {/* Room Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Room Number
              </label>
              <input
                type="text"
                name="room_number"
                value={formData.room_number}
                onChange={handleChange}
                readOnly={!!selectedRoom}
                placeholder="305"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 read-only:bg-gray-50"
              />
              {selectedRoom && <p className="mt-1 text-xs text-gray-500">Auto-filled</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Room Type *
              </label>
              <select
                name="room_type"
                value={formData.room_type}
                onChange={handleChange}
                required
                disabled={!!selectedRoom}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 disabled:bg-gray-50"
              >
                <option value="standard">Standard</option>
                <option value="deluxe">Deluxe</option>
                <option value="suite">Suite</option>
                <option value="studio">Studio</option>
              </select>
              {selectedRoom && <p className="mt-1 text-xs text-gray-500">Auto-filled</p>}
            </div>
          </div>

          {/* Validity Period */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valid From *
              </label>
              <input
                type="date"
                name="valid_from"
                value={formData.valid_from}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valid Until *
              </label>
              <input
                type="date"
                name="valid_until"
                value={formData.valid_until}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Allocation Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Allocation Type *
            </label>
            <select
              name="allocation_type"
              value={formData.allocation_type}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="ANNUAL_CONTRACT">Annual Contract</option>
              <option value="PERPETUAL">Perpetual</option>
              <option value="SEASONAL">Seasonal</option>
            </select>
          </div>

          {/* Financial Details */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prepaid Amount
              </label>
              <input
                type="number"
                name="prepaid_amount"
                value={formData.prepaid_amount}
                onChange={handleChange}
                placeholder="6000"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Condominium Fee
              </label>
              <input
                type="number"
                name="condominium_fee"
                value={formData.condominium_fee}
                onChange={handleChange}
                placeholder="500"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Currency
              </label>
              <select
                name="currency"
                value={formData.currency}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
          </div>

          {/* Additional Information */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contract Reference
            </label>
            <input
              type="text"
              name="contract_reference"
              value={formData.contract_reference}
              onChange={handleChange}
              placeholder="CONTRACT-2026-001"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Additional notes about this allocation..."
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                allocation ? 'Update Allocation' : 'Create Allocation'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
