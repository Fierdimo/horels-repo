import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, Link2, Calendar, User, Copy, Check, X, Plus, Building } from 'lucide-react';
import { toast } from 'react-hot-toast';
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
  rooms_count: number;
  expires_at: string;
  invitation_link: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
}

export default function CreateOwnerInvitation() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

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
      toast.success(t('staff.invitations.created'));
      
      // Show warning if email wasn't sent
      if (!invitation.email_sent) {
        toast.error('⚠️ Invitation created but email could not be sent. Please copy the link manually.', {
          duration: 6000,
        });
      }
      
      setCreatedInvitation(invitation);
      queryClient.invalidateQueries({ queryKey: ['staffInvitations'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || t('staff.invitations.createError'));
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

  // Cancel invitation mutation
  const cancelMutation = useMutation({
    mutationFn: async (invitationId: number) => {
      const response = await apiClient.delete(`/staff/invitations/cancel-invitation/${invitationId}`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Invitation cancelled successfully');
      queryClient.invalidateQueries({ queryKey: ['staffInvitations'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to cancel invitation');
    },
  });

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

      // Calculate booking cost based on nights
      const response = await apiClient.post('/api/credits/calculate-booking-cost', {
        propertyId: room.propertyId,
        seasonType: seasonType,
        roomType: roomData.room_type,
        nights: nights
      });

      if (response.data.success) {
        setRooms(prevRooms => {
          const newRooms = [...prevRooms];
          newRooms[index].estimated_credits = response.data.data.totalCredits;
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
      toast.error('All rooms must have a room type specified');
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

  const resetForm = () => {
    setEmail('');
    setFirstName('');
    setLastName('');
    setRooms([{ room_id: 0, start_date: '', end_date: '', room_type: 'STANDARD' }]);
    setExpiresInDays(30);
    setCreatedInvitation(null);
  };

  if (createdInvitation) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Check className="h-8 w-8 text-green-500" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {t('staff.invitations.invitationCreated')}
              </h1>
            </div>
            <button
              onClick={resetForm}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Invitation Details */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                {t('staff.invitations.invitationDetails')}
              </h3>
              <div className="space-y-2 text-sm">
                <p className="text-blue-800 dark:text-blue-200">
                  <strong>{t('common.email')}:</strong> {createdInvitation.email}
                </p>
                <p className="text-blue-800 dark:text-blue-200">
                  <strong>{t('staff.invitations.roomsIncluded')}:</strong> {createdInvitation.rooms_count}
                </p>
                <p className="text-blue-800 dark:text-blue-200">
                  <strong>{t('staff.invitations.expiresAt')}:</strong>{' '}
                  {new Date(createdInvitation.expires_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Invitation Link */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('staff.invitations.invitationLink')}
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={createdInvitation.invitation_link}
                  readOnly
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button
                  onClick={() => copyToClipboard(createdInvitation.invitation_link)}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center space-x-2"
                >
                  {copiedLink ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                  <span>{copiedLink ? t('common.copied') : t('common.copy')}</span>
                </button>
              </div>
            </div>

            {/* Email Instructions */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Mail className="h-5 w-5 text-gray-600 dark:text-gray-400 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                    {t('staff.invitations.nextSteps')}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('staff.invitations.nextStepsDesc')}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between pt-4">
              <button
                onClick={resetForm}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                {t('staff.invitations.createAnother')}
              </button>
              <a
                href={`mailto:${createdInvitation.email}?subject=${encodeURIComponent(
                  t('staff.invitations.emailSubject')
                )}&body=${encodeURIComponent(
                  t('staff.invitations.emailBody', { link: createdInvitation.invitation_link })
                )}`}
                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center space-x-2"
              >
                <Mail className="h-5 w-5" />
                <span>{t('staff.invitations.sendEmail')}</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Pending Invitations Section */}
      {pendingInvitations && pendingInvitations.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-200 mb-3">
            ⚠️ Invitaciones Pendientes ({pendingInvitations.length})
          </h3>
          <div className="space-y-2">
            {pendingInvitations.map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">{inv.email}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {inv.rooms_count} habitaciones • Expira: {new Date(inv.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => cancelMutation.mutate(inv.id)}
                  disabled={cancelMutation.isPending}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {cancelMutation.isPending ? 'Cancelando...' : 'Cancelar'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
                        {room.estimated_credits ? ` ≈ ${Math.round(room.estimated_credits)} créditos` : ` = ${roomNights} créditos`}
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
                    Seleccionar Habitación *
                  </label>
                  <select
                    value={room.room_id || ''}
                    onChange={(e) => updateRoom(index, 'room_id', Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="">Elegir habitación...</option>
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
                    Temporada detectada: <span className={`font-semibold ${
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
