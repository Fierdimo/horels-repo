import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { Calendar, MapPin, CheckCircle, XCircle, Clock, Loader2, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { bookingsApi, type Booking } from '@/api/bookings';
import { useState, useEffect } from 'react';
import axios from 'axios';

export default function GuestBookings() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [propertiesWithProducts, setPropertiesWithProducts] = useState<Set<number>>(new Set());

  // Get all bookings
  const { data, isLoading } = useQuery({
    queryKey: ['myBookings'],
    queryFn: bookingsApi.getMyBookings,
    enabled: !!user?.id,
  });

  const bookings = data?.bookings || [];

  // Check which properties have products available
  useEffect(() => {
    const checkProducts = async () => {
      const propertyIds = [...new Set(bookings.map(b => b.property_id).filter(Boolean))];
      const propertiesWithAvailableProducts = new Set<number>();

      await Promise.all(
        propertyIds.map(async (propertyId) => {
          try {
            const response = await axios.get(`/api/public/properties/${propertyId}/products`);
            if (response.data.data && response.data.data.length > 0) {
              propertiesWithAvailableProducts.add(propertyId);
            }
          } catch (error) {
            // Property has no products or error occurred
          }
        })
      );

      setPropertiesWithProducts(propertiesWithAvailableProducts);
    };

    if (bookings.length > 0) {
      checkProducts();
    }
  }, [bookings]);

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
      case 'checked_out': return <FileText className="h-4 w-4" />;
      case 'cancelled': return <XCircle className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      default: return <Calendar className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {t('guest.dashboard.myBookings') || 'My Bookings'}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {t('guest.bookings.subtitle') || 'View and manage all your reservations'}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {/* Bookings List */}
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {t('guest.bookings.noBookings') || 'No bookings found'}
            </h3>
            <p className="text-gray-500 mb-6">
              {selectedStatus === 'all'
                ? t('guest.bookings.startBooking') || 'Start exploring properties to make your first booking'
                : t('guest.bookings.noBookingsStatus') || `No bookings with status: ${selectedStatus}`}
            </p>
            {selectedStatus === 'all' && (
              <button
                onClick={() => window.location.href = '/guest/marketplace'}
                className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary/90 transition"
              >
                {t('guest.dashboard.browseProperties') || 'Browse Properties'}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <BookingCard 
                key={booking.id} 
                booking={booking} 
                t={t} 
                getStatusColor={getStatusColor} 
                getStatusIcon={getStatusIcon}
                hasProducts={propertiesWithProducts.has(booking.property_id)}
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
  hasProducts: boolean;
}

function BookingCard({ booking, t, getStatusColor, getStatusIcon, hasProducts }: BookingCardProps) {
  const checkInDate = new Date(booking.check_in || booking.check_in_date);
  const checkOutDate = new Date(booking.check_out || booking.check_out_date);
  const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-xl font-semibold text-gray-900">
                {booking.Property?.name || t('common.property')}
              </h3>
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(booking.status)}`}>
                {getStatusIcon(booking.status)}
                {booking.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
            {booking.Property && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="h-4 w-4" />
                <span>
                  {booking.Property.city && booking.Property.country
                    ? `${booking.Property.city}, ${booking.Property.country}`
                    : booking.Property.location || 'N/A'}
                </span>
              </div>
            )}
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">{t('guest.bookings.bookingId') || 'Booking'} #{booking.id}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4 border-t border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-500 mb-1">{t('guest.booking.checkIn') || 'Check-in'}</p>
            <p className="font-semibold text-gray-900">{format(checkInDate, 'MMM dd, yyyy')}</p>
            <p className="text-xs text-gray-500">{format(checkInDate, 'EEEE')}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">{t('guest.booking.checkOut') || 'Check-out'}</p>
            <p className="font-semibold text-gray-900">{format(checkOutDate, 'MMM dd, yyyy')}</p>
            <p className="text-xs text-gray-500">{format(checkOutDate, 'EEEE')}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">{t('guest.bookings.duration') || 'Duration'}</p>
            <p className="font-semibold text-gray-900">
              {nights} {nights === 1 ? t('common.night') || 'night' : t('common.nights') || 'nights'}
            </p>
            {booking.room_type && (
              <p className="text-xs text-gray-500">{booking.room_type}</p>
            )}
          </div>
        </div>

        {booking.special_requests && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">{t('guest.bookings.specialRequests') || 'Special Requests'}</p>
            <p className="text-sm text-gray-900">{booking.special_requests}</p>
          </div>
        )}

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
          <div>
            {booking.total_amount && (
              <p className="text-lg font-bold text-gray-900">
                {booking.currency || 'EUR'} {Number(booking.total_amount).toFixed(2)}
              </p>
            )}
            {booking.payment_method && (
              <p className="text-xs text-gray-500">
                {t('guest.bookings.paidWith') || 'Paid with'}: {booking.payment_method}
              </p>
            )}
          </div>
          {hasProducts && (booking.status === 'confirmed' || booking.status === 'checked_in') && (
            <button
              onClick={() => window.location.href = `/guest/bookings/${booking.id}/services`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              {t('guest.services.request') || 'Request Service'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
