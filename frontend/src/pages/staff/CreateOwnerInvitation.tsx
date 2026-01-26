import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, Link2, Calendar, User, Copy, Check, X, Plus, Building } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import apiClient from '@/api/client';

interface Room {
  id: number;
  name: string; // PMS room name/number
  type: string; // PMS room type
  status: string;
  propertyId: number;
  pmsResourceId: string;
  isMarketplaceEnabled: boolean;
  customPrice?: number;
  price: number;
}

interface RoomData {
  room_id: number;
  start_date: string;
  end_date: string;
  room_type: 'STANDARD' | 'SUPERIOR' | 'DELUXE' | 'SUITE' | 'PRESIDENTIAL';
  estimated_credits?: number;
  season_type?: 'RED' | 'WHITE' | 'BLUE';
}

interface Invitation {
  id: number;
  token: string;
  email: string;
  property_id: number;
  rooms_data?: RoomData[] | string;
  rooms_count: number;
  expires_at: string;
  invitation_link: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  first_name?: string;
  last_name?: string;
}

export default function CreateOwnerInvitation() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [rooms, setRooms] = useState<RoomData[]>([
    { room_id: 0, start_date: '', end_date: '', room_type: 'STANDARD' },
  ]);
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [createdInvitation, setCreatedInvitation] = useState<Invitation | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Fetch available rooms from staff's property
  const { data: roomsData } = useQuery({
    queryKey: ['staffRooms'],
    queryFn: async () => {
      const { data } = await apiClient.get('/hotel-staff/rooms');
      return data;
    },
  });

  const availableRooms: Room[] = roomsData?.data || [];

  // Create invitation mutation
  const createMutation = useMutation({
    mutationFn: async (data: {
      email: string;
      first_name?: string;
      last_name?: string;
      rooms_data: RoomData[];
      expires_in_days: number;
    }) => {
      const response = await apiClient.post('/staff/invitations/create-owner-invitation', data);
      return response.data;
    },
    onSuccess: (data) => {
      const invitation = data.data.invitation;
      setCreatedInvitation(invitation);
      toast.success(t('staff.invitations.createdSuccessfully'));
      queryClient.invalidateQueries({ queryKey: ['staffInvitations'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || t('staff.invitations.createError'));
    },
  });

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async (invitationId: number) => {
      const response = await apiClient.post(`/staff/invitations/${invitationId}/send-email`);
      return response.data;
    },
    onSuccess: () => {
      toast.success(t('staff.invitations.emailSent'));
      if (createdInvitation) {
        setCreatedInvitation({ ...createdInvitation, status: 'pending' });
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || t('staff.invitations.emailError'));
    },
  });

  // Cancel invitation mutation
  const cancelMutation = useMutation({
    mutationFn: async (invitationId: number) => {
      const response = await apiClient.delete(`/staff/invitations/cancel-invitation/${invitationId}`);
      return response.data;
    },
    onSuccess: () => {
      toast.success(t('staff.invitations.cancelled'));
      navigate('/staff/invitations');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || t('staff.invitations.cancelError'));
    },
  });

  // Get pending invitations
  const { data: pendingInvitationsData } = useQuery({
    queryKey: ['staffInvitations', 'pending'],
    queryFn: async () => {
      const response = await apiClient.get('/staff/invitations/my-invitations?status=pending');
      return response.data;
    },
  });

  const pendingInvitations = pendingInvitationsData?.data?.invitations || [];

  const addRoom = () => {
    setRooms([...rooms, { room_id: 0, start_date: '', end_date: '', room_type: 'STANDARD' }]);
  };

  const removeRoom = (index: number) => {
    if (rooms.length > 1) {
      setRooms(rooms.filter((_, i) => i !== index));
    }
  };

  const updateRoom = (index: number, field: keyof RoomData, value: any) => {
    const newRooms = [...rooms];
    newRooms[index] = { ...newRooms[index], [field]: value };
    
    // If room_id changed, update room_type from selected room
    if (field === 'room_id') {
      const selectedRoom = availableRooms.find(r => r.id === value);
      if (selectedRoom) {
        // Map PMS type to room_type enum (try to match, default to STANDARD)
        const pmsType = selectedRoom.type.toUpperCase();
        let mappedType: 'STANDARD' | 'SUPERIOR' | 'DELUXE' | 'SUITE' | 'PRESIDENTIAL' = 'STANDARD';
        
        if (pmsType.includes('PRESIDENTIAL')) mappedType = 'PRESIDENTIAL';
        else if (pmsType.includes('SUITE')) mappedType = 'SUITE';
        else if (pmsType.includes('DELUXE')) mappedType = 'DELUXE';
        else if (pmsType.includes('SUPERIOR')) mappedType = 'SUPERIOR';
        
        newRooms[index].room_type = mappedType;
      }
    }
    
    setRooms(newRooms);
    
    // Re-estimate credits when relevant fields change
    if (['room_id', 'start_date', 'end_date'].includes(field as string)) {
      estimateCreditsForRoom(index, newRooms[index]);
    }
  };

  // Calculate total nights and credits
  const calculateNightsAndCredits = () => {
    let totalNights = 0;
    let totalCredits = 0;
    rooms.forEach(room => {
      if (room.start_date && room.end_date) {
        const start = new Date(room.start_date);
        const end = new Date(room.end_date);
        const nights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        if (nights > 0) {
          totalNights += nights;
          totalCredits += room.estimated_credits || nights;
        }
      }
    });
    return { totalNights, totalCredits };
  };

  const { totalNights, totalCredits } = calculateNightsAndCredits();

  // Calculate estimated credits for a room when room or dates change
  const estimateCreditsForRoom = async (index: number, roomData: RoomData) => {
    if (!roomData.room_id || !roomData.start_date || !roomData.end_date) {
      return;
    }

    try {
      // Get room details to find property_id
      const room = availableRooms.find(r => r.id === roomData.room_id);
      if (!room) return;

      // Calculate nights
      const start = new Date(roomData.start_date);
      const end = new Date(roomData.end_date);
      const nights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      if (nights <= 0) return;

      // Get season for the date range from backend
      const seasonResponse = await apiClient.get(`/hotel-staff/seasonal-calendar/${room.propertyId}/season`, {
        params: { date: roomData.start_date }
      });

      const seasonType = seasonResponse.data.data?.season || 'WHITE';

      // Calculate DEPOSIT credits using Master Formula (not booking cost!)
      const response = await apiClient.post('/hotel-staff/estimate-credits', {
        propertyId: room.propertyId,
        seasonType: seasonType,
        roomType: roomData.room_type
      });

      console.log('💡 Credit estimation response:', {
        propertyId: room.propertyId,
        seasonType,
        roomType: roomData.room_type,
        nights,
        estimatedCredits: response.data.data?.estimatedCredits,
        breakdown: response.data.data?.breakdown
      });

      if (response.data.success) {
        setRooms(prevRooms => {
          const newRooms = [...prevRooms];
          newRooms[index].estimated_credits = response.data.data.estimatedCredits;
          newRooms[index].season_type = seasonType;
          return newRooms;
        });
      }
    } catch (error) {
      console.error('Error estimating credits:', error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || rooms.some(r => !r.room_id || !r.start_date || !r.end_date)) {
      toast.error(t('admin.assignPeriod.fillAllFields'));
      return;
    }

    // Validate room_type is set
    if (rooms.some(r => !r.room_type)) {
      toast.error(t('staff.invitations.allRoomsMustHaveType'));
      return;
    }

    const payload = {
      email,
      first_name: firstName || undefined,
      last_name: lastName || undefined,
      rooms_data: rooms,
      expires_in_days: expiresInDays,
    };

    console.log('Creating invitation with payload:', payload);

    createMutation.mutate(payload);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLink(true);
      toast.success(t('staff.invitations.linkCopied'));
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      toast.error(t('staff.invitations.copyError'));
    }
  };

  const handleCopyLink = () => {
    if (createdInvitation?.invitation_link) {
      copyToClipboard(createdInvitation.invitation_link);
    }
  };

  // Helper to get rooms data safely
  const getRoomsData = (invitation: Invitation | null): RoomData[] => {
    if (!invitation) return [];
    const roomsData = (invitation as any).rooms_data;
    if (Array.isArray(roomsData)) return roomsData;
    if (typeof roomsData === 'string') {
      try {
        return JSON.parse(roomsData);
      } catch (e) {
        console.error('Error parsing rooms_data:', e);
        return [];
      }
    }
    return [];
  };

  // Show success screen after creation
  if (createdInvitation) {
    const invitationRooms = getRoomsData(createdInvitation);
    
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Success Header */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="flex-shrink-0 w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {t('staff.invitations.invitationCreated')}
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  {t('staff.invitations.invitationCreatedDescription')}
                </p>
              </div>
            </div>
          </div>

          {/* Invitation Details */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              {t('staff.invitations.invitationDetails')}
            </h2>

            {/* User Info */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center space-x-2">
                <Mail className="h-5 w-5 text-gray-400" />
                <span className="text-gray-600 dark:text-gray-400">{t('common.email')}:</span>
                <span className="font-medium text-gray-900 dark:text-white">{createdInvitation.email || ''}</span>
              </div>
              {((createdInvitation as any).first_name || (createdInvitation as any).last_name) && (
                <div className="flex items-center space-x-2">
                  <User className="h-5 w-5 text-gray-400" />
                  <span className="text-gray-600 dark:text-gray-400">{t('common.name')}:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {String((createdInvitation as any).first_name || '')} {String((createdInvitation as any).last_name || '')}
                  </span>
                </div>
              )}
            </div>

            {/* Room Cards */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                {t('staff.invitations.assignedRooms')} ({invitationRooms.length})
              </h3>
              <div className="space-y-3">
                {invitationRooms.map((room, index) => {
                  const selectedRoom = availableRooms.find(r => r.id === room.room_id);
                  return (
                    <div key={index} className="border border-gray-300 dark:border-gray-600 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {selectedRoom?.name || `Room ${room.room_id}`} - {room.room_type}
                            </span>
                            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 text-xs rounded-full">
                              #{room.room_id}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                            <Calendar className="h-4 w-4" />
                            <span>
                              {new Date(room.start_date).toLocaleDateString()} - {new Date(room.end_date).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Invitation Link */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('staff.invitations.invitationLink')}
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={createdInvitation.invitation_link || ''}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center space-x-2"
                >
                  {copiedLink ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                  <span>{copiedLink ? t('common.copied') : t('common.copy')}</span>
                </button>
              </div>
            </div>

            {/* QR Code */}
            {createdInvitation.invitation_link && (
              <div className="flex justify-center py-4">
                <div className="bg-white p-4 rounded-lg">
                  <QRCodeSVG
                    value={createdInvitation.invitation_link}
                    size={200}
                    level="H"
                    includeMargin={true}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => sendEmailMutation.mutate(createdInvitation.id)}
                disabled={sendEmailMutation.isPending}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {sendEmailMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                    <span>{t('common.sending')}</span>
                  </>
                ) : (
                  <>
                    <Mail className="h-5 w-5" />
                    <span>{t('staff.invitations.sendEmail')}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (window.confirm(t('staff.invitations.confirmCancel'))) {
                    cancelMutation.mutate(createdInvitation.id);
                  }
                }}
                disabled={cancelMutation.isPending}
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {cancelMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                    <span>{t('common.cancelling')}</span>
                  </>
                ) : (
                  <>
                    <X className="h-5 w-5" />
                    <span>{t('staff.invitations.cancel')}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => navigate('/staff/invitations')}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center space-x-2"
              >
                <span>{t('staff.invitations.backToList')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('staff.invitations.createInvitation')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('staff.invitations.createDescription')}
          </p>
        </div>
        <button
          onClick={() => navigate('/staff/invitations')}
          className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          {t('staff.invitations.createInvitation')}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Owner Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>{t('staff.invitations.ownerInformation')}</span>
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('common.email')} *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="owner@example.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('auth.firstName')}
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('auth.lastName')}
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Rooms */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                <Building className="h-5 w-5" />
                <span>{t('staff.invitations.assignedRooms')}</span>
              </h3>
              <button
                type="button"
                onClick={addRoom}
                className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-1 text-sm"
              >
                <Plus className="h-4 w-4" />
                <span>{t('staff.invitations.addRoom')}</span>
              </button>
            </div>

            {rooms.map((room, index) => {
              // Calculate nights for this room
              const calculateNights = () => {
                if (room.start_date && room.end_date) {
                  const start = new Date(room.start_date);
                  const end = new Date(room.end_date);
                  const nights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                  return nights > 0 ? nights : 0;
                }
                return 0;
              };
              const roomNights = calculateNights();
              
              // Get room details
              const selectedRoom = availableRooms.find(r => r.id === room.room_id);

              return (
              <div key={index} className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {t('staff.invitations.room')} {index + 1}
                    </span>
                    {selectedRoom && (
                      <span className="px-2 py-1 bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 text-xs rounded-full">
                        {selectedRoom.name} - {selectedRoom.type}
                      </span>
                    )}
                    {roomNights > 0 && (
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded-full">
                        {roomNights} {roomNights === 1 ? t('common.nights').replace('s', '') : t('common.nights')} 
                        {room.estimated_credits ? ` ≈ ${Math.round(room.estimated_credits)} ${t('staff.invitations.credits')}` : ` = ${roomNights} ${t('staff.invitations.credits')}`}
                      </span>
                    )}
                  </div>
                  {rooms.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRoom(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
                
                {/* Room Selector */}
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    {t('staff.invitations.selectRoom')} *
                  </label>
                  <select
                    value={room.room_id || ''}
                    onChange={(e) => updateRoom(index, 'room_id', Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="">{t('staff.invitations.chooseRoom')}</option>
                    {availableRooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} - {r.type} ({r.status})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                      {t('admin.assignPeriod.startDate')}
                    </label>
                    <input
                      type="date"
                      value={room.start_date}
                      onChange={(e) => updateRoom(index, 'start_date', e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                      {t('admin.assignPeriod.endDate')}
                    </label>
                    <input
                      type="date"
                      value={room.end_date}
                      onChange={(e) => updateRoom(index, 'end_date', e.target.value)}
                      min={room.start_date}
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                </div>
                
                {room.season_type && (
                  <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                    {t('staff.invitations.seasonDetected')}: <span className={`font-semibold ${
                      room.season_type === 'RED' ? 'text-red-600' : 
                      room.season_type === 'BLUE' ? 'text-blue-600' : 
                      'text-gray-600'
                    }`}>{room.season_type}</span>
                  </div>
                )}
              </div>
            );
            })}
          </div>

          {/* Credits Summary */}
          {totalCredits > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100">
                    {t('staff.invitations.creditsSummary')}
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    {t('staff.invitations.creditsDescription')}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {totalCredits}
                  </div>
                  <div className="text-sm text-blue-600 dark:text-blue-400">
                    {t('staff.invitations.nightCredits')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Expiration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('staff.invitations.expirationDays')}
            </label>
            <input
              type="number"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Number(e.target.value))}
              min={1}
              max={365}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {t('staff.invitations.expirationHint')}
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {createMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                <span>{t('common.creating')}</span>
              </>
            ) : (
              <>
                <Link2 className="h-5 w-5" />
                <span>{t('staff.invitations.createInvitation')}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
