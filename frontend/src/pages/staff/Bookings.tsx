import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/client';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Calendar, User, Clock, CheckCircle, XCircle, AlertTriangle, Filter, LogIn, LogOut } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

interface Booking {
  id: number;
  property_id: number;
  guest_name: string;
  guest_email: string;
  check_in: string;
  check_out: string;
  room_type: string;
  status: string;
  created_at: string;
  Room?: { name: string; type: string };
  Property?: { name: string; location: string };
  raw?: any;
}

export default function StaffBookings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'all'>('pending');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Fetch bookings
  const { data: bookingsData, isLoading } = useQuery({
    queryKey: ['staff-bookings', activeTab],
    queryFn: async () => {
      let endpoint = '/hotel-staff/bookings';
      if (activeTab === 'pending') {
        endpoint = '/hotel-staff/bookings/pending';
      }
      const { data } = await apiClient.get(endpoint);
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
      queryClient.invalidateQueries({ queryKey: ['staff-bookings'] });
      toast.success(t('staff.bookings.approveSuccess'));
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || t('staff.bookings.approveError'));
    }
  });

  // Reject booking mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ bookingId, reason }: { bookingId: number; reason: string }) => {
      const { data } = await apiClient.post(`/hotel-staff/bookings/${bookingId}/reject`, { reason });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-bookings'] });
      setShowRejectModal(false);
      setRejectReason('');
      setSelectedBooking(null);
      toast.success(t('staff.bookings.rejectSuccess'));
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || t('staff.bookings.rejectError'));
    }
  });

  // Check-in mutation
  const checkInMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      const { data } = await apiClient.post(`/hotel-staff/bookings/${bookingId}/checkin`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-bookings'] });
      toast.success(t('staff.bookings.checkInSuccess') || 'Check-in successful');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || t('staff.bookings.checkInError') || 'Check-in failed');
    }
  });

  // Check-out mutation
  const checkOutMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      const { data } = await apiClient.post(`/hotel-staff/bookings/${bookingId}/checkout`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-bookings'] });
      toast.success(t('staff.bookings.checkOutSuccess') || 'Check-out successful');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || t('staff.bookings.checkOutError') || 'Check-out failed');
    }
  });

  const bookings = bookingsData?.bookings || bookingsData?.data || [];

  const handleApprove = (booking: Booking) => {
    if (confirm(t('staff.bookings.approveConfirm'))) {
      approveMutation.mutate(booking.id);
    }
  };

  const handleReject = (booking: Booking) => {
    setSelectedBooking(booking);
    setShowRejectModal(true);
  };

  const submitReject = () => {
    if (!selectedBooking || !rejectReason.trim()) {
      toast.error(t('staff.bookings.rejectReasonRequired'));
      return;
    }
    rejectMutation.mutate({ bookingId: selectedBooking.id, reason: rejectReason });
  };

  const handleCheckIn = (booking: Booking) => {
    if (confirm(t('staff.bookings.checkInConfirm') || `Confirm check-in for ${booking.guest_name}?`)) {
      checkInMutation.mutate(booking.id);
    }
  };

  const handleCheckOut = (booking: Booking) => {
    if (confirm(t('staff.bookings.checkOutConfirm') || `Confirm check-out for ${booking.guest_name}?`)) {
      checkOutMutation.mutate(booking.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('staff.bookings.title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('staff.bookings.subtitle')}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('pending')}
            className={`${
              activeTab === 'pending'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            } whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium`}
          >
            <AlertTriangle className="mr-2 inline-block h-5 w-5" />
            {t('staff.bookings.pending')}
            {bookings.filter((b: Booking) => b.status === 'pending_approval').length > 0 && (
              <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900 dark:text-red-200">
                {bookings.filter((b: Booking) => b.status === 'pending_approval').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`${
              activeTab === 'active'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            } whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium`}
          >
            <CheckCircle className="mr-2 inline-block h-5 w-5" />
            {t('staff.bookings.active')}
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`${
              activeTab === 'all'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            } whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium`}
          >
            <Filter className="mr-2 inline-block h-5 w-5" />
            {t('staff.bookings.all')}
          </button>
        </nav>
      </div>

      {/* Bookings Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {bookings.length === 0 ? (
          <div className="col-span-full rounded-lg border border-dashed border-gray-300 p-12 text-center dark:border-gray-700">
            <Calendar className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              {t('staff.bookings.noBookings')}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t('staff.bookings.noBookingsDescription')}
            </p>
          </div>
        ) : (
          bookings.map((booking: Booking) => (
            <div
              key={booking.id}
              className={`rounded-lg border p-6 ${
                booking.status === 'pending_approval'
                  ? 'border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/20'
                  : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
              }`}
            >
              {/* Status Badge */}
              <div className="mb-4 flex items-center justify-between">
                <span
                  className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                    booking.status === 'pending_approval'
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      : booking.status === 'confirmed'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                  }`}
                >
                  {t(`staff.bookings.status.${booking.status}`)}
                </span>
                <span className="text-xs text-gray-500">
                  #{booking.id}
                </span>
              </div>

              {/* Guest Info */}
              <div className="mb-4">
                <div className="flex items-center text-sm font-medium text-gray-900 dark:text-white">
                  <User className="mr-2 h-4 w-4" />
                  {booking.guest_name}
                </div>
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {booking.guest_email}
                </div>
              </div>

              {/* Property & Room */}
              <div className="mb-4 space-y-2">
                <div className="text-sm">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {booking.Property?.name || 'Property'}
                  </span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {booking.Room?.name || booking.room_type}
                </div>
              </div>

              {/* Dates */}
              <div className="mb-4 flex items-center text-sm text-gray-600 dark:text-gray-400">
                <Calendar className="mr-2 h-4 w-4" />
                <span>
                  {format(parseISO(booking.check_in), 'MMM dd')} - {format(parseISO(booking.check_out), 'MMM dd, yyyy')}
                </span>
              </div>

              {/* Source Info */}
              {booking.raw?.source && (
                <div className="mb-4 text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-medium">Source:</span>{' '}
                  {booking.raw.source === 'marketplace' ? 'Marketplace' : 'Direct'}
                </div>
              )}

              {/* Actions for Pending */}
              {booking.status === 'pending_approval' && (
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => handleApprove(booking)}
                    disabled={approveMutation.isPending}
                    className="flex-1 rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    <CheckCircle className="mr-1 inline-block h-4 w-4" />
                    {t('staff.bookings.approve')}
                  </button>
                  <button
                    onClick={() => handleReject(booking)}
                    disabled={rejectMutation.isPending}
                    className="flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    <XCircle className="mr-1 inline-block h-4 w-4" />
                    {t('staff.bookings.reject')}
                  </button>
                </div>
              )}

              {/* Quick Actions for Confirmed Bookings */}
              {booking.status === 'confirmed' && (
                <div className="mt-4">
                  <button
                    onClick={() => handleCheckIn(booking)}
                    disabled={checkInMutation.isPending}
                    className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <LogIn className="mr-1 inline-block h-4 w-4" />
                    {t('staff.bookings.checkIn') || 'Check In'}
                  </button>
                </div>
              )}

              {/* Quick Actions for Checked In */}
              {booking.status === 'checked_in' && (
                <div className="mt-4">
                  <button
                    onClick={() => handleCheckOut(booking)}
                    disabled={checkOutMutation.isPending}
                    className="w-full rounded-md bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
                  >
                    <LogOut className="mr-1 inline-block h-4 w-4" />
                    {t('staff.bookings.checkOut') || 'Check Out'}
                  </button>
                </div>
              )}

              {/* Created At */}
              <div className="mt-4 flex items-center text-xs text-gray-400">
                <Clock className="mr-1 h-3 w-3" />
                {format(parseISO(booking.created_at), 'MMM dd, yyyy HH:mm')}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-medium text-gray-900 dark:text-white">
              {t('staff.bookings.rejectTitle')}
            </h3>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              {t('staff.bookings.rejectDescription')}
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-gray-300 p-3 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              placeholder={t('staff.bookings.rejectPlaceholder')}
            />
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                  setSelectedBooking(null);
                }}
                className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={submitReject}
                disabled={rejectMutation.isPending || !rejectReason.trim()}
                className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {rejectMutation.isPending ? t('common.loading') : t('staff.bookings.confirmReject')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
