import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { Calendar, MapPin, CreditCard, Search, User, TrendingUp, Clock, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';
import { timeshareApi } from '@/api/timeshare';
import { Link } from 'react-router-dom';
import { format, parseISO, isAfter, isBefore, differenceInDays } from 'date-fns';
import { es, enUS, fr, de, it } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import type { Booking } from '@/api/bookings';

const localeMap: Record<string, Locale> = {
  es,
  en: enUS,
  fr,
  de,
  it
};

export default function GuestDashboard() {
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const currentLocale = localeMap[i18n.language] || enUS;

  // Get all bookings using V2 API
  const { data: bookingsData, isLoading } = useQuery({
    queryKey: ['myBookings'],
    queryFn: timeshareApi.getMyBookings,
  });

  const bookings = bookingsData || [];
  const now = new Date();

  // Find active booking (currently staying)
  const activeBooking = bookings.find((booking: Booking) => {
    const checkIn = booking.checkIn || booking.check_in;
    const checkOut = booking.checkOut || booking.check_out;
    const status = (booking.status || '').toLowerCase();
    if (!checkIn || !checkOut || status !== 'confirmed') return false;
    const checkInDate = parseISO(checkIn);
    const checkOutDate = parseISO(checkOut);
    return isBefore(checkInDate, now) && isAfter(checkOutDate, now);
  });

  // Find upcoming bookings (future check-in)
  const upcomingBookings = bookings
    .filter((booking: Booking) => {
      const checkIn = booking.checkIn || booking.check_in;
      const status = (booking.status || '').toLowerCase();
      if (!checkIn || status === 'cancelled') return false;
      return isAfter(parseISO(checkIn), now);
    })
    .sort((a: Booking, b: Booking) => {
      const dateA = parseISO(a.checkIn || a.check_in || '');
      const dateB = parseISO(b.checkIn || b.check_in || '');
      return dateA.getTime() - dateB.getTime();
    });

  // Statistics
  const stats = {
    totalBookings: bookings.length,
    activeStays: activeBooking ? 1 : 0,
    upcomingStays: upcomingBookings.length,
    completedStays: bookings.filter((b: Booking) => (b.status || '').toLowerCase() === 'checked_out').length
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {t('guest.dashboard.welcome')}, {user?.firstName || user?.email?.split('@')[0]}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {t('guest.dashboard.subtitle') || 'Manage your reservations and explore properties'}
            </p>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Bookings */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('guest.dashboard.totalBookings')}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalBookings}</p>
              </div>
              <div className="bg-blue-100 rounded-lg p-3">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <Link
              to="/guest/bookings"
              className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              {t('common.viewAll')} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Active Stay */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('guest.dashboard.activeStay')}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.activeStays}</p>
              </div>
              <div className="bg-green-100 rounded-lg p-3">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
            {activeBooking && (
              <p className="mt-4 text-xs text-gray-500">
                {activeBooking.property?.name || activeBooking.Property?.name || 'Current Stay'}
              </p>
            )}
          </div>

          {/* Upcoming Stays */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('guest.dashboard.upcomingStays')}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.upcomingStays}</p>
              </div>
              <div className="bg-orange-100 rounded-lg p-3">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
            </div>
            {upcomingBookings.length > 0 && (
              <p className="mt-4 text-xs text-gray-500">
                Next: {format(parseISO(upcomingBookings[0].checkIn || upcomingBookings[0].check_in || ''), 'MMM d', { locale: currentLocale })}
              </p>
            )}
          </div>

          {/* Completed */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('guest.dashboard.completed') || 'Completed'}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.completedStays}</p>
              </div>
              <div className="bg-purple-100 rounded-lg p-3">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Navigation Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Browse Properties Card */}
          <a
            href="/guest/marketplace"
            className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition cursor-pointer"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Search className="h-6 w-6 text-blue-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">
                {t('guest.dashboard.browseProperties') || 'Browse Properties'}
              </h2>
            </div>
            <p className="text-sm text-gray-600">
              {t('guest.dashboard.exploreProperties') || 'Explore available properties and make a booking'}
            </p>
          </a>

          {/* My Bookings Card */}
          <a
            href="/guest/bookings"
            className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition cursor-pointer"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <Calendar className="h-6 w-6 text-green-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">
                {t('guest.dashboard.myBookings') || 'My Bookings'}
              </h2>
            </div>
            <p className="text-sm text-gray-600">
              {t('guest.dashboard.viewBookings') || 'View your current and upcoming reservations'}
            </p>
          </a>

          {/* My Profile Card */}
          <a
            href="/guest/profile"
            className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition cursor-pointer"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-100 rounded-lg">
                <User className="h-6 w-6 text-orange-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">
                {t('guest.dashboard.profile') || 'My Profile'}
              </h2>
            </div>
            <p className="text-sm text-gray-600">
              {t('guest.dashboard.manageProfile') || 'Manage your account and preferences'}
            </p>
          </a>


        </div>

        {/* Active Booking Card - if exists */}
        {activeBooking && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {t('guest.dashboard.currentStay') || 'Current Stay'}
            </h3>
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md p-6 text-white">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-1">
                    {activeBooking.property?.name || activeBooking.Property?.name || 'Your Stay'}
                  </h3>
                  <div className="flex items-center gap-2 text-blue-100">
                    <MapPin className="h-4 w-4" />
                    <span className="text-sm">
                      {activeBooking.property?.location || activeBooking.Property?.location || activeBooking.Property?.city || 'Location'}
                    </span>
                  </div>
                </div>
                <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold">
                  {t('guest.dashboard.active') || 'Active'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6">
                <div>
                  <p className="text-blue-100 text-xs mb-1">{t('guest.dashboard.checkIn')}</p>
                  <p className="font-semibold">
                    {format(parseISO(activeBooking.checkIn || activeBooking.check_in || ''), 'MMM d, yyyy', { locale: currentLocale })}
                  </p>
                </div>
                <div>
                  <p className="text-blue-100 text-xs mb-1">{t('guest.dashboard.checkOut')}</p>
                  <p className="font-semibold">
                    {format(parseISO(activeBooking.checkOut || activeBooking.check_out || ''), 'MMM d, yyyy', { locale: currentLocale })}
                  </p>
                </div>
              </div>

              {activeBooking.roomCategory || activeBooking.room_type ? (
                <div className="mt-4 pt-4 border-t border-white/20">
                  <p className="text-blue-100 text-xs mb-1">{t('guest.bookings.room')}</p>
                  <p className="font-semibold">{activeBooking.roomCategory || activeBooking.room_type}</p>
                </div>
              ) : null}

             
            </div>
          </div>
        )}

        {/* Upcoming Bookings List */}
        {upcomingBookings.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {t('guest.dashboard.upcomingBookings') || 'Upcoming Bookings'}
              </h3>
              <Link to="/guest/bookings" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                {t('common.viewAll')} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="space-y-4">
              {upcomingBookings.slice(0, 3).map((booking: Booking) => {
                const checkIn = booking.checkIn || booking.check_in || '';
                const checkOut = booking.checkOut || booking.check_out || '';
                const daysUntil = differenceInDays(parseISO(checkIn), now);

                return (
                  <Link
                    key={booking.id}
                    to={`/guest/bookings/${booking.id}`}
                    className="block bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">
                          {booking.property?.name || booking.Property?.name || 'Property'}
                        </h4>
                        <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
                          <MapPin className="h-4 w-4" />
                          <span>{booking.property?.location || booking.Property?.location || booking.Property?.city || 'Location'}</span>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>{format(parseISO(checkIn), 'MMM d', { locale: currentLocale })}</span>
                          </div>
                          <span>→</span>
                          <span>{format(parseISO(checkOut), 'MMM d, yyyy', { locale: currentLocale })}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${daysUntil <= 7 ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                          {daysUntil === 0 ? t('common.today') : `${daysUntil} ${daysUntil === 1 ? t('guest.dashboard.day') : t('common.days') || 'days'}`}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* No bookings message */}
        {bookings.length === 0 && (
          <div className="mt-8 bg-white rounded-lg shadow-sm p-12 text-center">
            <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {t('guest.bookings.noBookings') || 'No bookings yet'}
            </h3>
            <p className="text-gray-500 mb-6">
              {t('guest.bookings.startBooking') || 'Start exploring properties to make your first booking'}
            </p>
            <Link
              to="/guest/marketplace"
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              <Search className="h-5 w-5 mr-2" />
              {t('guest.dashboard.browseProperties')}
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
