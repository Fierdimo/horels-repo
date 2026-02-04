import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timeshareApi } from '@/api/timeshare';
import { bookingsApi } from '@/api/bookings';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { Calendar, MapPin, CreditCard, XCircle, CheckCircle, Clock, AlertCircle, ArrowLeft, Download, Ban } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';

export default function MyBookings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  
  const { data: bookings, isLoading, error } = useQuery({
    queryKey: ['myBookings'],
    queryFn: timeshareApi.getMyBookings
  });

  const cancelMutation = useMutation({
    mutationFn: (bookingId: number) => bookingsApi.cancelBooking(bookingId, 'User requested cancellation'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myBookings'] });
      setCancellingId(null);
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Failed to cancel booking');
      setCancellingId(null);
    },
  });

  const handleCancelBooking = (bookingId: number) => {
    if (confirm(t('owner.bookings.confirmCancel'))) {
      setCancellingId(bookingId);
      cancelMutation.mutate(bookingId);
    }
  };

  const handleDownloadInvoice = async (bookingId: number) => {
    try {
      await bookingsApi.downloadInvoice(bookingId);
    } catch (error) {
      alert('Failed to download invoice');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <ErrorMessage message={t('owner.bookings.errorLoading')} />
      </div>
    );
  }

  const allBookings = Array.isArray(bookings) ? bookings : [];
  
  // Only show confirmed bookings
  const confirmedBookings = allBookings.filter((b: any) => b.status === 'CONFIRMED');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-yellow-100 text-yellow-800">
            <Clock className="h-4 w-4 mr-1" />
            Pending
          </span>
        );
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800">
            <CheckCircle className="h-4 w-4 mr-1" />
            Confirmed
          </span>
        );
      case 'CHECKED_IN':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">
            <CheckCircle className="h-4 w-4 mr-1" />
            Checked In
          </span>
        );
      case 'CHECKED_OUT':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-gray-100 text-gray-800">
            <CheckCircle className="h-4 w-4 mr-1" />
            Completed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-800">
            <XCircle className="h-4 w-4 mr-1" />
            Cancelled
          </span>
        );
      case 'NO_SHOW':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-orange-100 text-orange-800">
            <AlertCircle className="h-4 w-4 mr-1" />
            No Show
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  const getSourceBadge = (source: string) => {
    if (source === 'TIMESHARE') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
          🏠 Timeshare
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
        🏨 Marketplace
      </span>
    );
  };

  const BookingCard = ({ booking }: { booking: any }) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">
              {booking.property?.name || 'Property'}
            </h3>
            {getSourceBadge(booking.source)}
          </div>
          <div className="flex items-center text-sm text-gray-500 gap-1">
            <MapPin className="h-4 w-4" />
            <span>{booking.property?.location || 'Location'}</span>
          </div>
          <div className="mt-1 text-xs text-gray-400">
            {booking.confirmationCode}
          </div>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center text-sm">
          <Calendar className="h-4 w-4 text-gray-400 mr-2" />
          <span className="text-gray-600">Check-in:</span>
          <span className="ml-2 font-medium">
            {format(parseISO(booking.checkIn), 'dd MMM yyyy', { locale: es })}
          </span>
        </div>
        <div className="flex items-center text-sm">
          <Calendar className="h-4 w-4 text-gray-400 mr-2" />
          <span className="text-gray-600">Check-out:</span>
          <span className="ml-2 font-medium">
            {format(parseISO(booking.checkOut), 'dd MMM yyyy', { locale: es })}
          </span>
        </div>
        <div className="flex items-center text-sm">
          <span className="text-gray-600 ml-6">Room:</span>
          <span className="ml-2 font-medium">{booking.roomCategory || 'N/A'}</span>
        </div>
        <div className="flex items-center text-sm">
          <span className="text-gray-600 ml-6">Guests:</span>
          <span className="ml-2 font-medium">{booking.guests}</span>
        </div>
        <div className="flex items-center text-sm">
          <span className="text-gray-600 ml-6">Nights:</span>
          <span className="ml-2 font-medium">{booking.nights}</span>
        </div>
      </div>

      {/* Payment Info */}
      {booking.creditsUsed && booking.creditsUsed > 0 ? (
        <div className="bg-purple-50 border border-purple-200 rounded p-3 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <CreditCard className="h-4 w-4 text-purple-600" />
            <span className="font-semibold text-purple-900">
              Paid with Credits: {booking.creditsUsed.toLocaleString()} credits
            </span>
          </div>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded p-3 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <CreditCard className="h-4 w-4 text-green-600" />
            <span className="font-semibold text-green-900">
              Paid with Card
            </span>
          </div>
        </div>
      )}

      {/* Cancellation Info */}
      {booking.status === 'CANCELLED' && booking.cancelledAt && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-900 mb-1">
                Cancelled
              </p>
              <p className="text-xs text-red-700">
                {format(parseISO(booking.cancelledAt), 'dd MMM yyyy HH:mm', { locale: es })}
              </p>
            </div>
          </div>
          {booking.creditsUsed > 0 && (
            <div className="mt-2 pt-2 border-t border-red-200">
              <p className="text-xs text-red-600">
                ✓ Credits refunded: {booking.creditsUsed.toLocaleString()}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <span className="text-xs text-gray-500">
          Booking ID: #{booking.id}
        </span>
        <div className="flex gap-2">
          {/* Cancel Booking Button - only for active bookings */}
          {booking.status === 'CONFIRMED' && new Date(booking.checkIn) > new Date() && (
            <button
              onClick={() => handleCancelBooking(booking.id)}
              disabled={cancellingId === booking.id}
              className="text-sm font-medium text-red-600 hover:text-red-700 flex items-center gap-1 disabled:opacity-50"
            >
              {cancellingId === booking.id ? (
                <>
                  <LoadingSpinner size="sm" />
                  Cancelling...
                </>
              ) : (
                <>
                  <Ban className="h-4 w-4" />
                  Cancel
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link to="/owner/dashboard" className="text-gray-600 hover:text-gray-900">
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">{t('owner.bookings.myBookingsTitle')}</h1>
              <p className="mt-1 text-sm text-gray-500">
                {t('owner.bookings.myBookingsSubtitle')}
              </p>
            </div>
            <Calendar className="h-12 w-12 text-blue-600" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {confirmedBookings.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {t('owner.bookings.noBookingsYet')}
            </h3>
            <p className="text-gray-500 mb-6">
              {t('owner.bookings.noBookingsDescription')}
            </p>
            <Link
              to="/owner/marketplace"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t('owner.bookings.exploreMarketplace')}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {confirmedBookings.map((booking: any) => (
              <BookingCard key={booking.id} booking={booking} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
