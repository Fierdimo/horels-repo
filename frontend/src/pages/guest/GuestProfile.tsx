import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { User, Mail, Phone, MapPin, Calendar, Edit2, Save, X, Loader2 } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import PaymentMethodSetup from '@/components/owner/PaymentMethodSetup';
import toast from 'react-hot-toast';

export default function GuestProfile() {
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const { profile, updateProfile, isUpdating } = useProfile();
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState({
    firstName: profile?.firstName || user?.firstName || '',
    lastName: profile?.lastName || user?.lastName || '',
    email: profile?.email || user?.email || '',
    phone: profile?.phone || user?.phone || '',
    address: profile?.address || user?.address || '',
  });

  const handleSave = async () => {
    try {
      await updateProfile({
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        address: formData.address,
      });
      toast.success(t('guest.profile.updateSuccess') || 'Profile updated successfully');
      setIsEditing(false);
    } catch (error) {
      toast.error(t('common.somethingWentWrong') || 'Something went wrong');
    }
  };

  const handleCancel = () => {
    setFormData({
      firstName: profile?.firstName || user?.firstName || '',
      lastName: profile?.lastName || user?.lastName || '',
      email: profile?.email || user?.email || '',
      phone: profile?.phone || user?.phone || '',
      address: profile?.address || user?.address || '',
    });
    setIsEditing(false);
  };

  const displayName = `${formData.firstName || ''} ${formData.lastName || ''}`.trim() || 'Guest';
  const initials = `${formData.firstName?.charAt(0) || ''}${formData.lastName?.charAt(0) || 'G'}`.toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {t('guest.dashboard.myProfile') || 'My Profile'}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {t('guest.profile.subtitle') || 'Manage your account information and preferences'}
              </p>
            </div>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
              >
                <Edit2 className="h-4 w-4" />
                {t('common.edit') || 'Edit'}
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleCancel}
                  disabled={isUpdating}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                  {t('common.cancel') || 'Cancel'}
                </button>
                <button
                  onClick={handleSave}
                  disabled={isUpdating}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition disabled:opacity-50"
                >
                  {isUpdating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {isUpdating ? t('common.saving') || 'Saving...' : t('common.save') || 'Save'}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="grid gap-6">
          {/* Profile Picture */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {t('guest.profile.picture') || 'Profile Picture'}
            </h2>
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 bg-gradient-to-br from-primary to-blue-600 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                {initials}
              </div>
              <div>
                <p className="text-lg font-medium text-gray-900">{displayName}</p>
                <p className="text-sm text-gray-500">{formData.email}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {t('guest.profile.memberSince') || 'Member Since'}: {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Personal Information */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              {t('guest.profile.personalInfo') || 'Personal Information'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="h-4 w-4 inline mr-1" />
                  {t('guest.profile.firstName') || 'First Name'}
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  disabled={!isEditing}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="h-4 w-4 inline mr-1" />
                  {t('guest.profile.lastName') || 'Last Name'}
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  disabled={!isEditing}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Mail className="h-4 w-4 inline mr-1" />
                  {t('guest.profile.email') || 'Email'}
                </label>
                <input
                  type="email"
                  value={formData.email}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">{t('guest.profile.emailCannotChange') || 'Email cannot be changed'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Phone className="h-4 w-4 inline mr-1" />
                  {t('guest.profile.phone') || 'Phone'}
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  disabled={!isEditing}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              {t('guest.profile.addressInfo') || 'Address Information'}
            </h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin className="h-4 w-4 inline mr-1" />
                {t('guest.profile.address') || 'Address'}
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                disabled={!isEditing}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>
          </div>

          {/* Payment Methods Section */}
          <PaymentMethodSetup />

          {/* Language Preferences */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              {t('guest.profile.preferences') || 'Preferences'}
            </h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('guest.profile.language') || 'Language'}
              </label>
              <select
                value={i18n.language}
                onChange={(e) => i18n.changeLanguage(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="it">Italiano</option>
              </select>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
