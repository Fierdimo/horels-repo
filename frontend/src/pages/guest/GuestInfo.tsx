import { useTranslation } from 'react-i18next';
import { AlertCircle, Key } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function GuestInfo() {
  const { t } = useTranslation();
  const { logout } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">
            {t('guest.info.title') || 'Guest Access'}
          </h2>
          <p className="mt-2 text-gray-600">
            {t('guest.info.subtitle') || 'Token-based access required'}
          </p>
        </div>
        
        <div className="bg-white p-8 rounded-xl shadow-lg space-y-6">
          <div className="flex items-start gap-3">
            <Key className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                {t('guest.info.howToAccess') || 'How to access your booking'}
              </h3>
              <p className="text-sm text-gray-600">
                {t('guest.info.description') || 
                  'Guest access is provided through a unique token sent to your email. Please use the link from your booking confirmation email.'}
              </p>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm text-gray-600 mb-4">
              {t('guest.info.linkFormat') || 'Your access link should look like:'}
            </p>
            <div className="bg-gray-50 p-3 rounded-md font-mono text-xs text-gray-700">
              https://sw2platform.com/guest/YOUR_TOKEN
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm text-gray-600 mb-2">
              {t('guest.info.needHelp') || "Didn't receive your access link?"}
            </p>
            <a 
              href="mailto:support@sw2platform.com" 
              className="text-sm text-primary hover:text-primary/80 font-medium"
            >
              {t('common.contactSupport') || 'Contact Support'}
            </a>
          </div>

          <button
            onClick={logout}
            className="w-full py-2.5 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition"
          >
            {t('auth.logout') || 'Sign Out'}
          </button>
        </div>

        <p className="text-center text-xs text-gray-500">
          {t('guest.info.note') || 
            'Guest accounts are for viewing bookings only. If you are a property owner or hotel staff, please use the appropriate account type.'}
        </p>
      </div>
    </div>
  );
}
