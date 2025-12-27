import { Calendar, MapPin, QrCode, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import type { Booking } from '@/api/bookings';

interface ActiveStayCardProps {
  booking: Booking;
  hasProducts?: boolean;
  onRequestService?: () => void;
}

/**
 * Component to display current active stay information
 * Shows check-in/out dates, property details, and QR code
 */
export function ActiveStayCard({ booking, hasProducts = true, onRequestService }: ActiveStayCardProps) {
  const { t } = useTranslation();
  const checkInDate = new Date(booking.check_in || booking.check_in_date);
  const checkOutDate = new Date(booking.check_out || booking.check_out_date);
  const today = new Date();
  
  const daysRemaining = Math.ceil((checkOutDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const totalDays = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
  
  const isCheckingInSoon = checkInDate.getTime() > today.getTime() && 
    (checkInDate.getTime() - today.getTime()) < (24 * 60 * 60 * 1000);

  return (
    <div className="bg-gradient-to-br from-primary/10 to-blue-50 rounded-lg border-2 border-primary/20 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">
            {booking.status === 'checked_in' ? t('guest.dashboard.currentStay') || 'Current Stay' : t('guest.dashboard.upcomingStay') || 'Upcoming Stay'}
          </h3>
          <p className="text-sm text-gray-600">
            {t('guest.dashboard.bookingNumber') || 'Booking'} #{booking.id}
          </p>
        </div>
        
        {booking.status === 'confirmed' && isCheckingInSoon && (
          <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
            {t('guest.dashboard.checkInSoon') || 'Check-in Soon'}
          </span>
        )}
        {booking.status === 'checked_in' && (
          <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
            {t('guest.dashboard.active') || 'Active'}
          </span>
        )}
      </div>

      {/* Property Details */}
      <div className="bg-white rounded-lg p-4 mb-4">
        <div className="flex items-start gap-3 mb-3">
          <MapPin className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-gray-900">{booking.Property?.name}</h4>
            {booking.Property?.city && booking.Property?.country && (
              <p className="text-sm text-gray-600">
                {booking.Property.city}, {booking.Property.country}
              </p>
            )}
            {booking.Property?.address && (
              <p className="text-xs text-gray-500 mt-1">{booking.Property.address}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-3 border-t">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
              <Calendar className="h-4 w-4" />
              <span>{t('guest.dashboard.checkIn') || 'Check-in'}</span>
            </div>
            <p className="font-semibold text-gray-900">
              {format(checkInDate, 'MMM dd, yyyy')}
            </p>
            <p className="text-xs text-gray-500">
              {format(checkInDate, 'EEEE')}
            </p>
          </div>
          
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
              <Calendar className="h-4 w-4" />
              <span>{t('guest.dashboard.checkOut') || 'Check-out'}</span>
            </div>
            <p className="font-semibold text-gray-900">
              {format(checkOutDate, 'MMM dd, yyyy')}
            </p>
            <p className="text-xs text-gray-500">
              {format(checkOutDate, 'EEEE')}
            </p>
          </div>
        </div>

        {booking.status === 'checked_in' && (
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-amber-600" />
              <span className="text-gray-700">
                {daysRemaining} {daysRemaining === 1 ? (t('guest.dashboard.day') || 'day') : (t('guest.dashboard.daysRemaining') || 'days')} {t('guest.dashboard.remaining') || 'remaining'}
              </span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-500">
                {totalDays} {t('guest.dashboard.totalNights') || 'total nights'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Special Requests */}
      {booking.special_requests && (
        <div className="bg-white rounded-lg p-4 mb-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">{t('guest.dashboard.specialRequests') || 'Special Requests'}</h4>
          <p className="text-sm text-gray-600">{booking.special_requests}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {hasProducts && (
          <button
            onClick={onRequestService}
            className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            {t('guest.services.request') || 'Request Service'}
          </button>
        )}
        
        <button
          className={`px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors border border-gray-300 flex items-center gap-2 ${!hasProducts ? 'flex-1' : ''}`}
        >
          <QrCode className="h-4 w-4" />
          <span>{t('guest.dashboard.qrCode') || 'QR Code'}</span>
        </button>
      </div>
    </div>
  );
}
