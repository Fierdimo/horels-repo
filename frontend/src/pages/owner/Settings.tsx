import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, Bell, Mail, CreditCard, Calendar, Save, CheckCircle, AlertCircle } from 'lucide-react';
import { authApi } from '@/api/auth';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

export default function SettingsPage() {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const data = await authApi.getPreferences();
      setPreferences(data);
    } catch (err: any) {
      setError('Failed to load preferences');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = (field: string) => {
    setPreferences((prev: any) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await authApi.updatePreferences(preferences);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Settings className="h-8 w-8 text-blue-600" />
            {t('userSettings.title')}
          </h1>
          <p className="text-gray-600 mt-2">
            {t('userSettings.subtitle')}
          </p>
        </div>

        {/* Email Notifications Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <Mail className="h-6 w-6 text-blue-600" />
            {t('userSettings.emailNotifications')}
          </h2>

          <div className="space-y-4">
            {/* Master Email Toggle */}
            <div className="flex items-center justify-between py-3 border-b border-gray-200">
              <div>
                <h3 className="font-medium text-gray-900">
                  {t('userSettings.emailNotificationsEnabled')}
                </h3>
                <p className="text-sm text-gray-600">
                  {t('userSettings.emailNotificationsDesc')}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences?.email_notifications || false}
                  onChange={() => handleToggle('email_notifications')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Swap Notifications */}
            <div className="flex items-center justify-between py-3">
              <div>
                <h3 className="font-medium text-gray-900">
                  {t('userSettings.swapNotifications')}
                </h3>
                <p className="text-sm text-gray-600">
                  {t('userSettings.swapNotificationsDesc')}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences?.swap_notifications || false}
                  onChange={() => handleToggle('swap_notifications')}
                  className="sr-only peer"
                  disabled={!preferences?.email_notifications}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
              </label>
            </div>

            {/* Booking Notifications */}
            <div className="flex items-center justify-between py-3">
              <div>
                <h3 className="font-medium text-gray-900">
                  {t('userSettings.bookingNotifications')}
                </h3>
                <p className="text-sm text-gray-600">
                  {t('userSettings.bookingNotificationsDesc')}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences?.booking_notifications || false}
                  onChange={() => handleToggle('booking_notifications')}
                  className="sr-only peer"
                  disabled={!preferences?.email_notifications}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
              </label>
            </div>

            {/* Credit Expiry Alerts */}
            <div className="flex items-center justify-between py-3">
              <div>
                <h3 className="font-medium text-gray-900">
                  {t('userSettings.creditExpiryAlerts')}
                </h3>
                <p className="text-sm text-gray-600">
                  {t('userSettings.creditExpiryAlertsDesc')}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences?.credit_expiry_alerts || false}
                  onChange={() => handleToggle('credit_expiry_alerts')}
                  className="sr-only peer"
                  disabled={!preferences?.email_notifications}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
              </label>
            </div>

            {/* Weekly Summary */}
            <div className="flex items-center justify-between py-3">
              <div>
                <h3 className="font-medium text-gray-900">
                  {t('userSettings.weeklySummary')}
                </h3>
                <p className="text-sm text-gray-600">
                  {t('userSettings.weeklySummaryDesc')}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences?.weekly_summary || false}
                  onChange={() => handleToggle('weekly_summary')}
                  className="sr-only peer"
                  disabled={!preferences?.email_notifications}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
              </label>
            </div>

            {/* Marketing Emails */}
            <div className="flex items-center justify-between py-3">
              <div>
                <h3 className="font-medium text-gray-900">
                  {t('userSettings.marketingEmails')}
                </h3>
                <p className="text-sm text-gray-600">
                  {t('userSettings.marketingEmailsDesc')}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences?.marketing_emails || false}
                  onChange={() => handleToggle('marketing_emails')}
                  className="sr-only peer"
                  disabled={!preferences?.email_notifications}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 flex items-start gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-800">
              {t('userSettings.preferencesSaved')}
            </p>
          </div>
        )}

        {error && (
          <div className="mb-6 flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <LoadingSpinner size="sm" />
                {t('common.saving')}
              </>
            ) : (
              <>
                <Save className="h-5 w-5" />
                {t('common.saveChanges')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
