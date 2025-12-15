import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Building2, Edit, Trash2, Eye, Filter, X } from 'lucide-react';
import apiClient from '@/api/client';
import toast from 'react-hot-toast';

interface Room {
  id: number;
  name: string;
  propertyId: number;
  type: string;
  capacity: number;
  floor?: string;
  basePrice?: number;
  status: string;
  amenities?: string[];
  description?: string;
  Property?: {
    id: number;
    name: string;
    location: string;
  };
}

interface Property {
  id: number;
  name: string;
  location: string;
}

export default function Rooms() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProperty, setSelectedProperty] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Fetch rooms
  const { data: roomsData, isLoading } = useQuery<Room[] | { data: Room[] }>({
    queryKey: ['admin-rooms'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/rooms');
      return data;
    },
  });

  // Normalize rooms data to always be an array
  const rooms = Array.isArray(roomsData) 
    ? roomsData 
    : Array.isArray(roomsData?.data) 
    ? roomsData.data 
    : [];

  // Fetch properties for filter
  const { data: propertiesData } = useQuery<Property[] | { data: Property[] }>({
    queryKey: ['properties'],
    queryFn: async () => {
      const { data } = await apiClient.get('/properties');
      return data;
    },
  });

  // Normalize properties data to always be an array
  const properties = Array.isArray(propertiesData) 
    ? propertiesData 
    : Array.isArray(propertiesData?.data) 
    ? propertiesData.data 
    : [];

  // Delete room mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/admin/rooms/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-rooms'] });
      toast.success(t('admin.rooms.roomDeleted'));
    },
    onError: () => {
      toast.error(t('admin.rooms.failedToDelete'));
    },
  });

  // Update room mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Room> }) => {
      await apiClient.put(`/admin/rooms/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-rooms'] });
      setShowEditModal(false);
      setSelectedRoom(null);
      toast.success(t('admin.rooms.roomUpdated'));
    },
    onError: () => {
      toast.error(t('admin.rooms.failedToUpdate'));
    },
  });

  // Filter rooms
  const filteredRooms = rooms.filter((room) => {
    const matchesSearch =
      (room.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (room.type || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (room.Property?.name || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesProperty =
      selectedProperty === 'all' || room.propertyId === Number(selectedProperty);

    const matchesStatus = 
      selectedStatus === 'all' || 
      (room.status || '').toLowerCase() === selectedStatus.toLowerCase();

    return matchesSearch && matchesProperty && matchesStatus;
  });

  const handleDelete = (id: number, name: string) => {
    if (confirm(t('admin.rooms.confirmDelete', { name }))) {
      deleteMutation.mutate(id);
    }
  };

  const handleViewDetails = (room: Room) => {
    setSelectedRoom(room);
    setShowDetailsModal(true);
  };

  const handleEdit = (room: Room) => {
    setSelectedRoom(room);
    setShowEditModal(true);
  };

  const handleSaveEdit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedRoom) return;

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      type: formData.get('type') as string,
      capacity: Number(formData.get('capacity')),
      floor: formData.get('floor') as string,
      basePrice: Number(formData.get('basePrice')),
      status: formData.get('status') as string,
      description: formData.get('description') as string,
    };

    updateMutation.mutate({ id: selectedRoom.id, data });
  };

  const getStatusBadge = (status: string) => {
    if (!status) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          -
        </span>
      );
    }

    const statusColors: Record<string, string> = {
      available: 'bg-green-100 text-green-800',
      disponible: 'bg-green-100 text-green-800',
      active: 'bg-green-100 text-green-800',
      activa: 'bg-green-100 text-green-800',
      occupied: 'bg-blue-100 text-blue-800',
      ocupada: 'bg-blue-100 text-blue-800',
      maintenance: 'bg-yellow-100 text-yellow-800',
      mantenimiento: 'bg-yellow-100 text-yellow-800',
      unavailable: 'bg-red-100 text-red-800',
      no_disponible: 'bg-red-100 text-red-800',
      inactive: 'bg-red-100 text-red-800',
      inactiva: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-green-100 text-green-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };

    const normalizedStatus = status.toLowerCase();
    const translationKey = `admin.rooms.statuses.${normalizedStatus}`;
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[normalizedStatus] || 'bg-gray-100 text-gray-800'}`}>
        {t(translationKey, { defaultValue: status })}
      </span>
    );
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedProperty('all');
    setSelectedStatus('all');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.rooms.title')}</h1>
          <p className="text-gray-600 mt-1">{t('admin.rooms.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Filter className="h-4 w-4" />
          {t('common.filter')}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder={t('admin.rooms.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('admin.rooms.filterByHotel')}
              </label>
              <select
                value={selectedProperty}
                onChange={(e) => setSelectedProperty(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">{t('admin.rooms.allHotels')}</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('admin.rooms.filterByStatus')}
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">{t('admin.rooms.allStatuses')}</option>
                <option value="available">{t('admin.rooms.statuses.available')}</option>
                <option value="occupied">{t('admin.rooms.statuses.occupied')}</option>
                <option value="maintenance">{t('admin.rooms.statuses.maintenance')}</option>
                <option value="unavailable">{t('admin.rooms.statuses.unavailable')}</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <X className="h-4 w-4" />
                {t('admin.rooms.clearFilters')}
              </button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-gray-600 pt-4 border-t">
          <span>
            {t('admin.rooms.totalRooms')}: <strong>{filteredRooms.length}</strong>
          </span>
          <span>•</span>
          <span>
            {t('admin.rooms.totalHotels')}: <strong>{properties.length}</strong>
          </span>
        </div>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-gray-400">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('admin.rooms.totalRooms')}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {filteredRooms.length}
              </p>
            </div>
            <Building2 className="h-8 w-8 text-gray-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('admin.rooms.statuses.available')}</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {filteredRooms.filter(r => ['available', 'disponible', 'active', 'activa'].includes(r.status?.toLowerCase())).length}
              </p>
            </div>
            <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-600 font-bold">✓</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('admin.rooms.statuses.occupied')}</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {filteredRooms.filter(r => ['occupied', 'ocupada'].includes(r.status?.toLowerCase())).length}
              </p>
            </div>
            <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-bold">●</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('admin.rooms.statuses.maintenance')}</p>
              <p className="text-2xl font-bold text-yellow-600 mt-1">
                {filteredRooms.filter(r => ['maintenance', 'mantenimiento'].includes(r.status?.toLowerCase())).length}
              </p>
            </div>
            <div className="h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center">
              <span className="text-yellow-600 font-bold">⚠</span>
            </div>
          </div>
        </div>
      </div>

      {/* Rooms Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('admin.rooms.noRooms')}</h3>
            <p className="text-gray-600">{t('admin.rooms.noRoomsDesc')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('admin.rooms.roomName')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('admin.rooms.hotel')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('admin.rooms.type')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('admin.rooms.capacity')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('admin.rooms.floor')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('admin.rooms.price')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('admin.rooms.status')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('admin.rooms.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRooms.map((room) => (
                  <tr key={room.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{room.name}</div>
                          {room.description && (
                            <div className="text-sm text-gray-500">{room.description.substring(0, 50)}...</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{room.Property?.name}</div>
                      <div className="text-sm text-gray-500">{room.Property?.location}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {room.type ? t(`admin.rooms.types.${room.type.toLowerCase()}`, room.type) : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {room.capacity} {t('admin.rooms.guests')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{room.floor || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {room.basePrice ? `$${room.basePrice}` : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(room.status)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleViewDetails(room)}
                          title={t('admin.rooms.viewDetails')}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(room)}
                          title={t('common.edit')}
                          className="text-yellow-600 hover:text-yellow-900"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(room.id, room.name)}
                          title={t('common.delete')}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>{t('common.note')}:</strong> {t('admin.rooms.staffNote')}
        </p>
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedRoom && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDetailsModal(false)}>
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">{t('admin.rooms.roomDetails')}</h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">{t('admin.rooms.roomName')}</label>
                  <p className="mt-1 text-base text-gray-900">{selectedRoom.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">{t('admin.rooms.hotel')}</label>
                  <p className="mt-1 text-base text-gray-900">{selectedRoom.Property?.name}</p>
                  <p className="text-sm text-gray-500">{selectedRoom.Property?.location}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">{t('admin.rooms.type')}</label>
                  <p className="mt-1 text-base text-gray-900">
                    {selectedRoom.type ? t(`admin.rooms.types.${selectedRoom.type.toLowerCase()}`, selectedRoom.type) : '-'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">{t('admin.rooms.status')}</label>
                  <p className="mt-1">{getStatusBadge(selectedRoom.status)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">{t('admin.rooms.capacity')}</label>
                  <p className="mt-1 text-base text-gray-900">{selectedRoom.capacity} {t('admin.rooms.guests')}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">{t('admin.rooms.floor')}</label>
                  <p className="mt-1 text-base text-gray-900">{selectedRoom.floor || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">{t('admin.rooms.price')}</label>
                  <p className="mt-1 text-base text-gray-900">
                    {selectedRoom.basePrice ? `$${selectedRoom.basePrice}` : '-'}
                  </p>
                </div>
              </div>

              {/* Description */}
              {selectedRoom.description && (
                <div>
                  <label className="text-sm font-medium text-gray-500">{t('common.description')}</label>
                  <p className="mt-1 text-base text-gray-900">{selectedRoom.description}</p>
                </div>
              )}

              {/* Amenities */}
              {(() => {
                const amenitiesList: string[] = Array.isArray(selectedRoom.amenities)
                  ? selectedRoom.amenities
                  : typeof selectedRoom.amenities === 'string' && selectedRoom.amenities
                  ? (selectedRoom.amenities as string).split(',').map((a: string) => a.trim()).filter(Boolean)
                  : [];
                
                return amenitiesList.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">{t('admin.rooms.amenities')}</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {amenitiesList.map((amenity: string, idx: number) => (
                        <span key={idx} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                          {amenity}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t">
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  handleEdit(selectedRoom);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {t('common.edit')}
              </button>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedRoom && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowEditModal(false)}>
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">{t('admin.rooms.editRoom')}</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('admin.rooms.roomName')} *
                  </label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={selectedRoom.name}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('admin.rooms.type')} *
                  </label>
                  <select
                    name="type"
                    defaultValue={selectedRoom.type?.toLowerCase()}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="standard">{t('admin.rooms.types.standard')}</option>
                    <option value="deluxe">{t('admin.rooms.types.deluxe')}</option>
                    <option value="suite">{t('admin.rooms.types.suite')}</option>
                    <option value="single">{t('admin.rooms.types.single')}</option>
                    <option value="double">{t('admin.rooms.types.double')}</option>
                    <option value="triple">{t('admin.rooms.types.triple')}</option>
                    <option value="presidential">{t('admin.rooms.types.presidential')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('admin.rooms.capacity')} *
                  </label>
                  <input
                    type="number"
                    name="capacity"
                    defaultValue={selectedRoom.capacity}
                    min="1"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('admin.rooms.floor')}
                  </label>
                  <input
                    type="text"
                    name="floor"
                    defaultValue={selectedRoom.floor || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('admin.rooms.price')}
                  </label>
                  <input
                    type="number"
                    name="basePrice"
                    defaultValue={selectedRoom.basePrice || ''}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('admin.rooms.status')} *
                  </label>
                  <select
                    name="status"
                    defaultValue={selectedRoom.status?.toLowerCase()}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="available">{t('admin.rooms.statuses.available')}</option>
                    <option value="occupied">{t('admin.rooms.statuses.occupied')}</option>
                    <option value="maintenance">{t('admin.rooms.statuses.maintenance')}</option>
                    <option value="unavailable">{t('admin.rooms.statuses.unavailable')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('common.description')}
                </label>
                <textarea
                  name="description"
                  defaultValue={selectedRoom.description || ''}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <strong>{t('common.note')}:</strong> {t('admin.rooms.editNote')}
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {updateMutation.isPending ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
