import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { useAuth } from '@/hooks/useAuth';
import { Clock, LogOut, User, Mail, Hotel, MapPin, Edit2, Save, X, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '@/api/auth';
import { LanguageSelector } from '@/components/common/LanguageSelector';

export default function PendingApproval() {
  const { t } = useTranslation();
  const { user, setUser } = useAuthStore();
  const { logout } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    address: ''
  });

  // Load user data on mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const userData = await authApi.getCurrentUser();
        setFormData({
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          phone: userData.phone || '',
          address: userData.address || ''
        });
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };
    loadUserData();
  }, []);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const response = await authApi.updateProfile(formData);
      
      // Update user in store with new data
      if (user) {
        setUser({
          ...user,
          firstName: response.user.firstName,
          lastName: response.user.lastName,
          phone: response.user.phone,
          address: response.user.address
        });
      }
      
      toast.success(t('auth.profileUpdatedSuccess'));
      setIsEditing(false);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.response?.data?.error || t('auth.failedToUpdateProfile'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Restore original values
    setFormData({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      phone: user?.phone || '',
      address: user?.address || ''
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-8 px-4">
      {/* Language Selector - Fixed Top Right */}
      <div className="fixed top-4 right-4 z-50">
        <LanguageSelector />
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Permanent Alert Banner */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-lg shadow-sm">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <AlertCircle className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4 flex-1">
              <h3 className="text-lg font-semibold text-yellow-800">
                {t('auth.accountPendingApprovalTitle')}
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p className="mb-2">
                  {user?.role === 'staff'
                    ? t('auth.accountUnderReviewByHotel')
                    : t('auth.accountUnderReviewByPlatform')
                  }{' '}
                  {t('auth.processTypically')} <strong>24 {t('auth.hours')}</strong>.
                </p>
                <p>
                  {t('auth.emailNotificationOnApproval')}{' '}
                  {t('auth.canUpdateProfile')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <User className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{t('auth.welcomeExclamation')}</h1>
                <p className="text-sm text-gray-600">{t('auth.manageAccountWhileWaiting')}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              {t('auth.logout')}
            </button>
          </div>

          {user?.email && (
            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-4 py-2 rounded-lg">
              <Mail className="h-4 w-4" />
              <span className="font-medium">{t('auth.email')}:</span> {user.email}
            </div>
          )}
        </div>

        {/* Account Information */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">{t('auth.accountInformation')}</h2>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Edit2 className="h-4 w-4" />
                {t('auth.editProfile')}
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="h-4 w-4" />
                  {isLoading ? t('auth.saving') : t('common.save')}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="h-4 w-4" />
                  {t('common.cancel')}
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* First Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="inline h-4 w-4 mr-1" />
                {t('auth.firstName')}
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={t('auth.enterFirstName')}
                />
              ) : (
                <div className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900">
                  {formData.firstName || t('auth.notSet')}
                </div>
              )}
            </div>

            {/* Last Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="inline h-4 w-4 mr-1" />
                {t('auth.lastName')}
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={t('auth.enterLastName')}
                />
              ) : (
                <div className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900">
                  {formData.lastName || t('auth.notSet')}
                </div>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('auth.phoneNumber')}
              </label>
              {isEditing ? (
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={t('auth.phonePlaceholder')}
                />
              ) : (
                <div className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900">
                  {formData.phone || t('auth.notSet')}
                </div>
              )}
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin className="inline h-4 w-4 mr-1" />
                {t('auth.address')}
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={t('auth.addressPlaceholder')}
                />
              ) : (
                <div className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900">
                  {formData.address || t('auth.notSet')}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Hotel Information (if staff) */}
        {user?.role === 'staff' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Hotel className="h-5 w-5 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">{t('auth.hotelInformation')}</h2>
            </div>
            
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-600">
                {t('auth.hotelInfoDisplayed')}
              </p>
            </div>
          </div>
        )}

        {/* Help Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">{t('auth.needHelp')}</h3>
          <div className="space-y-2 text-sm text-blue-800">
            <p>• {user?.role === 'staff'
              ? t('auth.helpTip1Hotel') 
              : t('auth.helpTip1Platform')
            }</p>
            <p>• {t('auth.helpTip2')}</p>
            <p>• {t('auth.helpTip3')}</p>
            <p>• {t('auth.helpTip4')}</p>
          </div>
        </div>

      </div>
    </div>
  );
}