import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/api/client';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { CheckCircle, Calendar, Mail, Phone, MapPin, Home } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useAuthStore } from '@/stores/authStore';

export default function BookingSuccess() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const state = location.state as { booking?: any; message?: string; type?: string } || {};

  console.log('📍 BookingSuccess state:', state);

  const getMarketplaceBasePath = () => {
    if (!user?.role) return '/guest/marketplace';
    switch (user.role) {
      case 'owner': return '/owner/marketplace';
      case 'staff': return '/staff/marketplace';
      case 'admin': return '/admin/marketplace';
      case 'guest': return '/guest/marketplace';
      default: return '/guest/marketplace';
    }
  };

  const getBookingsPath = () => {
    if (!user?.role) return '/guest/bookings';
    switch (user.role) {
      case 'owner': return '/owner/bookings';
      case 'staff': return '/staff/bookings';
      case 'admin': return '/admin/bookings';
      case 'guest': return '/guest/bookings';
      default: return '/guest/bookings';
    }
  };

  // Si no hay booking, mostrar error
  if (!state?.booking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">{t('common.error')}</h2>
          <p className="text-gray-700 mb-6">{t('marketplace.checkout.noBookingInfo')}</p>
          <button
            onClick={() => navigate(getMarketplaceBasePath())}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            {t('marketplace.backToMarketplace')}
          </button>
        </div>
      </div>
    );
  }

  const { booking } = state;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8">
          {/* Success Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
          </div>

          {/* Success Message */}
          <h1 className="text-3xl font-bold text-center mb-4">
            {t('marketplace.checkout.bookingSuccessTitle')}
          </h1>
          <p className="text-gray-600 text-center mb-2">
            {state.message || t('marketplace.checkout.bookingSuccessMessage')}
          </p>
          <p className="text-2xl font-bold text-center text-blue-600 mb-8">
            {booking.confirmationNumber}
          </p>

          {/* Booking Details */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">{t('marketplace.checkout.bookingDetails')}</h2>
            <div className="space-y-4">
              <div className="flex items-start">
                <Home className="w-5 h-5 mr-3 text-gray-400 mt-1" />
                <div>
                  <div className="font-semibold text-gray-900">{booking.property}</div>
                  <div className="text-sm text-gray-600">{booking.roomType}</div>
                </div>
              </div>
              
              <div className="flex items-center text-gray-700">
                <Calendar className="w-5 h-5 mr-3 text-gray-400" />
                <div>
                  <span className="font-medium">{t('marketplace.checkout.checkInLabel')}</span> {format(parseISO(booking.checkIn), 'PPP')}
                </div>
              </div>
              
              <div className="flex items-center text-gray-700">
                <Calendar className="w-5 h-5 mr-3 text-gray-400" />
                <div>
                  <span className="font-medium">{t('marketplace.checkout.checkOutLabel')}</span> {format(parseISO(booking.checkOut), 'PPP')}
                </div>
              </div>

              <div className="flex items-center text-gray-700">
                <MapPin className="w-5 h-5 mr-3 text-gray-400" />
                <div>
                  <span className="font-medium">{t('marketplace.checkout.guestsCount')}</span> {booking.guests}
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                {/* Payment Breakdown */}
                {booking.creditsUsed && booking.creditsUsed > 0 ? (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-purple-600">
                      <span className="font-medium">{t('marketplace.checkout.creditsUsed')}</span>
                      <span className="text-lg font-bold">{booking.creditsUsed.toLocaleString()} {t('marketplace.checkout.creditsLabel')}</span>
                    </div>
                    {booking.cashPaid && booking.cashPaid > 0 && (
                      <div className="flex justify-between items-center text-blue-600">
                        <span className="font-medium">{t('marketplace.checkout.cardPayment')}</span>
                        <span className="text-lg font-bold">€{booking.cashPaid.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-lg font-semibold">{t('marketplace.checkout.totalValue')}</span>
                      <span className="text-2xl font-bold text-green-600">
                        €{booking.totalAmount.toFixed(2)}
                      </span>
                    </div>
                    {booking.newCreditBalance !== undefined && (
                      <div className="text-sm text-gray-600 text-right">
                        {t('marketplace.checkout.newCreditBalance')} {booking.newCreditBalance.toLocaleString()} {t('marketplace.checkout.creditsLabel')}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold">{t('marketplace.checkout.totalPaid')}</span>
                    <span className="text-2xl font-bold text-green-600">
                      {booking.currency?.toUpperCase()} {booking.totalAmount.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Next Steps */}
          <div className="border-t pt-6">
            <h2 className="text-xl font-bold mb-4">{t('marketplace.checkout.nextSteps')}</h2>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-start">
                <CheckCircle className="w-5 h-5 mr-3 text-green-600 flex-shrink-0 mt-0.5" />
                <span>{t('marketplace.checkout.confirmationEmailSent')}</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="w-5 h-5 mr-3 text-green-600 flex-shrink-0 mt-0.5" />
                <span>{t('marketplace.checkout.viewManageBookings')}</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="w-5 h-5 mr-3 text-green-600 flex-shrink-0 mt-0.5" />
                <span>{t('marketplace.checkout.propertyWillContact')}</span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mt-8">
            <button
              onClick={() => navigate(getBookingsPath())}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center"
            >
              <Calendar className="w-5 h-5 mr-2" />
              {t('marketplace.checkout.viewMyBookings')}
            </button>
            <button
              onClick={() => navigate(getMarketplaceBasePath())}
              className="flex-1 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 flex items-center justify-center"
            >
              <Home className="w-5 h-5 mr-2" />
              {t('marketplace.backToMarketplace')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
