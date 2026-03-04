import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timeshareApi } from '@/api/timeshare';
import { bookingsApi } from '@/api/bookings';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { Calendar, MapPin, CreditCard, XCircle, CheckCircle, Clock, AlertCircle, Download, Ban, Filter, X, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, parseISO, isAfter, isBefore, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { useState, useMemo } from 'react';

type PaymentFilter = 'all' | 'card' | 'credits' | 'hybrid';

export default function MyBookings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  // Filters
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

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
      alert(error.response?.data?.error || t('owner.bookings.errorCancellingBooking'));
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
      alert(t('owner.bookings.errorDownloadingInvoice'));
    }
  };

  const clearFilters = () => {
    setPaymentFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  // Derive allBookings and computed values before any early returns
  // so hooks (useMemo) are always called in the same order
  const allBookings = Array.isArray(bookings) ? bookings : [];

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

      // Date from (check-in >= dateFrom)
      if (dateFrom) {
        try {
          if (isBefore(startOfDay(parseISO(b.checkIn)), startOfDay(new Date(dateFrom)))) return false;
        } catch { /* ignore parse errors */ }
      }

      // Date to (check-in <= dateTo)
      if (dateTo) {
        try {
          if (isAfter(startOfDay(parseISO(b.checkIn)), startOfDay(new Date(dateTo)))) return false;
        } catch { /* ignore parse errors */ }
      }

      return true;
    });
  }, [allBookings, paymentFilter, dateFrom, dateTo]);

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

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-yellow-100 text-yellow-800">
            <Clock className="h-4 w-4 mr-1" />
            {t('owner.bookings.statusPending')}
          </span>
        );
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800">
            <CheckCircle className="h-4 w-4 mr-1" />
            {t('owner.bookings.statusConfirmed')}
          </span>
        );
      case 'CHECKED_IN':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">
            <CheckCircle className="h-4 w-4 mr-1" />
            {t('owner.bookings.statusCheckedIn')}
          </span>
        );
      case 'CHECKED_OUT':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-gray-100 text-gray-800">
            <CheckCircle className="h-4 w-4 mr-1" />
            {t('owner.bookings.statusCompleted')}
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-800">
            <XCircle className="h-4 w-4 mr-1" />
            {t('owner.bookings.statusCancelled')}
          </span>
        );
      case 'NO_SHOW':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-orange-100 text-orange-800">
            <AlertCircle className="h-4 w-4 mr-1" />
            {t('owner.bookings.statusNoShow')}
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
          🏠 {t('owner.bookings.sourceTimeshare')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
        🏨 {t('owner.bookings.sourceMarketplace')}
      </span>
    );
  };

  const BookingCard = ({ booking }: { booking: any }) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="flex gap-2 text-lg font-semibold text-gray-900">
              <Home className="h-5 w-5 text-blue-600" />
              {booking.property?.name || t('owner.bookings.propertyFallback')}
            </h3>
          </div>
          <div className="flex items-center text-sm text-gray-500 gap-1">
            <MapPin className="h-4 w-4" />
            <span>{booking.property?.location || t('owner.bookings.locationFallback')}</span>
          </div>
          <div className="mt-1 text-xs text-gray-400">
            {booking.confirmationCode}
          </div>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center text-sm">
          <Calendar className="h-4 w-4 text-gray-400 mr-2" />
          <span className="text-gray-600">{t('owner.bookings.checkIn')}</span>
          <span className="ml-2 font-medium">
            {format(parseISO(booking.checkIn), 'dd MMM yyyy', { locale: es })}
          </span>
        </div>
        <div className="flex items-center text-sm">
          <Calendar className="h-4 w-4 text-gray-400 mr-2" />
          <span className="text-gray-600">{t('owner.bookings.checkOut')}</span>
          <span className="ml-2 font-medium">
            {format(parseISO(booking.checkOut), 'dd MMM yyyy', { locale: es })}
          </span>
        </div>
        <div className="flex items-center text-sm">
          <span className="text-gray-600 ml-6">{t('owner.bookings.room')}</span>
          <span className="ml-2 font-medium">{booking.roomCategory || t('owner.bookings.notAvailable')}</span>
        </div>
        <div className="flex items-center text-sm">
          <span className="text-gray-600 ml-6">{t('owner.bookings.guests')}</span>
          <span className="ml-2 font-medium">{booking.guests}</span>
        </div>
        <div className="flex items-center text-sm">
          <span className="text-gray-600 ml-6">{t('owner.bookings.nights')}</span>
          <span className="ml-2 font-medium">{booking.nights}</span>
        </div>
      </div>

      {/* Payment Info */}
      {(() => {
        const credits = Number(booking.creditsUsed) || 0;
        const card = Number(booking.cashPaid) || 0;
        const currency = booking.currency || 'EUR';
        const isHybrid = credits > 0 && card > 0;
        const isCreditsOnly = credits > 0 && card === 0;
        const isCardOnly = credits === 0;

        if (isHybrid) {
          return (
            <div className="bg-indigo-50 border border-indigo-200 rounded p-3 mb-4 space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-indigo-600" />
                  <span className="font-semibold text-indigo-900">{t('owner.bookings.hybridPayment')}</span>
                </div>
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
          );
        }

        if (isCreditsOnly) {
          return (
            <div className="bg-purple-50 border border-purple-200 rounded p-3 mb-4">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-purple-600" />
                  <span className="font-semibold text-purple-900">{t('owner.bookings.paidWithCredits', { count: credits })}</span>
                </div>
                {/* <span className="text-xs text-purple-700 font-medium">{credits.toLocaleString()} {t('owner.bookings.creditsUnit')}</span> */}
              </div>
            </div>
          );
        }

        // Card only
        return (
          <div className="bg-green-50 border border-green-200 rounded p-3 mb-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-green-600" />
                <span className="font-semibold text-green-900">{t('owner.bookings.paidWithCard')}: €{card.toFixed(2)} {currency}</span>
              </div>
              {/* {card > 0 && <span className="text-xs text-green-700 font-medium">€{card.toFixed(2)} {currency}</span>} */}
            </div>
          </div>
        );
      })()}

      {/* Cancellation Info */}
      {['cancelled', 'CANCELLED'].includes(booking.status) && booking.cancelledAt && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-900 mb-1">
                {t('owner.bookings.cancelled')}
              </p>
              <p className="text-xs text-red-700">
                {format(parseISO(booking.cancelledAt), 'dd MMM yyyy HH:mm', { locale: es })}
              </p>
            </div>
          </div>
          {booking.creditsUsed > 0 && (
            <div className="mt-2 pt-2 border-t border-red-200">
              <p className="text-xs text-red-600">
                {t('owner.bookings.creditsRefunded', { count: booking.creditsUsed.toLocaleString() })}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <span className="text-xs text-gray-500">
          {t('owner.bookings.bookingId', { id: booking.id })}
        </span>
        <div className="flex gap-2">
          {/* Cancel Booking Button - only for active bookings */}
          {['confirmed', 'CONFIRMED'].includes(booking.status) && new Date(booking.checkIn) > new Date() && (
            <button
              onClick={() => handleCancelBooking(booking.id)}
              disabled={cancellingId === booking.id}
              className="text-sm font-medium text-red-600 hover:text-red-700 flex items-center gap-1 disabled:opacity-50"
            >
              {cancellingId === booking.id ? (
                <>
                  <LoadingSpinner size="sm" />
                  {t('owner.bookings.cancelling')}
                </>
              ) : (
                <>
                  <Ban className="h-4 w-4" />
                  {t('owner.bookings.cancel')}
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
        {allBookings.length === 0 ? (
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
            {filteredBookings.map((booking: any) => (
              <BookingCard key={booking.id} booking={booking} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
