import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  CalendarDays,
  Users,
  Hotel,
  Mail,
  Printer,
  Download,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { getBooking, Booking, formatDateRange } from '../../api/v2/booking';

const BookingConfirmationPage: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  
  useEffect(() => {
    const loadBooking = async () => {
      if (!bookingId) {
        setError('ID de reserva no proporcionado');
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        const data = await getBooking(parseInt(bookingId));
        setBooking(data);
        
      } catch (err: any) {
        console.error('Error loading booking:', err);
        setError(err.response?.data?.message || err.message || 'Error al cargar la reserva');
      } finally {
        setLoading(false);
      }
    };
    
    loadBooking();
  }, [bookingId]);
  
  const handlePrint = () => {
    window.print();
  };
  
  const handleDownload = () => {
    alert('Descarga de PDF: Funcionalidad por implementar');
  };
  
  // Render loading state
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center min-h-[60vh]">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }
  
  // Render error state
  if (error || !booking) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="h-5 w-5" />
            <span>{error || 'No se pudo cargar la reserva'}</span>
          </div>
        </div>
        <button
          onClick={() => navigate('/marketplace/search-v2')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Volver a Búsqueda
        </button>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Success Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-8 text-center text-white mb-6">
        <CheckCircle className="h-20 w-20 mx-auto mb-4" />
        <h1 className="text-4xl font-bold mb-2">¡Reserva Confirmada!</h1>
        <p className="text-xl opacity-90">Su reserva ha sido procesada exitosamente</p>
      </div>
      
      {/* Confirmation Code */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center mb-6">
        <div className="text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
          Código de Confirmación
        </div>
        <div className="text-4xl font-bold tracking-widest text-blue-600 dark:text-blue-400 my-3">
          {booking.confirmationCode}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Por favor guarde este código para futuras referencias
        </p>
      </div>
      
      {/* Booking Details */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-2xl font-semibold mb-4 dark:text-white">Detalles de la Reserva</h2>
        
        <div className="border-t dark:border-gray-700 my-4"></div>
        
        {/* Property Information */}
        <div className="mb-6">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Propiedad</div>
          <div className="border dark:border-gray-700 rounded-lg p-4">
            <div className="flex gap-4">
              {booking.property.imageUrl && (
                <img
                  src={booking.property.imageUrl}
                  alt={booking.property.name}
                  className="w-24 h-24 object-cover rounded-lg"
                />
              )}
              <div className="flex-1">
                <h3 className="text-lg font-semibold dark:text-white">{booking.property.name}</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-2">{booking.property.location}</p>
                <div className="flex gap-2">
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full text-sm">
                    <Hotel className="h-4 w-4" />
                    {booking.roomCategory || booking.unit?.name || 'Unidad'}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    booking.source === 'TIMESHARE' 
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' 
                      : 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                  }`}>
                    {booking.source === 'TIMESHARE' ? 'Timeshare' : 'Hotel'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Stay Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CalendarDays className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Fechas de Estadía</span>
            </div>
            <div className="text-lg dark:text-white">
              {formatDateRange(booking.checkIn, booking.checkOut)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {booking.nights} noche{booking.nights > 1 ? 's' : ''}
            </div>
          </div>
          
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Huéspedes</span>
            </div>
            <div className="text-lg dark:text-white">
              {booking.guests} persona{booking.guests > 1 ? 's' : ''}
            </div>
          </div>
        </div>
        
        <div className="border-t dark:border-gray-700 my-4"></div>
        
        {/* Guest Information */}
        <div className="mb-6">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Información del Huésped</div>
          <div className="space-y-1">
            <div className="dark:text-white">
              <strong>Nombre:</strong> {booking.guest.name}
            </div>
            <div className="dark:text-white">
              <strong>Email:</strong> {booking.guest.email}
            </div>
            {booking.guest.phone && (
              <div className="dark:text-white">
                <strong>Teléfono:</strong> {booking.guest.phone}
              </div>
            )}
          </div>
        </div>
        
        <div className="border-t dark:border-gray-700 my-4"></div>
        
        {/* Payment Summary */}
        <div className="mb-4">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Resumen de Pago</div>
          <div className="flex justify-between mb-1 dark:text-white">
            <span>Créditos utilizados:</span>
            <span className="font-bold">
              {booking.payment.creditsUsed.toLocaleString()} créditos
            </span>
          </div>
          {booking.payment.cashPaid > 0 && (
            <div className="flex justify-between mb-1 dark:text-white">
              <span>Pago en efectivo:</span>
              <span className="font-bold">
                ${booking.payment.cashPaid.toLocaleString()}
              </span>
            </div>
          )}
          <div className="flex justify-between pt-2 mt-2 border-t dark:border-gray-700">
            <span className="text-lg font-semibold dark:text-white">Total:</span>
            <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {booking.payment.creditsUsed.toLocaleString()} créditos
              {booking.payment.cashPaid > 0 && ` + $${booking.payment.cashPaid.toLocaleString()}`}
            </span>
          </div>
        </div>
        
        {/* Special Requests */}
        {booking.specialRequests && (
          <>
            <div className="border-t dark:border-gray-700 my-4"></div>
            <div>
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Peticiones Especiales</div>
              <div className="text-sm whitespace-pre-wrap dark:text-white">
                {booking.specialRequests}
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Email Confirmation Notice */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-2 text-blue-800 dark:text-blue-400">
          <Mail className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <span className="text-sm">
            Se ha enviado un correo de confirmación a <strong>{booking.guest.email}</strong> con todos los detalles de su reserva.
          </span>
        </div>
      </div>
      
      {/* Important Information */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold mb-3 dark:text-white">Información Importante</h3>
        <div className="space-y-2 text-sm dark:text-gray-300">
          <p><strong>Check-in:</strong> El horario de check-in es a partir de las 15:00 hrs.</p>
          <p><strong>Check-out:</strong> El horario de check-out es hasta las 11:00 hrs.</p>
          <p><strong>Identificación:</strong> Debe presentar una identificación oficial con fotografía al momento del check-in.</p>
          <p><strong>Cancelación:</strong> Puede cancelar su reserva sin cargo hasta 24 horas antes del check-in. Los créditos serán reembolsados automáticamente.</p>
          <p><strong>Contacto:</strong> Si tiene alguna pregunta, puede contactarnos en soporte@ejemplo.com.</p>
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 justify-center">
        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white"
        >
          <Printer className="h-4 w-4" />
          Imprimir
        </button>
        <button
          onClick={handleDownload}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white"
        >
          <Download className="h-4 w-4" />
          Descargar PDF
        </button>
        <button
          onClick={() => navigate('/my-bookings')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Ver Mis Reservas
        </button>
        <button
          onClick={() => navigate('/marketplace/search-v2')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          Hacer Otra Reserva
        </button>
      </div>
      
      {/* Booking Status */}
      <div className="mt-6 text-center">
        <span className="inline-block px-4 py-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full font-medium">
          Estado: {booking.status}
        </span>
      </div>
    </div>
  );
};

export default BookingConfirmationPage;
