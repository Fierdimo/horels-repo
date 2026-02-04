import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CalendarDays,
  Users,
  Hotel,
  CreditCard,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { createBooking, CreateBookingRequest, BookingSource } from '../../api/v2/booking';
import { getCreditBalance } from '../../api/v2/credits';
import toast from 'react-hot-toast';

interface SearchResultDetails {
  source: BookingSource;
  weekAllocationId?: number;
  propertyId: number;
  propertyName: string;
  propertyLocation: string;
  propertyImage?: string;
  roomCategory?: string;
  unitName?: string;
  unitType?: string;
  capacity: number;
  checkIn: string;
  checkOut: string;
  nights: number;
  creditsRequired: number;
  cashRequired?: number;
}

const BookingPageV2: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // URL parameters
  const source = searchParams.get('source')?.toUpperCase() as BookingSource;
  const weekId = searchParams.get('weekId');
  const propertyId = searchParams.get('propertyId');
  const category = searchParams.get('category');
  const checkIn = searchParams.get('checkIn');
  const checkOut = searchParams.get('checkOut');
  const guests = searchParams.get('guests');
  
  // State
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResultDetails | null>(null);
  const [creditBalance, setCreditBalance] = useState<number>(0);
  
  // Form state
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  
  // Load booking details and credit balance
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Validate URL params
        if (!source || !checkIn || !checkOut || !guests) {
          throw new Error('Faltan parámetros requeridos en la URL');
        }
        
        if (source === 'TIMESHARE' && !weekId) {
          throw new Error('Week ID requerido para reservas timeshare');
        }
        
        if (source === 'HOTEL_PMS' && (!propertyId || !category)) {
          throw new Error('Property ID y categoría requeridos para reservas hotel');
        }
        
        // Load search result details
        const nights = Math.ceil(
          (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)
        );
        
        // Mock result details - in production, fetch from search API
        const mockResult: SearchResultDetails = {
          source,
          weekAllocationId: weekId ? parseInt(weekId) : undefined,
          propertyId: propertyId ? parseInt(propertyId) : 0,
          propertyName: 'Propiedad de Ejemplo',
          propertyLocation: 'Ubicación de Ejemplo',
          roomCategory: category || undefined,
          unitName: category || 'Unidad de Ejemplo',
          unitType: source === 'TIMESHARE' ? 'Propiedad Timeshare' : 'Habitación Hotel',
          capacity: parseInt(guests),
          checkIn,
          checkOut,
          nights,
          creditsRequired: nights * 150, // Mock calculation
          cashRequired: source === 'HOTEL_PMS' ? nights * 50 : undefined,
        };
        
        setResult(mockResult);
        
        // Load credit balance
        const balance = await getCreditBalance();
        setCreditBalance(balance.balance);
        
      } catch (err: any) {
        console.error('Error loading booking details:', err);
        setError(err.message || 'Error al cargar los detalles de la reserva');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [source, weekId, propertyId, category, checkIn, checkOut, guests]);
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!result) {
      setError('No hay detalles de reserva disponibles');
      return;
    }
    
    // Validate form
    if (!guestName.trim()) {
      setError('El nombre es requerido');
      return;
    }
    
    if (!guestEmail.trim()) {
      setError('El email es requerido');
      return;
    }
    
    if (!agreedToTerms) {
      setError('Debe aceptar los términos y condiciones');
      return;
    }
    
    // Check credit balance
    if (creditBalance < result.creditsRequired) {
      setError(`Créditos insuficientes. Necesita ${result.creditsRequired} créditos pero solo tiene ${creditBalance}`);
      return;
    }
    
    try {
      setSubmitting(true);
      setError(null);
      
      // Build request
      const request: CreateBookingRequest = {
        source: result.source,
        weekAllocationId: result.weekAllocationId,
        propertyId: result.propertyId,
        roomCategory: result.roomCategory,
        guestId: 1, // TODO: Get from user context
        guestName: guestName.trim(),
        guestEmail: guestEmail.trim(),
        guestPhone: guestPhone.trim() || undefined,
        checkIn: result.checkIn,
        checkOut: result.checkOut,
        nights: result.nights,
        guests: result.capacity,
        creditsToUse: result.creditsRequired,
        cashAmount: result.cashRequired,
        specialRequests: specialRequests.trim() || undefined,
      };
      
      // Create booking
      const response = await createBooking(request);
      
      toast.success('Reserva creada exitosamente');
      
      // Navigate to confirmation page
      navigate(`/booking/confirmation/${response.data.id}`);
      
    } catch (err: any) {
      console.error('Error creating booking:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Error al crear la reserva';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
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
  if (error && !result) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
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
  
  if (!result) {
    return null;
  }
  
  // Check if user has sufficient credits
  const hasInsufficientCredits = creditBalance < result.creditsRequired;
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <h1 className="text-3xl font-bold mb-6 dark:text-white">Confirmar Reserva</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Booking form */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Property Summary */}
              <div>
                <h2 className="text-xl font-semibold mb-4 dark:text-white">Detalles de la Propiedad</h2>
                <div className="border dark:border-gray-700 rounded-lg p-4">
                  <div className="flex gap-4">
                    {result.propertyImage && (
                      <img
                        src={result.propertyImage}
                        alt={result.propertyName}
                        className="w-32 h-32 object-cover rounded-lg"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold dark:text-white">{result.propertyName}</h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-2">{result.propertyLocation}</p>
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm">
                          <Hotel className="h-4 w-4" />
                          {result.unitName}
                        </span>
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full text-sm">
                          <Users className="h-4 w-4" />
                          Hasta {result.capacity} huéspedes
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Stay Details */}
              <div>
                <h2 className="text-xl font-semibold mb-4 dark:text-white">Detalles de la Estadía</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    <div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Check-in</div>
                      <div className="font-medium dark:text-white">
                        {new Date(result.checkIn).toLocaleDateString('es-ES', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    <div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Check-out</div>
                      <div className="font-medium dark:text-white">
                        {new Date(result.checkOut).toLocaleDateString('es-ES', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  {result.nights} noche{result.nights > 1 ? 's' : ''} • {result.capacity} huésped{result.capacity > 1 ? 'es' : ''}
                </p>
              </div>
              
              <div className="border-t dark:border-gray-700"></div>
              
              {/* Guest Information */}
              <div>
                <h2 className="text-xl font-semibold mb-4 dark:text-white">Información del Huésped</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 dark:text-gray-300">Nombre completo *</label>
                    <input
                      type="text"
                      required
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="Juan Pérez"
                      className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1 dark:text-gray-300">Email *</label>
                      <input
                        type="email"
                        required
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        placeholder="juan@ejemplo.com"
                        className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 dark:text-gray-300">Teléfono (opcional)</label>
                      <input
                        type="tel"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        placeholder="+52 123 456 7890"
                        className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Special Requests */}
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Peticiones especiales (opcional)</label>
                <textarea
                  rows={3}
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder="Cama extra, preferencia de piso, restricciones alimentarias, etc."
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              
              <div className="border-t dark:border-gray-700"></div>
              
              {/* Terms and Conditions */}
              <div>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-1"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Acepto los{' '}
                    <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      términos y condiciones
                    </a>{' '}
                    y la{' '}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      política de privacidad
                    </a>
                  </span>
                </label>
              </div>
              
              {/* Error Alert */}
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-800 dark:text-red-400">
                    <AlertCircle className="h-5 w-5" />
                    <span>{error}</span>
                  </div>
                </div>
              )}
              
              {/* Insufficient Credits Warning */}
              {hasInsufficientCredits && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-yellow-800 dark:text-yellow-400">
                    <span className="text-sm">
                      No tiene suficientes créditos. Necesita {result.creditsRequired} créditos pero solo tiene {creditBalance}.
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate('/credits/purchase')}
                      className="px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 whitespace-nowrap text-sm"
                    >
                      Comprar Créditos
                    </button>
                  </div>
                </div>
              )}
              
              {/* Submit Button */}
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/marketplace/search-v2')}
                  disabled={submitting}
                  className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 dark:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || hasInsufficientCredits || !agreedToTerms}
                  className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    'Confirmar Reserva'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
        
        {/* Right column - Payment summary */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 sticky top-20">
            <h2 className="text-xl font-semibold mb-4 dark:text-white">Resumen de Pago</h2>
            
            <div className="border-t border-b dark:border-gray-700 py-4 my-4">
              {/* Credit Balance */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <span className="dark:text-gray-300">Balance Actual</span>
                </div>
                <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {creditBalance.toLocaleString()}
                </span>
              </div>
            </div>
            
            {/* Credits to Use */}
            <div className="flex justify-between mb-2">
              <span className="dark:text-gray-300">Créditos a usar:</span>
              <span className="font-bold dark:text-white">
                {result.creditsRequired.toLocaleString()}
              </span>
            </div>
            
            {/* Cash Payment (hotels only) */}
            {result.cashRequired && (
              <div className="flex justify-between mb-2">
                <span className="dark:text-gray-300">Pago en efectivo:</span>
                <span className="font-bold dark:text-white">
                  ${result.cashRequired.toLocaleString()}
                </span>
              </div>
            )}
            
            <div className="border-t dark:border-gray-700 my-4"></div>
            
            {/* Remaining Balance */}
            <div className="flex justify-between items-center">
              <span className="dark:text-gray-300">Balance después:</span>
              <span className={`text-xl font-bold ${
                creditBalance - result.creditsRequired < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
              }`}>
                {(creditBalance - result.creditsRequired).toLocaleString()}
              </span>
            </div>
            
            {/* Booking Type Badge */}
            <div className="mt-4">
              <span className={`inline-block px-3 py-1 rounded-full text-sm ${
                result.source === 'TIMESHARE' 
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' 
                  : 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
              }`}>
                {result.source === 'TIMESHARE' ? 'Timeshare' : 'Hotel'}
              </span>
            </div>
            
            {/* Cancellation Policy */}
            <div className="mt-4 text-xs text-gray-600 dark:text-gray-400">
              <strong>Política de cancelación:</strong> Puede cancelar sin cargo hasta 24 horas antes del check-in. Los créditos serán reembolsados automáticamente.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingPageV2;
