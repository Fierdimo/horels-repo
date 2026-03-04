import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { Calendar, MapPin, CheckCircle, XCircle, Clock, AlertCircle, CreditCard, Ban, Filter, X } from 'lucide-react';
import { format, parseISO, isAfter, isBefore, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { timeshareApi } from '@/api/timeshare';
import { bookingsApi, type Booking } from '@/api/bookings';
import { useState, useMemo } from 'react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

type PaymentFilter = 'all' | 'card' | 'credits' | 'hybrid';

export default function GuestBookings() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  // Filters
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const { data: bookingsData, isLoading } = useQuery({
    queryKey: ['myBookings'],
    queryFn: timeshareApi.getMyBookings,
  });

  const allBookings: Booking[] = bookingsData || [];

  const cancelMutation = useMutation({
    mutationFn: (bookingId: number) => bookingsApi.cancelBookingV2(bookingId, 'User requested cancellation'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myBookings'] });
      setCancellingId(null);
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || t('guest.bookings.errorCancelling'));
      setCancellingId(null);
    },
  });

  const handleCancelBooking = (bookingId: number) => {
    if (confirm(t('guest.bookings.confirmCancel'))) {
      setCancellingId(bookingId);
      cancelMutation.mutate(bookingId);
    }
  };

  const clearFilters = () => {
    setPaymentFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters = paymentFilter !== 'all' || dateFrom !== '' || dateTo !== '';

  const filteredBookings = useMemo(() => {
    return allBookings.filter((b: any) => {
      // Payment
      if (paymentFilter !== 'all') {
        const credits = Number(b.creditsUsed) || 0;
        const card = Number(b.cashPaid) || 0;
        if (paymentFilter === 'credits' && !(credits > 0 && card === 0)) return false;
        if (paymentFilter === 'card' && !(credits === 0)) return false;
        if (paymentFilter === 'hybrid' && !(credits > 0 && card > 0)) return false;
      }

      const checkIn = b.checkIn || b.check_in || b.check_in_date;

      // Date from
      if (dateFrom && checkIn) {
        try {
          if (isBefore(startOfDay(parseISO(checkIn)), startOfDay(new Date(dateFrom)))) return false;
        } catch { /* ignore */ }
      }

      // Date to
      if (dateTo && checkIn) {
        try {
          if (isAfter(startOfDay(parseISO(checkIn)), startOfDay(new Date(dateTo)))) return false;
        } catch { /* ignore */ }
      }

      return true;
    });
  }, [allBookings, paymentFilter, dateFrom, dateTo]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'checked_in': return 'bg-blue-100 text-blue-800';
      case 'checked_out': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed': return <CheckCircle className="h-4 w-4" />;
      case 'checked_in': return <Calendar className="h-4 w-4" />;
      case 'checked_out': return <CheckCircle className="h-4 w-4" />;
      case 'cancelled': return <XCircle className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      default: return <Calendar className="h-4 w-4" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed': return t('guest.bookings.statusConfirmed') || 'Confirmed';
      case 'checked_in': return t('guest.bookings.statusCheckedIn') || 'Checked In';
      case 'checked_out': return t('guest.bookings.statusCompleted') || 'Completed';
      case 'cancelled': return t('guest.bookings.statusCancelled') || 'Cancelled';
      case 'pending': return t('guest.bookings.statusPending') || 'Pending';
      default: return status;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">
                {t('guest.dashboard.myBookings') || 'My Bookings'}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {t('guest.bookings.subtitle') || 'View and manage all your reservations'}
              </p>
            </div>
            <Calendar className="h-12 w-12 text-blue-600" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">

        {/* Filter bar */}
        <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowFilters(v => !v)}
              className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              <Filter className="h-4 w-4" />
              {t('owner.bookings.filters')}
              {hasActiveFilters && (
                <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs">
                  {[paymentFilter !== 'all', !!dateFrom, !!dateTo].filter(Boolean).length}
                </span>
              )}
            </button>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span>{t('owner.bookings.showingResults', { count: filteredBookings.length, total: allBookings.length })}</span>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium">
                  <X className="h-3.5 w-3.5" />
                  {t('owner.bookings.clearFilters')}
                </button>
              )}
            </div>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

              {/* Payment */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('owner.bookings.filterPayment')}</label>
                <select
                  value={paymentFilter}
                  onChange={e => setPaymentFilter(e.target.value as PaymentFilter)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">{t('owner.bookings.filterAll')}</option>
                  <option value="card">{t('owner.bookings.paidWithCard')}</option>
                  <option value="credits">{t('owner.bookings.filterCreditsOnly')}</option>
                  <option value="hybrid">{t('owner.bookings.hybridPayment')}</option>
                </select>
              </div>

              {/* Date from */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('owner.bookings.filterDateFrom')}</label>
                <input
                  type="date"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={e => setDateFrom(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Date to */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('owner.bookings.filterDateTo')}</label>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={e => setDateTo(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

            </div>
          )}
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : allBookings.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {t('guest.bookings.noBookings') || 'No bookings found'}
            </h3>
            <p className="text-gray-500 mb-6">
              {t('guest.bookings.startBooking') || 'Start exploring properties to make your first booking'}
            </p>
            <button
              onClick={() => window.location.href = '/guest/marketplace'}
              className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary/90 transition"
            >
              {t('guest.dashboard.browseProperties') || 'Browse Properties'}
            </button>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Filter className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {t('owner.bookings.noFilterResults')}
            </h3>
            <p className="text-gray-500 mb-4">
              {t('owner.bookings.noFilterResultsDescription')}
            </p>
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <X className="h-4 w-4" />
              {t('owner.bookings.clearFilters')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                t={t}
                getStatusColor={getStatusColor}
                getStatusIcon={getStatusIcon}
                getStatusLabel={getStatusLabel}
                onCancel={handleCancelBooking}
                isCancelling={cancellingId === booking.id}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

interface BookingCardProps {
  booking: Booking;
  t: any;
  getStatusColor: (status: string) => string;
  getStatusIcon: (status: string) => JSX.Element;
  getStatusLabel: (status: string) => string;
  onCancel: (bookingId: number) => void;
  isCancelling: boolean;
}

function BookingCard({ booking, t, getStatusColor, getStatusIcon, getStatusLabel, onCancel, isCancelling }: BookingCardProps) {
  const checkInDate = booking.checkIn || booking.check_in || booking.check_in_date;
  const checkOutDate = booking.checkOut || booking.check_out || booking.check_out_date;
  const propertyName = booking.property?.name || booking.Property?.name || t('guest.bookings.unknownProperty') || 'Unknown Property';
  const propertyLocation = booking.property?.location || booking.Property?.location || booking.Property?.city || t('guest.bookings.unknownLocation') || 'Location not available';
  const roomType = booking.roomCategory || booking.room_type;

  const canCancel = booking.status === 'confirmed' && checkInDate && new Date(checkInDate) > new Date();

  const credits = Number(booking.creditsUsed) || 0;
  const card = Number(booking.cashPaid) || 0;
  const currency = booking.currency || 'EUR';
  const isHybrid = credits > 0 && card > 0;
  const isCreditsOnly = credits > 0 && card === 0;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{propertyName}</h3>
          <div className="flex items-center text-sm text-gray-500 gap-1 mb-1">
            <MapPin className="h-4 w-4" />
            <span>{propertyLocation}</span>
          </div>
          {booking.confirmationCode && (
            <div className="text-xs text-gray-400">{booking.confirmationCode}</div>
          )}
        </div>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold gap-1 ${getStatusColor(booking.status)}`}>
          {getStatusIcon(booking.status)}
          {getStatusLabel(booking.status)}
        </span>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center text-sm">
          <Calendar className="h-4 w-4 text-gray-400 mr-2" />
          <span className="text-gray-600">{t('guest.bookings.checkIn') || 'Check-in'}</span>
          <span className="ml-2 font-medium">
            {checkInDate ? format(parseISO(checkInDate), 'dd MMM yyyy', { locale: es }) : 'N/A'}
          </span>
        </div>
        <div className="flex items-center text-sm">
          <Calendar className="h-4 w-4 text-gray-400 mr-2" />
          <span className="text-gray-600">{t('guest.bookings.checkOut') || 'Check-out'}</span>
          <span className="ml-2 font-medium">
            {checkOutDate ? format(parseISO(checkOutDate), 'dd MMM yyyy', { locale: es }) : 'N/A'}
          </span>
        </div>
        {roomType && (
          <div className="flex items-center text-sm">
            <span className="text-gray-600 ml-6">{t('guest.bookings.room') || 'Room'}</span>
            <span className="ml-2 font-medium">{roomType}</span>
          </div>
        )}
        {booking.nights && (
          <div className="flex items-center text-sm">
            <span className="text-gray-600 ml-6">{t('owner.bookings.nights')}</span>
            <span className="ml-2 font-medium">{booking.nights}</span>
          </div>
        )}
      </div>

      {/* Payment Info */}
      {isHybrid ? (
        <div className="bg-indigo-50 border border-indigo-200 rounded p-3 mb-4 space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <CreditCard className="h-4 w-4 text-indigo-600" />
            <span className="font-semibold text-indigo-900">{t('owner.bookings.hybridPayment')}</span>
          </div>
          <div className="flex justify-between text-xs text-indigo-700 pl-6">
            <span>{t('owner.bookings.creditsLabel')}</span>
            <span className="font-medium">{credits.toLocaleString()} {t('owner.bookings.creditsUnit')}</span>
          </div>
          <div className="flex justify-between text-xs text-indigo-700 pl-6">
            <span>{t('owner.bookings.cardLabel')}</span>
            <span className="font-medium">€{card.toFixed(2)} {currency}</span>
          </div>
        </div>
      ) : isCreditsOnly ? (
        <div className="bg-purple-50 border border-purple-200 rounded p-3 mb-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-purple-600" />
              <span className="font-semibold text-purple-900">{t('owner.bookings.paidWithCredits', { count: credits.toLocaleString() })}</span>
            </div>
            <span className="text-xs text-purple-700 font-medium">{credits.toLocaleString()} {t('owner.bookings.creditsUnit')}</span>
          </div>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded p-3 mb-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-green-600" />
              <span className="font-semibold text-green-900">{t('owner.bookings.paidWithCard')}</span>
            </div>
            {card > 0 && <span className="text-xs text-green-700 font-medium">€{card.toFixed(2)} {currency}</span>}
          </div>
        </div>
      )}

      {/* Cancellation Info */}
      {booking.status === 'cancelled' && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-900">
                {t('guest.bookings.cancelled') || 'Cancelled'}
              </p>
              {booking.cancelledAt && (
                <p className="text-xs text-red-700">
                  {format(parseISO(booking.cancelledAt), 'dd MMM yyyy HH:mm', { locale: es })}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <span className="text-xs text-gray-500">#{booking.id}</span>
        <div className="flex gap-2">
          {canCancel && (
            <button
              onClick={() => onCancel(booking.id)}
              disabled={isCancelling}
              className="text-sm font-medium text-red-600 hover:text-red-700 flex items-center gap-1 disabled:opacity-50"
            >
              {isCancelling ? (
                <>
                  <LoadingSpinner size="sm" />
                  {t('guest.bookings.cancelling') || 'Cancelling...'}
                </>
              ) : (
                <>
                  <Ban className="h-4 w-4" />
                  {t('guest.bookings.cancel') || 'Cancel'}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
