import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useBooking } from '@/hooks/useBooking';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { ArrowLeft, MapPin, Calendar, Users, DollarSign, Home } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export default function BookingDetails() {
  const { t } = useTranslation();
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { booking, isLoading, error } = useBooking(bookingId!);

  if (isLoading) {
    return <LoadingSpinner size="lg" />;
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ErrorMessage 
          message={t('common.error')} 
          error={error as Error}
        />
      </div>
    );
  }

  const checkInDate = parseISO(booking.check_in);
  const checkOutDate = parseISO(booking.check_out);
  const nights = Math.ceil(
    (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const statusColors: Record<string, { bg: string; text: string }> = {
    confirmed: { bg: 'bg-green-100', text: 'text-green-800' },
    checked_in: { bg: 'bg-blue-100', text: 'text-blue-800' },
    checked_out: { bg: 'bg-gray-100', text: 'text-gray-800' },
    cancelled: { bg: 'bg-red-100', text: 'text-red-800' }
  };

  const statusColor = statusColors[booking.status] || { bg: 'bg-gray-100', text: 'text-gray-800' };

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      confirmed: 'Confirmado',
      checked_in: 'Check-in realizado',
      checked_out: 'Check-out realizado',
      cancelled: 'Cancelado'
    };
    return statusMap[status] || status;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/owner/weeks')}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('guest.booking.details')}
          </h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Property Section */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Home className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold text-gray-900">
                    {booking.Property?.name}
                  </h2>
                </div>
                <div className="flex items-center gap-2 text-gray-600 ml-7">
                  <MapPin className="h-4 w-4" />
                  <span>
                    {booking.Property?.location}, {booking.Property?.city},{' '}
                    {booking.Property?.country}
                  </span>
                </div>
                {booking.Property?.stars && (
                  <div className="ml-7 mt-1 flex items-center gap-1">
                    {Array.from({ length: booking.Property.stars }).map((_, i) => (
                      <span key={i} className="text-yellow-400">
                        ★
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-right">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-semibold ${statusColor.bg} ${statusColor.text}`}
                >
                  {getStatusLabel(booking.status)}
                </span>
              </div>
            </div>
          </div>

          {/* Booking Details */}
          <div className="p-6 border-b border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Check-in */}
            <div>
              <label className="text-sm font-semibold text-gray-500 uppercase">
                {t('guest.booking.checkIn')}
              </label>
              <div className="flex items-center gap-2 mt-2">
                <Calendar className="h-5 w-5 text-primary" />
                <span className="text-lg text-gray-900">
                  {format(checkInDate, 'EEEE, d MMMM yyyy', { locale: es })}
                </span>
              </div>
            </div>

            {/* Check-out */}
            <div>
              <label className="text-sm font-semibold text-gray-500 uppercase">
                {t('guest.booking.checkOut')}
              </label>
              <div className="flex items-center gap-2 mt-2">
                <Calendar className="h-5 w-5 text-primary" />
                <span className="text-lg text-gray-900">
                  {format(checkOutDate, 'EEEE, d MMMM yyyy', { locale: es })}
                </span>
              </div>
            </div>

            {/* Nights */}
            <div>
              <label className="text-sm font-semibold text-gray-500 uppercase">
                {t('common.nights')}
              </label>
              <p className="mt-2 text-lg text-gray-900">{nights} noches</p>
            </div>

            {/* Room Type */}
            <div>
              <label className="text-sm font-semibold text-gray-500 uppercase">
                {t('guest.booking.roomType')}
              </label>
              <p className="mt-2 text-lg text-gray-900">{booking.room_type}</p>
            </div>
          </div>

          {/* Guest Information */}
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Información del huésped
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">{t('guest.booking.guestName')}</label>
                <p className="mt-1 text-gray-900">{booking.guest_name}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Email</label>
                <p className="mt-1 text-gray-900 break-all">{booking.guest_email}</p>
              </div>
            </div>
          </div>

          {/* Total Amount */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                {t('common.total')}
              </h3>
              <span className="text-2xl font-bold text-primary">
                €{(Number(booking.total_amount) || 0).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Services (if any) */}
          {booking.Services && booking.Services.length > 0 && (
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Servicios adicionales
              </h3>
              <div className="space-y-3">
                {booking.Services.map((service) => (
                  <div
                    key={service.id}
                    className="flex justify-between items-center pb-3 border-b border-gray-100 last:border-b-0"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{service.service_type}</p>
                      {service.notes && (
                        <p className="text-sm text-gray-600">{service.notes}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        Estado: {service.status}
                      </p>
                      {service.quantity > 1 && (
                        <p className="text-sm text-gray-500">
                          Cantidad: {service.quantity}
                        </p>
                      )}
                    </div>
                    <span className="text-gray-900 font-medium">
                      €{(service.price * service.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Booking Reference */}
          {booking.pms_booking_id && (
            <div className="p-6 bg-gray-50 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Referencia de reserva: <span className="font-mono">{booking.pms_booking_id}</span>
              </p>
            </div>
          )}
        </div>

        {/* Back Button */}
        <div className="mt-8">
          <button
            onClick={() => navigate('/owner/weeks')}
            className="px-4 py-2 text-primary hover:text-primary/80 font-medium"
          >
            ← {t('common.back')}
          </button>
        </div>
      </main>
    </div>
  );
}
