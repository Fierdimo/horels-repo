import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/client';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Calendar, User, Euro, Clock, CheckCircle, XCircle, AlertTriangle, Bed } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { toast } from 'react-hot-toast';

interface Room {
  id: number;
  name: string;
  type: string;
  capacity: number;
  status: string;
}

interface Property {
  id: number;
  name: string;
  location: string;
}

interface Booking {
  id: number;
  property_id: number;
  room_id: number;
  guest_name: string;
  guest_email: string;
  check_in: string;
  check_out: string;
  room_type: string;
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
  total_amount: number;
  currency: string;
  created_at: string;
  Room?: Room;
  Property?: Property;
}

interface BookingStats {
  total: number;
  pending: number;
  confirmed: number;
  checkedIn: number;
}

export default function PendingBookings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [selectedBooking, setSelectedBooking] = useState<number | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Fetch pending bookings
  const { data: pendingBookingsData, isLoading: loadingBookings } = useQuery({
    queryKey: ['staff-pending-bookings'],
    queryFn: async () => {
      const { data } = await apiClient.get('/hotel-staff/bookings/pending');
      return data;
    }
  });

  // Fetch booking statistics
  const { data: statsData } = useQuery({
    queryKey: ['staff-booking-stats'],
    queryFn: async () => {
      const { data } = await apiClient.get('/hotel-staff/bookings/stats');
      return data;
    }
  });

  // Approve booking mutation
  const approveMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      const { data } = await apiClient.post(`/hotel-staff/bookings/${bookingId}/approve`);
      return data;
    },
    onSuccess: () => {
      toast.success(t('staff.bookings.approveSuccess'));
      queryClient.invalidateQueries({ queryKey: ['staff-pending-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['staff-booking-stats'] });
      queryClient.invalidateQueries({ queryKey: ['staff-rooms'] });
      setSelectedBooking(null);
      setActionType(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('staff.bookings.approveError'));
    }
  });

  // Reject booking mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ bookingId, reason }: { bookingId: number; reason: string }) => {
      const { data } = await apiClient.post(`/hotel-staff/bookings/${bookingId}/reject`, { reason });
      return data;
    },
    onSuccess: () => {
      toast.success(t('staff.bookings.rejectSuccess'));
      queryClient.invalidateQueries({ queryKey: ['staff-pending-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['staff-booking-stats'] });
      setSelectedBooking(null);
      setActionType(null);
      setRejectReason('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('staff.bookings.rejectError'));
    }
  });

  const pendingBookings: Booking[] = pendingBookingsData?.data || [];
  const stats: BookingStats = statsData?.data || { total: 0, pending: 0, confirmed: 0, checkedIn: 0 };

  const handleApprove = (bookingId: number) => {
    setSelectedBooking(bookingId);
    setActionType('approve');
  };

  const handleReject = (bookingId: number) => {
    setSelectedBooking(bookingId);
    setActionType('reject');
  };

  const confirmApprove = () => {
    if (selectedBooking) {
      approveMutation.mutate(selectedBooking);
    }
  };

  const confirmReject = () => {
    if (selectedBooking && rejectReason.trim()) {
      rejectMutation.mutate({ bookingId: selectedBooking, reason: rejectReason });
    }
  };

  const calculateNights = (checkIn: string, checkOut: string) => {
    return differenceInDays(parseISO(checkOut), parseISO(checkIn));
  };

  if (loadingBookings) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t('staff.bookings.title')}
          </h1>
          <p className="text-gray-600">
            {t('staff.bookings.subtitle')}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-yellow-50 rounded-lg shadow-sm p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('staff.bookings.pendingCount')}</p>
                <p className="text-3xl font-bold text-yellow-600 mt-2">{stats.pending}</p>
              </div>
              <Clock className="h-12 w-12 text-yellow-500 opacity-20" />
            </div>
          </div>

          <div className="bg-green-50 rounded-lg shadow-sm p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('staff.bookings.confirmedCount')}</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{stats.confirmed}</p>
              </div>
              <CheckCircle className="h-12 w-12 text-green-500 opacity-20" />
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('staff.bookings.checkedInCount')}</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">{stats.checkedIn}</p>
              </div>
              <Bed className="h-12 w-12 text-blue-500 opacity-20" />
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg shadow-sm p-6 border-l-4 border-gray-400">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('staff.bookings.totalCount')}</p>
                <p className="text-3xl font-bold text-gray-700 mt-2">{stats.total}</p>
              </div>
              <AlertTriangle className="h-12 w-12 text-gray-400 opacity-20" />
            </div>
          </div>
        </div>

        {/* Pending Bookings List */}
        {pendingBookings.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {t('staff.bookings.allCaughtUp')}
            </h3>
            <p className="text-gray-600">
              {t('staff.bookings.noRequestsDesc')}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingBookings.map((booking) => {
              const nights = calculateNights(booking.check_in, booking.check_out);
              const pricePerNight = booking.total_amount / nights;

              return (
                <div key={booking.id} className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          {t('staff.bookings.bookingNumber', { number: booking.id })}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {t('staff.bookings.requestedOn', {
                            date: format(parseISO(booking.created_at), 'PPpp')
                          })}
                        </p>
                      </div>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                        <Clock className="h-4 w-4 mr-1" />
                        {t('staff.bookings.pending')}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      {/* Guest Information */}
                      <div className="space-y-3">
                        <h4 className="font-medium text-gray-900 flex items-center gap-2">
                          <User className="h-5 w-5 text-gray-400" />
                          {t('staff.bookings.guestInfo')}
                        </h4>
                        <div className="pl-7 space-y-2">
                          <p className="text-sm">
                            <span className="text-gray-600">{t('staff.bookings.name')}:</span>{' '}
                            <span className="font-medium text-gray-900">{booking.guest_name}</span>
                          </p>
                          <p className="text-sm">
                            <span className="text-gray-600">{t('staff.bookings.email')}:</span>{' '}
                            <span className="font-medium text-gray-900">{booking.guest_email}</span>
                          </p>
                        </div>
                      </div>

                      {/* Room Information */}
                      <div className="space-y-3">
                        <h4 className="font-medium text-gray-900 flex items-center gap-2">
                          <Bed className="h-5 w-5 text-gray-400" />
                          {t('staff.bookings.roomInfo')}
                        </h4>
                        <div className="pl-7 space-y-2">
                          <p className="text-sm">
                            <span className="text-gray-600">{t('staff.bookings.room')}:</span>{' '}
                            <span className="font-medium text-gray-900">
                              {booking.Room?.name || booking.room_type}
                            </span>
                          </p>
                          <p className="text-sm">
                            <span className="text-gray-600">{t('staff.bookings.type')}:</span>{' '}
                            <span className="font-medium text-gray-900">{booking.Room?.type || booking.room_type}</span>
                          </p>
                        </div>
                      </div>

                      {/* Dates */}
                      <div className="space-y-3">
                        <h4 className="font-medium text-gray-900 flex items-center gap-2">
                          <Calendar className="h-5 w-5 text-gray-400" />
                          {t('staff.bookings.dates')}
                        </h4>
                        <div className="pl-7 space-y-2">
                          <p className="text-sm">
                            <span className="text-gray-600">{t('staff.bookings.checkIn')}:</span>{' '}
                            <span className="font-medium text-gray-900">
                              {format(parseISO(booking.check_in), 'PPP')}
                            </span>
                          </p>
                          <p className="text-sm">
                            <span className="text-gray-600">{t('staff.bookings.checkOut')}:</span>{' '}
                            <span className="font-medium text-gray-900">
                              {format(parseISO(booking.check_out), 'PPP')}
                            </span>
                          </p>
                          <p className="text-sm font-medium text-blue-600">
                            {t('staff.bookings.nights', { count: nights })}
                          </p>
                        </div>
                      </div>

                      {/* Payment */}
                      <div className="space-y-3">
                        <h4 className="font-medium text-gray-900 flex items-center gap-2">
                          <Euro className="h-5 w-5 text-gray-400" />
                          {t('staff.bookings.payment')}
                        </h4>
                        <div className="pl-7 space-y-2">
                          <p className="text-sm">
                            <span className="text-gray-600">{t('staff.bookings.pricePerNight')}:</span>{' '}
                            <span className="font-medium text-gray-900">
                              {pricePerNight.toFixed(2)} {booking.currency}
                            </span>
                          </p>
                          <p className="text-sm">
                            <span className="text-gray-600">{t('staff.bookings.totalAmount')}:</span>{' '}
                            <span className="font-bold text-lg text-gray-900">
                              {booking.total_amount.toFixed(2)} {booking.currency}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t border-gray-200">
                      <button
                        onClick={() => handleApprove(booking.id)}
                        disabled={approveMutation.isPending}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <CheckCircle className="h-5 w-5" />
                        {t('staff.bookings.approve')}
                      </button>
                      <button
                        onClick={() => handleReject(booking.id)}
                        disabled={rejectMutation.isPending}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <XCircle className="h-5 w-5" />
                        {t('staff.bookings.reject')}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Approve Confirmation Modal */}
        {actionType === 'approve' && selectedBooking && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {t('staff.bookings.confirmApprove')}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {t('staff.bookings.approveDescription')}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setSelectedBooking(null);
                    setActionType(null);
                  }}
                  disabled={approveMutation.isPending}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={confirmApprove}
                  disabled={approveMutation.isPending}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {approveMutation.isPending ? t('common.processing') : t('staff.bookings.confirmButton')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reject Confirmation Modal */}
        {actionType === 'reject' && selectedBooking && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {t('staff.bookings.confirmReject')}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {t('staff.bookings.rejectDescription')}
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('staff.bookings.rejectReason')} *
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder={t('staff.bookings.rejectReasonPlaceholder')}
                  disabled={rejectMutation.isPending}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setSelectedBooking(null);
                    setActionType(null);
                    setRejectReason('');
                  }}
                  disabled={rejectMutation.isPending}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={confirmReject}
                  disabled={rejectMutation.isPending || !rejectReason.trim()}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {rejectMutation.isPending ? t('common.processing') : t('staff.bookings.confirmReject')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
