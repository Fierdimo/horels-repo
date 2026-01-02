import { useQuery } from '@tanstack/react-query';
import { timeshareApi } from '@/api/timeshare';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { Calendar, MapPin, CreditCard, XCircle, CheckCircle, Clock, AlertCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export default function MyBookings() {
  const { data: bookings, isLoading, error } = useQuery({
    queryKey: ['myBookings'],
    queryFn: timeshareApi.getMyBookings
  });

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
        <ErrorMessage message="Error al cargar los bookings" />
      </div>
    );
  }

  const allBookings = Array.isArray(bookings) ? bookings : [];
  const pendingBookings = allBookings.filter((b: any) => b.status === 'pending_approval');
  const confirmedBookings = allBookings.filter((b: any) => b.status === 'confirmed');
  const cancelledBookings = allBookings.filter((b: any) => b.status === 'cancelled');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_approval':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-yellow-100 text-yellow-800">
            <Clock className="h-4 w-4 mr-1" />
            Pendiente
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800">
            <CheckCircle className="h-4 w-4 mr-1" />
            Confirmado
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-800">
            <XCircle className="h-4 w-4 mr-1" />
            Rechazado
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

  const BookingCard = ({ booking }: { booking: any }) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {booking.propertyName}
          </h3>
          <div className="flex items-center text-sm text-gray-500 gap-1">
            <MapPin className="h-4 w-4" />
            <span>{booking.propertyCity}, {booking.propertyCountry}</span>
          </div>
        </div>
        {getStatusBadge(booking.status)}
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
          <span className="text-gray-600">Habitación:</span>
          <span className="ml-2 font-medium">{booking.roomType || 'N/A'}</span>
        </div>
      </div>

      {/* Payment Info */}
      {booking.paymentMethod === 'CREDITS' && booking.creditsUsed && booking.creditsUsed > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded p-3 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <CreditCard className="h-4 w-4 text-purple-600" />
            <span className="font-semibold text-purple-900">
              Pagado con {booking.creditsUsed.toLocaleString()} créditos
            </span>
          </div>
        </div>
      )}

      {/* Rejection Reason */}
      {booking.status === 'cancelled' && booking.rejectionReason && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-900 mb-1">
                Motivo del rechazo:
              </p>
              <p className="text-sm text-red-700">{booking.rejectionReason}</p>
            </div>
          </div>
          {booking.paymentMethod === 'CREDITS' && booking.creditsUsed && (
            <div className="mt-2 pt-2 border-t border-red-200">
              <p className="text-xs text-red-600">
                ✓ Los {booking.creditsUsed.toLocaleString()} créditos han sido devueltos a tu balance
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <span className="text-xs text-gray-500">
          Creado: {format(parseISO(booking.createdAt), 'dd MMM yyyy HH:mm', { locale: es })}
        </span>
        <Link
          to={`/owner/bookings/${booking.id}`}
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          Ver detalles →
        </Link>
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
              <h1 className="text-3xl font-bold text-gray-900">Mis Bookings</h1>
              <p className="mt-1 text-sm text-gray-500">
                Todos tus bookings de marketplace
              </p>
            </div>
            <Calendar className="h-12 w-12 text-blue-600" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-yellow-500">
            <p className="text-sm text-gray-600">Pendientes</p>
            <p className="text-2xl font-bold text-gray-900">{pendingBookings.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-green-500">
            <p className="text-sm text-gray-600">Confirmados</p>
            <p className="text-2xl font-bold text-gray-900">{confirmedBookings.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-red-500">
            <p className="text-sm text-gray-600">Rechazados</p>
            <p className="text-2xl font-bold text-gray-900">{cancelledBookings.length}</p>
          </div>
        </div>

        {allBookings.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No tienes bookings aún
            </h3>
            <p className="text-gray-500 mb-6">
              Explora el marketplace para hacer tu primera reserva
            </p>
            <Link
              to="/owner/marketplace"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Explorar Marketplace
            </Link>
          </div>
        ) : (
          <>
            {/* Pending Bookings */}
            {pendingBookings.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Pendientes de Aprobación
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {pendingBookings.map((booking: any) => (
                    <BookingCard key={booking.id} booking={booking} />
                  ))}
                </div>
              </div>
            )}

            {/* Confirmed Bookings */}
            {confirmedBookings.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Confirmados
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {confirmedBookings.map((booking: any) => (
                    <BookingCard key={booking.id} booking={booking} />
                  ))}
                </div>
              </div>
            )}

            {/* Cancelled Bookings */}
            {cancelledBookings.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Rechazados
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {cancelledBookings.map((booking: any) => (
                    <BookingCard key={booking.id} booking={booking} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
