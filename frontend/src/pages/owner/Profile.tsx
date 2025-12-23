import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useProfile } from '@/hooks/useProfile';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { User, Mail, Phone, MapPin, Building, CreditCard, Save, X } from 'lucide-react';
import PaymentMethodSetup from '@/components/owner/PaymentMethodSetup';

export default function Profile() {
  const { t } = useTranslation();
  const { profile, isLoading, updateProfile, isUpdating } = useProfile();
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    bankAccount: '',
    bankRoutingNumber: '',
    propertyName: '',
    propertyLocation: '',
    propertyDescription: ''
  });

  // Initialize form data when profile loads
  useEffect(() => {
    if (profile) {
      setFormData(prev => ({
        ...prev,
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        email: profile.email || '',
        phone: profile.phone || '',
        address: profile.address || ''
      }));
    }
  }, [profile]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">{t('common.error')}</p>
      </div>
    );
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async () => {
    try {
      // Only send fields that can be updated via the API
      await updateProfile({
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        address: formData.address
      });
      setIsEditing(false);
    } catch (error) {
      // Error is handled by the hook with toast notification
      console.error('Profile update error:', error);
    }
  };

  const handleCancel = () => {
    // Reset form to current profile data
    if (profile) {
      setFormData(prev => ({
        ...prev,
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        email: profile.email || '',
        phone: profile.phone || '',
        address: profile.address || ''
      }));
    }
    setIsEditing(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {t('owner.profile.title')}
            </h1>
            <p className="text-gray-600 mt-2">
              {t('owner.profile.subtitle')}
            </p>
          </div>

          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <User className="h-5 w-5" />
              {t('common.edit')}
            </button>
          )}
        </div>

        {/* Personal Information Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <User className="h-6 w-6 text-blue-600" />
            {t('owner.profile.personalInfo')}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* First Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('owner.profile.firstName')}
              </label>
              {isEditing ? (
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-gray-900 py-2">
                  {formData.firstName || '—'}
                </p>
              )}
            </div>

            {/* Last Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('owner.profile.lastName')}
              </label>
              {isEditing ? (
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-gray-900 py-2">
                  {formData.lastName || '—'}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Mail className="h-4 w-4" />
                {t('auth.email')}
              </label>
              <p className="text-gray-900 py-2">
                {formData.email}
              </p>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Phone className="h-4 w-4" />
                {t('owner.profile.phone')}
              </label>
              {isEditing ? (
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-gray-900 py-2">
                  {formData.phone || '—'}
                </p>
              )}
            </div>

            {/* Address */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {t('owner.profile.address')}
              </label>
              {isEditing ? (
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-gray-900 py-2">
                  {formData.address || '—'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Banking Information Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-green-600" />
            {t('owner.profile.bankingInfo')}
          </h2>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              {t('owner.profile.bankingNote')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Bank Account */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('owner.profile.bankAccount')}
              </label>
              {isEditing ? (
                <input
                  type="text"
                  name="bankAccount"
                  value={formData.bankAccount}
                  onChange={handleInputChange}
                  placeholder="e.g., IBAN or Account Number"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-gray-900 py-2">
                  {formData.bankAccount ? `••••${formData.bankAccount.slice(-4)}` : '—'}
                </p>
              )}
            </div>

            {/* Bank Routing Number */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('owner.profile.bankRoutingNumber')}
              </label>
              {isEditing ? (
                <input
                  type="text"
                  name="bankRoutingNumber"
                  value={formData.bankRoutingNumber}
                  onChange={handleInputChange}
                  placeholder="e.g., Routing Number or BIC"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-gray-900 py-2">
                  {formData.bankRoutingNumber ? `••••${formData.bankRoutingNumber.slice(-4)}` : '—'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Payment Methods Section */}
        <div className="mb-6">
          <PaymentMethodSetup />
        </div>

        {/* Property Information Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <Building className="h-6 w-6 text-purple-600" />
            {t('owner.profile.propertyInfo')}
          </h2>

          <div className="space-y-6">
            {/* Property Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('owner.profile.propertyName')}
              </label>
              {isEditing ? (
                <input
                  type="text"
                  name="propertyName"
                  value={formData.propertyName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-gray-900 py-2">
                  {formData.propertyName || '—'}
                </p>
              )}
            </div>

            {/* Property Location */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {t('owner.profile.propertyLocation')}
              </label>
              {isEditing ? (
                <input
                  type="text"
                  name="propertyLocation"
                  value={formData.propertyLocation}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-gray-900 py-2">
                  {formData.propertyLocation || '—'}
                </p>
              )}
            </div>

            {/* Property Description */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('owner.profile.propertyDescription')}
              </label>
              {isEditing ? (
                <textarea
                  name="propertyDescription"
                  value={formData.propertyDescription}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-gray-900 py-2 whitespace-pre-wrap">
                  {formData.propertyDescription || '—'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {isEditing && (
          <div className="flex gap-4 justify-end">
            <button
              onClick={handleCancel}
              disabled={isUpdating}
              className="px-6 py-2 bg-gray-300 text-gray-800 font-medium rounded-lg hover:bg-gray-400 disabled:bg-gray-400 transition-colors flex items-center gap-2"
            >
              <X className="h-5 w-5" />
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={isUpdating}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
            >
              <Save className="h-5 w-5" />
              {isUpdating ? t('common.saving') : t('common.save')}
            </button>
          </div>
        )}

        {/* Account Information Card */}
        <div className="bg-gray-50 rounded-lg p-6 mt-8 border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-4">{t('owner.profile.accountInfo')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-600 uppercase">{t('owner.profile.memberId')}</p>
              <p className="font-semibold text-gray-900">#{profile.id}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 uppercase">{t('common.status')}</p>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                profile.status === 'approved' ? 'bg-green-100 text-green-800' : 
                profile.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {t(`common.${profile.status}`)}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-600 uppercase">{t('owner.profile.joinDate')}</p>
              <p className="font-semibold text-gray-900">
                {new Date(profile.created_at).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600 uppercase">{t('common.role')}</p>
              <p className="font-semibold text-gray-900 capitalize">
                {profile.role}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
