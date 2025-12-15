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
  const state = location.state as { paymentIntentId: string } || {};

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

  // Si no hay paymentIntentId, mostrar error
  if (!state?.paymentIntentId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">{t('common.error')}</h2>
          <p className="text-gray-700 mb-6">{t('marketplace.noBookingInfo')}</p>
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
          <h1 className="text-3xl font-bold text-center mb-4">{t('marketplace.bookingSuccessTitle')}</h1>
          <p className="text-gray-600 text-center mb-8">
            {t('marketplace.bookingSuccessMessage')}
          </p>

          {/* Payment Intent Info */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">{t('marketplace.bookingDetails')}</h2>
            <div className="space-y-3">
              <div className="flex items-center text-gray-700">
                <Mail className="w-5 h-5 mr-3 text-gray-400" />
                <span>{t('marketplace.confirmationEmailSent')}</span>
              </div>
              <div className="text-sm text-gray-600">
                {t('marketplace.paymentId')}: {state.paymentIntentId}
              </div>
            </div>
          </div>

          {/* Next Steps */}
          <div className="border-t pt-6">
            <h2 className="text-xl font-bold mb-4">{t('marketplace.nextSteps')}</h2>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-start">
                <CheckCircle className="w-5 h-5 mr-3 text-green-600 flex-shrink-0 mt-0.5" />
                <span>{t('marketplace.nextStep1')}</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="w-5 h-5 mr-3 text-green-600 flex-shrink-0 mt-0.5" />
                <span>{t('marketplace.nextStep2')}</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="w-5 h-5 mr-3 text-green-600 flex-shrink-0 mt-0.5" />
                <span>{t('marketplace.nextStep3')}</span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mt-8">
            <button
              onClick={() => navigate(getMarketplaceBasePath())}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center"
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
