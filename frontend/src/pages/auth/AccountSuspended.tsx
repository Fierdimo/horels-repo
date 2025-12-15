import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { useAuth } from '@/hooks/useAuth';
import { ShieldOff, LogOut, Mail, AlertCircle, Info } from 'lucide-react';
import { LanguageSelector } from '@/components/common/LanguageSelector';

export default function AccountSuspended() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 py-8 px-4">
      {/* Language Selector - Fixed Top Right */}
      <div className="fixed top-4 right-4 z-50">
        <LanguageSelector />
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8 border-t-4 border-red-500">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
              <ShieldOff className="h-10 w-10 text-red-600" />
            </div>
            
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {t('auth.accountSuspendedTitle')}
              </h1>
              <p className="text-lg text-gray-600">
                {t('auth.accountSuspendedSubtitle')}
              </p>
            </div>
          </div>
        </div>

        {/* User Info Card */}
        {user && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Info className="h-5 w-5 mr-2 text-blue-600" />
              {t('auth.accountInfo')}
            </h2>
            <div className="space-y-3">
              <div className="flex items-center text-gray-700">
                <Mail className="h-5 w-5 mr-3 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">{t('auth.email')}</p>
                  <p className="font-medium">{user.email}</p>
                </div>
              </div>
              {user.firstName && user.lastName && (
                <div className="flex items-center text-gray-700">
                  <div className="h-5 w-5 mr-3" />
                  <div>
                    <p className="text-sm text-gray-500">{t('auth.name')}</p>
                    <p className="font-medium">{user.firstName} {user.lastName}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center text-gray-700">
                <div className="h-5 w-5 mr-3" />
                <div>
                  <p className="text-sm text-gray-500">{t('auth.role')}</p>
                  <p className="font-medium capitalize">{user.role}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reason Card */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-900 mb-2">
                {t('auth.whySuspendedTitle')}
              </h3>
              <p className="text-red-800 mb-4">
                {t('auth.whySuspendedMessage')}
              </p>
              <ul className="list-disc list-inside space-y-2 text-red-800 ml-2">
                <li>{t('auth.suspensionReason1')}</li>
                <li>{t('auth.suspensionReason2')}</li>
                <li>{t('auth.suspensionReason3')}</li>
                <li>{t('auth.suspensionReason4')}</li>
              </ul>
            </div>
          </div>
        </div>

        {/* What to do Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-start space-x-3">
            <Info className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                {t('auth.whatToDoTitle')}
              </h3>
              <p className="text-blue-800 mb-4">
                {t('auth.whySuspendedMessage')}
              </p>
              <ol className="list-decimal list-inside space-y-2 text-blue-800 ml-2">
                <li>{t('auth.whatToDoStep1')}</li>
                <li>{t('auth.whatToDoStep2')}</li>
                <li>{t('auth.whatToDoStep3')}</li>
                <li>{t('auth.whatToDoStep4')}</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Contact Support Card */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {t('auth.contactSupportTitle')}
          </h3>
          <p className="text-gray-700 mb-4">
            {t('auth.whySuspendedMessage')}
          </p>
          <div className="space-y-2 text-gray-700">
            <p>
              <strong>{t('auth.supportEmail')}</strong>{' '}
              <a href="mailto:support@sw2.com" className="text-blue-600 hover:underline">
                support@sw2.com
              </a>
            </p>
            <p>
              <strong>{t('auth.supportPhone')}</strong>{' '}
              <a href="tel:+1234567890" className="text-blue-600 hover:underline">
                +1 (234) 567-890
              </a>
            </p>
          </div>
        </div>

        {/* Logout Button */}
        <div className="flex justify-center">
          <button
            onClick={() => logout()}
            className="flex items-center space-x-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            <LogOut className="h-5 w-5" />
            <span>{t('auth.logout')}</span>
          </button>
        </div>

        {/* Footer Info */}
        <div className="text-center text-sm text-gray-500 pt-4">
          <p>{t('auth.accountId')} {user?.id}</p>
          <p className="mt-1">{t('auth.securityWarning')}</p>
        </div>
      </div>
    </div>
  );
}
