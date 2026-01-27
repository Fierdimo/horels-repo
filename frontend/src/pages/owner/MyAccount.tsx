import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useProfile } from '@/hooks/useProfile';
import { authApi } from '@/api/auth';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import PaymentMethodSetup from '@/components/owner/PaymentMethodSetup';
import ChangePasswordModal from '@/components/owner/ChangePasswordModal';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Lock, 
  Bell, 
  CreditCard,
  Save,
  X,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

export default function MyAccount() {
  const { t } = useTranslation();
  const { profile, isLoading: profileLoading, updateProfile, isUpdating } = useProfile();
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'payment'>('profile');
  
  // Profile state
  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: ''
  });

  // Notifications state
  const [preferences, setPreferences] = useState<any>(null);
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load profile data
  useEffect(() => {
    if (profile) {
      setFormData({
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        email: profile.email || '',
        phone: profile.phone || '',
        address: profile.address || ''
      });
    }
  }, [profile]);

  // Load preferences
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const data = await authApi.getPreferences();
      setPreferences(data);
    } catch (err: any) {
      setError('Error al cargar preferencias');
    } finally {
      setPreferencesLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async () => {
    try {
      await updateProfile({
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        address: formData.address
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Error al actualizar perfil:', error);
    }
  };

  const handleCancelEdit = () => {
    if (profile) {
      setFormData({
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        email: profile.email || '',
        phone: profile.phone || '',
        address: profile.address || ''
      });
    }
    setIsEditing(false);
  };

  const handleTogglePreference = (field: string) => {
    setPreferences((prev: any) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleSavePreferences = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await authApi.updatePreferences(preferences);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar preferencias');
    } finally {
      setIsSaving(false);
    }
  };

  if (profileLoading || preferencesLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold mb-2">{t('owner.account.title')}</h1>
          <p className="text-blue-100">{t('owner.account.subtitle')}</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-md mb-6">
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab('profile')}
                className={`px-6 py-4 font-medium border-b-2 transition-colors ${
                  activeTab === 'profile'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <User className="inline h-5 w-5 mr-2" />
                {t('owner.account.personalInfo')}
              </button>
              <button
                onClick={() => setActiveTab('notifications')}
                className={`px-6 py-4 font-medium border-b-2 transition-colors ${
                  activeTab === 'notifications'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Bell className="inline h-5 w-5 mr-2" />
                {t('owner.account.notifications')}
              </button>
              <button
                onClick={() => setActiveTab('payment')}
                className={`px-6 py-4 font-medium border-b-2 transition-colors ${
                  activeTab === 'payment'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <CreditCard className="inline h-5 w-5 mr-2" />
                {t('owner.account.paymentMethod')}
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* PROFILE TAB */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                {/* Actions */}
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-gray-900">{t('owner.account.personalData')}</h2>
                  {!isEditing ? (
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowPasswordModal(true)}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
                      >
                        <Lock className="h-5 w-5" />
                        {t('userSettings.changePassword')}
                      </button>
                      <button
                        onClick={() => setIsEditing(true)}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                      >
                        {t('common.edit')}
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <button
                        onClick={handleCancelEdit}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
                        disabled={isUpdating}
                      >
                        <X className="h-5 w-5" />
                        {t('common.cancel')}
                      </button>
                      <button
                        onClick={handleSaveProfile}
                        className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center gap-2"
                        disabled={isUpdating}
                      >
                        <Save className="h-5 w-5" />
                        {isUpdating ? t('common.saving') : t('common.save')}
                      </button>
                    </div>
                  )}
                </div>

                {/* Form */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('owner.profile.firstName')}
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    ) : (
                      <p className="text-gray-900 py-2">{formData.firstName || '—'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('owner.profile.lastName')}
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    ) : (
                      <p className="text-gray-900 py-2">{formData.lastName || '—'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Mail className="inline h-4 w-4 mr-1" />
                      {t('owner.account.email')}
                    </label>
                    <p className="text-gray-900 py-2">{formData.email}</p>
                    <p className="text-xs text-gray-500">{t('owner.account.emailCannotChange')}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Phone className="inline h-4 w-4 mr-1" />
                      {t('owner.profile.phone')}
                    </label>
                    {isEditing ? (
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    ) : (
                      <p className="text-gray-900 py-2">{formData.phone || '—'}</p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <MapPin className="inline h-4 w-4 mr-1" />
                      {t('owner.profile.address')}
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        name="address"
                        value={formData.address}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    ) : (
                      <p className="text-gray-900 py-2">{formData.address || '—'}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* NOTIFICATIONS TAB */}
            {activeTab === 'notifications' && preferences && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-gray-900">{t('owner.account.notificationPreferences')}</h2>
                  <button
                    onClick={handleSavePreferences}
                    disabled={isSaving}
                    className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center gap-2 disabled:opacity-50"
                  >
                    <Save className="h-5 w-5" />
                    {isSaving ? t('common.saving') : t('common.saveChanges')}
                  </button>
                </div>

                {/* Success/Error Messages */}
                {success && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-green-800">{t('owner.account.preferencesSaved')}</span>
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <span className="text-red-800">{error}</span>
                  </div>
                )}

                {/* Email Notifications */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    <Mail className="inline h-5 w-5 mr-2 text-blue-600" />
                    {t('userSettings.emailNotifications')}
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <div>
                        <h4 className="font-medium text-gray-900">{t('userSettings.emailNotificationsEnabled')}</h4>
                        <p className="text-sm text-gray-600">{t('userSettings.emailNotificationsDesc')}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences?.email_notifications || false}
                          onChange={() => handleTogglePreference('email_notifications')}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <div>
                        <h4 className="font-medium text-gray-900">{t('userSettings.bookingNotifications')}</h4>
                        <p className="text-sm text-gray-600">{t('userSettings.bookingNotificationsDesc')}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences?.booking_notifications || false}
                          onChange={() => handleTogglePreference('booking_notifications')}
                          disabled={!preferences?.email_notifications}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <div>
                        <h4 className="font-medium text-gray-900">{t('userSettings.creditExpiryAlerts')}</h4>
                        <p className="text-sm text-gray-600">{t('userSettings.creditExpiryAlertsDesc')}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences?.credit_expiry_alerts || false}
                          onChange={() => handleTogglePreference('credit_expiry_alerts')}
                          disabled={!preferences?.email_notifications}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between py-3">
                      <div>
                        <h4 className="font-medium text-gray-900">{t('userSettings.swapNotifications')}</h4>
                        <p className="text-sm text-gray-600">{t('userSettings.swapNotificationsDesc')}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences?.swap_notifications || false}
                          onChange={() => handleTogglePreference('swap_notifications')}
                          disabled={!preferences?.email_notifications}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PAYMENT TAB */}
            {activeTab === 'payment' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-gray-900">{t('owner.account.paymentMethod')}</h2>
                <p className="text-gray-600">
                  {t('owner.account.paymentMethodDescription')}
                </p>
                <PaymentMethodSetup />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <ChangePasswordModal 
          isOpen={showPasswordModal}
          onClose={() => setShowPasswordModal(false)} 
        />
      )}
    </div>
  );
}
