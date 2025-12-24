import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Bed, Plus, Edit, Trash2, Search, Filter, X, RefreshCw } from 'lucide-react';
import apiClient from '@/api/client';
import toast from 'react-hot-toast';

export default function StaffRooms() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [floorFilter, setFloorFilter] = useState<string>('all');
  const [capacityFilter, setCapacityFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [hasAutoSynced, setHasAutoSynced] = useState(false);

  // Fetch rooms
  const { data: roomsData, isLoading } = useQuery({
    queryKey: ['staff-rooms'],
    queryFn: async () => {
      const { data } = await apiClient.get('/hotel-staff/rooms');
      return data;
    }
  });

  // Sync rooms from PMS mutation
  const syncRoomsMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/hotel-staff/rooms/sync');
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['staff-rooms'] });
      if (!hasAutoSynced) {
        // No mostrar toast en sincronización automática
        setHasAutoSynced(true);
      } else {
        // Mostrar toast en sincronización manual
        toast.success(
          `${t('staff.rooms.syncSuccess')}: ${data.data.created} ${t('staff.rooms.created')}, ${data.data.updated} ${t('staff.rooms.updated')}`
        );
      }
    },
    onError: (error: any) => {
      if (hasAutoSynced) {
        // Solo mostrar error en sincronización manual
        const errorMsg = error?.response?.data?.error || error.message;
        toast.error(`${t('staff.rooms.syncError')}: ${errorMsg}`);
      }
    }
  });

  // Auto-sync on component mount
  useEffect(() => {
    if (!hasAutoSynced && roomsData) {
      // Solo sincronizar si no hay habitaciones o si han pasado más de 5 minutos
      const rooms = roomsData?.data?.rooms || [];
      if (rooms.length === 0) {
        syncRoomsMutation.mutate();
      }
    }
  }, [roomsData, hasAutoSynced]);

  // Create room mutation
  const createRoomMutation = useMutation({
    mutationFn: async (roomData: any) => {
      const { data } = await apiClient.post('/hotel-staff/rooms', roomData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-rooms'] });
      toast.success(t('staff.rooms.createSuccess'));
      setShowCreateModal(false);
    },
    onError: (error: any) => {
      // Check if it's a duplicate name error
      if (error?.response?.data?.error?.includes('name must be unique') || 
          error?.response?.data?.error?.includes('Duplicate entry')) {
        toast.error(t('staff.rooms.duplicateError'));
      } else {
        toast.error(t('staff.rooms.createError'));
      }
    }
  });

  // Update room mutation
  const updateRoomMutation = useMutation({
    mutationFn: async ({ id, roomData }: { id: number; roomData: any }) => {
      const { data } = await apiClient.put(`/hotel-staff/rooms/${id}`, roomData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-rooms'] });
      toast.success(t('staff.rooms.updateSuccess'));
      setShowEditModal(false);
      setSelectedRoom(null);
    },
    onError: (error: any) => {
      // Check if it's a duplicate name error
      if (error?.response?.data?.error?.includes('name must be unique') || 
          error?.response?.data?.error?.includes('Duplicate entry')) {
        toast.error(t('staff.rooms.duplicateError'));
      } else {
        toast.error(t('staff.rooms.updateError'));
      }
    }
  });

  // Delete room mutation
  const deleteRoomMutation = useMutation({
    mutationFn: async (roomId: number) => {
      const { data } = await apiClient.delete(`/hotel-staff/rooms/${roomId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-rooms'] });
      toast.success(t('staff.rooms.deleteSuccess'));
    },
    onError: () => {
      toast.error(t('staff.rooms.deleteError'));
    }
  });

  // Toggle marketplace mutation
  const toggleMarketplaceMutation = useMutation({
    mutationFn: async ({ roomId, enabled }: { roomId: number; enabled: boolean }) => {
      const { data } = await apiClient.patch(`/hotel-staff/rooms/${roomId}/marketplace`, {
        enabled: enabled
      });
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['staff-rooms'] });
      // Invalidar también las queries del marketplace para que se actualice inmediatamente
      queryClient.invalidateQueries({ queryKey: ['marketplace-properties'] });
      queryClient.invalidateQueries({ queryKey: ['property-rooms'] });
      const message = variables.enabled 
        ? t('staff.rooms.marketplaceEnabled') 
        : t('staff.rooms.marketplaceDisabled');
      toast.success(message);
    },
    onError: () => {
      toast.error(t('staff.rooms.marketplaceToggleError'));
    }
  });

  // Enable all rooms in marketplace mutation
  const enableAllMarketplaceMutation = useMutation({
    mutationFn: async () => {
      // Get all room IDs that are not already enabled
      const roomsToEnable = rooms.filter((room: any) => !room.isMarketplaceEnabled);
      
      // Enable all rooms in parallel
      await Promise.all(
        roomsToEnable.map((room: any) =>
          apiClient.patch(`/hotel-staff/rooms/${room.id}/marketplace`, {
            enabled: true
          })
        )
      );
      
      return { count: roomsToEnable.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['staff-rooms'] });
      // Invalidar también las queries del marketplace para que se actualice inmediatamente
      queryClient.invalidateQueries({ queryKey: ['marketplace-properties'] });
      queryClient.invalidateQueries({ queryKey: ['property-rooms'] });
      toast.success(t('staff.rooms.allMarketplaceEnabled', { count: data.count }));
    },
    onError: () => {
      toast.error(t('staff.rooms.marketplaceToggleError'));
    }
  });

  const rooms = Array.isArray(roomsData?.data) ? roomsData.data : [];

  // Get unique values for filters
  const uniqueTypes = Array.from(new Set(rooms.map((r: any) => r.type).filter(Boolean)));
  const uniqueFloors = Array.from(new Set(rooms.map((r: any) => r.floor).filter(Boolean))).sort();
  const uniqueCapacities = Array.from(new Set(rooms.map((r: any) => r.capacity).filter(Boolean))).sort((a: any, b: any) => a - b);

  // Filter rooms
  const filteredRooms = rooms.filter((room: any) => {
    const matchesSearch =
      (room.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (room.type || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (room.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (room.floor || '').toString().includes(searchQuery);

    const matchesStatus =
      statusFilter === 'all' ||
      (room.status || '').toLowerCase() === statusFilter.toLowerCase();

    const matchesType =
      typeFilter === 'all' ||
      (room.type || '').toLowerCase() === typeFilter.toLowerCase();

    const matchesFloor =
      floorFilter === 'all' ||
      (room.floor || '').toString() === floorFilter;

    const matchesCapacity =
      capacityFilter === 'all' ||
      room.capacity === parseInt(capacityFilter);

    return matchesSearch && matchesStatus && matchesType && matchesFloor && matchesCapacity;
  });

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      available: 'bg-green-100 text-green-800',
      disponible: 'bg-green-100 text-green-800',
      occupied: 'bg-blue-100 text-blue-800',
      ocupada: 'bg-blue-100 text-blue-800',
      maintenance: 'bg-yellow-100 text-yellow-800',
      mantenimiento: 'bg-yellow-100 text-yellow-800',
      unavailable: 'bg-red-100 text-red-800',
    };

    const normalizedStatus = (status || '').toLowerCase();
    const translationKey = `admin.rooms.statuses.${normalizedStatus}`;

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[normalizedStatus] || 'bg-gray-100 text-gray-800'}`}>
        {t(translationKey, { defaultValue: status })}
      </span>
    );
  };

  const handleCreateRoom = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const roomData = {
      name: formData.get('name'),
      type: formData.get('type'),
      capacity: Number(formData.get('capacity')),
      floor: formData.get('floor'),
      basePrice: Number(formData.get('basePrice')),
      status: formData.get('status'),
      description: formData.get('description'),
    };
    createRoomMutation.mutate(roomData);
  };

  const handleEditRoom = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const roomData = {
      name: formData.get('name'),
      type: formData.get('type'),
      capacity: Number(formData.get('capacity')),
      floor: formData.get('floor'),
      basePrice: Number(formData.get('basePrice')),
      status: formData.get('status'),
      description: formData.get('description'),
    };
    updateRoomMutation.mutate({ id: selectedRoom.id, roomData });
  };

  const handleDeleteRoom = (roomId: number) => {
    if (window.confirm(t('staff.rooms.confirmDelete'))) {
      deleteRoomMutation.mutate(roomId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('staff.rooms.title')}</h1>
          <p className="text-gray-600 mt-1">{t('staff.rooms.subtitle')}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => enableAllMarketplaceMutation.mutate()}
            disabled={enableAllMarketplaceMutation.isPending || rooms.every((r: any) => r.isMarketplaceEnabled)}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>{enableAllMarketplaceMutation.isPending ? t('common.processing') : t('staff.rooms.enableAllMarketplace')}</span>
          </button>
          <button
            onClick={() => syncRoomsMutation.mutate()}
            disabled={syncRoomsMutation.isPending}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-5 w-5 ${syncRoomsMutation.isPending ? 'animate-spin' : ''}`} />
            <span>{syncRoomsMutation.isPending ? t('staff.rooms.syncing') : t('staff.rooms.syncFromPMS')}</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>{t('staff.rooms.createRoom')}</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-700 flex items-center">
            <Filter className="h-4 w-4 mr-2" />
            {t('common.filter')}
          </h3>
          {(statusFilter !== 'all' || typeFilter !== 'all' || floorFilter !== 'all' || capacityFilter !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setStatusFilter('all');
                setTypeFilter('all');
                setFloorFilter('all');
                setCapacityFilter('all');
                setSearchQuery('');
              }}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
            >
              <X className="h-4 w-4 mr-1" />
              {t('admin.rooms.clearFilters')}
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder={t('common.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
            >
              <option value="all">{t('common.allStatuses')}</option>
              <option value="available">{t('admin.rooms.statuses.available')}</option>
              <option value="occupied">{t('admin.rooms.statuses.occupied')}</option>
              <option value="maintenance">{t('admin.rooms.statuses.maintenance')}</option>
              <option value="unavailable">{t('admin.rooms.statuses.unavailable')}</option>
            </select>
          </div>

          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
            >
              <option value="all">{t('admin.rooms.type')} - {t('common.allStatuses')}</option>
              {uniqueTypes.map((type: any) => (
                <option key={type} value={type.toLowerCase()}>
                  {t(`admin.rooms.types.${type.toLowerCase()}`, { defaultValue: type })}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <select
              value={floorFilter}
              onChange={(e) => setFloorFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
            >
              <option value="all">{t('admin.rooms.floor')} - {t('common.allStatuses')}</option>
              {uniqueFloors.map((floor: any) => (
                <option key={floor} value={floor}>
                  {t('admin.rooms.floor')} {floor}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <select
              value={capacityFilter}
              onChange={(e) => setCapacityFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
            >
              <option value="all">{t('admin.rooms.capacity')} - {t('common.allStatuses')}</option>
              {uniqueCapacities.map((capacity: any) => (
                <option key={capacity} value={capacity}>
                  {capacity} {t('admin.rooms.guests')}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Results count */}
        <div className="mt-4 text-sm text-gray-600">
          {t('common.total')}: <span className="font-semibold">{filteredRooms.length}</span> / {rooms.length} {t('nav.rooms').toLowerCase()}
        </div>
      </div>

      {/* Rooms Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-20 bg-gray-200 rounded"></div>
              <div className="h-20 bg-gray-200 rounded"></div>
              <div className="h-20 bg-gray-200 rounded"></div>
            </div>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Bed className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-gray-900">{t('staff.rooms.noRooms')}</h3>
            <p className="text-sm text-gray-500 mt-1">{t('staff.rooms.createFirst')}</p>
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
                    {t('common.status')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reservas Activas
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Marketplace
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRooms.map((room: any) => (
                  <tr key={room.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{room.name}</div>
                      {room.description && (
                        <div className="text-sm text-gray-500">{room.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {t(`admin.rooms.types.${room.type?.toLowerCase()}`, { defaultValue: room.type })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {room.capacity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {room.floor || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${room.basePrice || room.base_price || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(room.status)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {room.bookings && room.bookings.length > 0 ? (
                        <div className="space-y-2 max-w-xs">
                          {room.bookings.map((booking: any, idx: number) => (
                            <div key={idx} className="p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                              <div className="font-medium text-blue-900">{booking.guest_name}</div>
                              <div className="text-blue-700 text-xs">
                                {new Date(booking.check_in).toLocaleDateString()} - {new Date(booking.check_out).toLocaleDateString()}
                              </div>
                              <div className="text-blue-600 text-xs">{booking.guest_email}</div>
                              <div className="mt-1">
                                <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                  booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                                  booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-blue-100 text-blue-800'
                                }`}>
                                  {booking.status.toUpperCase()}
                                </span>
                              </div>
                              <div className="text-blue-600 font-semibold text-xs mt-1">€{booking.total_amount}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-500 text-sm">Sin reservas</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => toggleMarketplaceMutation.mutate({
                          roomId: room.id,
                          enabled: !room.isMarketplaceEnabled
                        })}
                        disabled={toggleMarketplaceMutation.isPending}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          room.isMarketplaceEnabled ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            room.isMarketplaceEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setSelectedRoom(room);
                            setShowEditModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-900"
                          title={t('common.edit')}
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteRoom(room.id)}
                          className="text-red-600 hover:text-red-900"
                          title={t('common.delete')}
                        >
                          <Trash2 className="h-5 w-5" />
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

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">{t('common.total')}</div>
          <div className="text-2xl font-bold text-gray-900">{rooms.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">{t('admin.rooms.statuses.available')}</div>
          <div className="text-2xl font-bold text-green-600">
            {rooms.filter((r: any) => r.status === 'available' || r.status === 'disponible').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">{t('admin.rooms.statuses.occupied')}</div>
          <div className="text-2xl font-bold text-blue-600">
            {rooms.filter((r: any) => r.status === 'occupied' || r.status === 'ocupada').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">{t('admin.rooms.statuses.maintenance')}</div>
          <div className="text-2xl font-bold text-yellow-600">
            {rooms.filter((r: any) => r.status === 'maintenance' || r.status === 'mantenimiento').length}
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">{t('staff.rooms.createRoom')}</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleCreateRoom} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.rooms.roomName')}</label>
                <input type="text" name="name" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.rooms.type')}</label>
                  <select name="type" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                    <option value="standard">{t('admin.rooms.types.standard')}</option>
                    <option value="deluxe">{t('admin.rooms.types.deluxe')}</option>
                    <option value="suite">{t('admin.rooms.types.suite')}</option>
                    <option value="single">{t('admin.rooms.types.single')}</option>
                    <option value="double">{t('admin.rooms.types.double')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.rooms.capacity')}</label>
                  <input type="number" name="capacity" required min="1" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.rooms.floor')}</label>
                  <input type="text" name="floor" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.rooms.price')}</label>
                  <input type="number" name="basePrice" required min="0" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.status')}</label>
                <select name="status" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="available">{t('admin.rooms.statuses.available')}</option>
                  <option value="maintenance">{t('admin.rooms.statuses.maintenance')}</option>
                  <option value="unavailable">{t('admin.rooms.statuses.unavailable')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.description')}</label>
                <textarea name="description" rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"></textarea>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={createRoomMutation.isPending} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {createRoomMutation.isPending ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedRoom && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">{t('admin.rooms.editRoom')}</h2>
              <button onClick={() => { setShowEditModal(false); setSelectedRoom(null); }} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleEditRoom} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.rooms.roomName')}</label>
                <input type="text" name="name" defaultValue={selectedRoom.name} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.rooms.type')}</label>
                  <select name="type" defaultValue={selectedRoom.type?.toLowerCase()} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                    <option value="standard">{t('admin.rooms.types.standard')}</option>
                    <option value="deluxe">{t('admin.rooms.types.deluxe')}</option>
                    <option value="suite">{t('admin.rooms.types.suite')}</option>
                    <option value="single">{t('admin.rooms.types.single')}</option>
                    <option value="double">{t('admin.rooms.types.double')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.rooms.capacity')}</label>
                  <input type="number" name="capacity" defaultValue={selectedRoom.capacity} required min="1" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.rooms.floor')}</label>
                  <input type="text" name="floor" defaultValue={selectedRoom.floor} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.rooms.price')}</label>
                  <input type="number" name="basePrice" defaultValue={selectedRoom.basePrice || selectedRoom.base_price} required min="0" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.status')}</label>
                <select name="status" defaultValue={selectedRoom.status?.toLowerCase()} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="available">{t('admin.rooms.statuses.available')}</option>
                  <option value="occupied">{t('admin.rooms.statuses.occupied')}</option>
                  <option value="maintenance">{t('admin.rooms.statuses.maintenance')}</option>
                  <option value="unavailable">{t('admin.rooms.statuses.unavailable')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.description')}</label>
                <textarea name="description" defaultValue={selectedRoom.description} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"></textarea>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => { setShowEditModal(false); setSelectedRoom(null); }} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={updateRoomMutation.isPending} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {updateRoomMutation.isPending ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
