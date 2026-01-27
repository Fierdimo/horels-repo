import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Calendar, Coins, Home, Mail, Lock, User, Phone, MapPin, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import apiClient from '@/api/client';
import { useAuthStore } from '@/stores/authStore';
import { LanguageSelector } from '@/components/common/LanguageSelector';


interface InvitationData {
  email: string;
  first_name: string;
  last_name: string;
  property: {
    id: number;
    name: string;
    location: string;
    tier: string;
  };
  rooms: Array<{
    room_id: number;
    start_date: string;
    end_date: string;
    room_type: string;
    nights: number;
    estimated_credits: number;
  }>;
  total_nights: number;
  total_estimated_credits: number;
  expires_at: string;
}

type AcceptanceType = 'booking' | 'credits' | null;

export default function RegisterOwner() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setAuth } = useAuthStore(); // ADD: Get setAuth from Zustand
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [selectedType, setSelectedType] = useState<AcceptanceType>(null);

  // Form fields
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('No invitation token provided');
      setValidating(false);
      setLoading(false);
      return;
    }

    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      setValidating(true);
      setError(null);

      const response = await apiClient.get(`/staff/invitations/public/validate-token?token=${token}`);
      
      if (response.data.success) {
        setInvitation(response.data.data.invitation);
      } else {
        setError(response.data.message || 'Invalid invitation token');
      }
    } catch (err: any) {
      console.error('Error validating token:', err);
      setError(err.response?.data?.message || 'Failed to validate invitation');
    } finally {
      setValidating(false);
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedType) {
      setError(t('auth.registerOwner.pleaseSelectOption'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('auth.registerOwner.passwordsDoNotMatch'));
      return;
    }

    if (password.length < 6) {
      setError(t('auth.registerOwner.passwordTooShort'));
      return;
    }

    if (!termsAccepted) {
      setError(t('auth.registerOwner.mustAcceptTerms'));
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      console.log('🚀 Submitting registration with:', {
        email: invitation!.email,
        roleName: 'owner',
        invitationToken: token,
        acceptance_type: selectedType
      });

      const response = await apiClient.post('/auth/register', {
        email: invitation!.email,
        firstName: invitation!.first_name,
        lastName: invitation!.last_name,
        password,
        phone,
        address,
        roleName: 'owner',
        invitationToken: token,
        acceptance_type: selectedType
      });

      console.log('✅ Registration response:', response.data);

      if (response.data.token) {
        // Update Zustand store AND localStorage
        setAuth(response.data.token, response.data.user);
        localStorage.setItem('sw2_token', response.data.token);
        localStorage.setItem('sw2_user', JSON.stringify(response.data.user));

        // Show success message with credits/bookings info
        if (response.data.invitation_result) {
          const result = response.data.invitation_result;
          if (result.acceptance_type === 'credits') {
            console.log(`✅ ${result.total_credits} credits deposited to wallet`);
          } else if (result.acceptance_type === 'booking') {
            console.log(`✅ ${result.bookings_created} booking(s) created`);
          }
        }

        // Navigate to owner dashboard
        navigate('/owner/dashboard');
      }
    } catch (err: any) {
      console.error('❌ Registration error:', err);
      console.error('Error response:', err.response?.data);
      setError(err.response?.data?.error || err.response?.data?.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (validating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">{t('auth.registerOwner.validating')}</p>
        </div>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="flex items-center gap-3 text-red-600 mb-4">
            <AlertCircle className="h-8 w-8" />
            <h2 className="text-xl font-bold">{t('auth.registerOwner.invitationError')}</h2>
          </div>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition"
          >
            {t('auth.registerOwner.goToLogin')}
          </button>
        </div>
      </div>
    );
  }

  if (!invitation) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{t('auth.registerOwner.welcome')}</h1>
          <p className="text-gray-600">{t('auth.registerOwner.invitedAs')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Invitation Details Card */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="fixed top-4 right-2 z-50">
             <LanguageSelector />
            </div>
            <div className="flex items-center gap-3 mb-4">
              <Home className="h-6 w-6 text-purple-600" />
              <h2 className="text-2xl font-bold text-gray-900">{invitation.property.name}</h2>
            </div>
            <p className="text-gray-600 mb-6">{invitation.property.location}</p>

            {/* Room Details */}
            <div className="space-y-4 mb-6">
              {invitation.rooms.map((room, idx) => (
                <div key={idx} className="border-l-4 border-purple-500 pl-4 py-2 bg-purple-50">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-gray-700">{t('auth.registerOwner.room')}</p>
                      <p className="text-gray-900">{room.room_type}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">{t('auth.registerOwner.nights')}</p>
                      <p className="text-gray-900">{room.nights}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">{t('auth.registerOwner.checkIn')}</p>
                      <p className="text-gray-900">{formatDate(room.start_date)}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">{t('auth.registerOwner.checkOut')}</p>
                      <p className="text-gray-900">{formatDate(room.end_date)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Total Summary */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-gray-700 font-medium">{t('auth.registerOwner.totalNights')}:</span>
                <span className="text-xl font-bold text-purple-600">{invitation.total_nights}</span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-gray-700 font-medium">{t('auth.registerOwner.estimatedCredits')}:</span>
                <span className="text-xl font-bold text-purple-600">{invitation.total_estimated_credits}</span>
              </div>
            </div>

            {/* Decision Section */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">{t('auth.registerOwner.whatDoYouPrefer')}</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Option A: Booking */}
                <div
                  onClick={() => setSelectedType('booking')}
                  className={`
                    cursor-pointer rounded-lg border-2 p-6 transition-all
                    ${selectedType === 'booking' 
                      ? 'border-green-500 bg-green-50 shadow-lg' 
                      : 'border-gray-200 hover:border-green-300 hover:shadow-md'
                    }
                  `}
                >
                  <div className="flex items-center justify-between mb-3">
                    <Calendar className={`h-8 w-8 ${selectedType === 'booking' ? 'text-green-600' : 'text-gray-400'}`} />
                    {selectedType === 'booking' && <CheckCircle className="h-6 w-6 text-green-600" />}
                  </div>
                  <h4 className="text-xl font-bold mb-2">{t('auth.registerOwner.acceptAsBooking')}</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    {t('auth.registerOwner.bookingDescription')}
                  </p>
                  <ul className="text-sm space-y-1 text-gray-700">
                    <li>✓ {t('auth.registerOwner.bookingFeature1')}</li>
                    <li>✓ {t('auth.registerOwner.bookingFeature2')}</li>
                    <li>✓ {t('auth.registerOwner.bookingFeature3')}</li>
                  </ul>
                </div>

                {/* Option B: Credits */}
                <div
                  onClick={() => setSelectedType('credits')}
                  className={`
                    cursor-pointer rounded-lg border-2 p-6 transition-all
                    ${selectedType === 'credits' 
                      ? 'border-purple-500 bg-purple-50 shadow-lg' 
                      : 'border-gray-200 hover:border-purple-300 hover:shadow-md'
                    }
                  `}
                >
                  <div className="flex items-center justify-between mb-3">
                    <Coins className={`h-8 w-8 ${selectedType === 'credits' ? 'text-purple-600' : 'text-gray-400'}`} />
                    {selectedType === 'credits' && <CheckCircle className="h-6 w-6 text-purple-600" />}
                  </div>
                  <h4 className="text-xl font-bold mb-2">{t('auth.registerOwner.convertToCredits')}</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    {t('auth.registerOwner.creditsDescription')}
                  </p>
                  <ul className="text-sm space-y-1 text-gray-700">
                    <li>✓ {t('auth.registerOwner.creditsFeature2')}</li>
                    <li>✓ {t('auth.registerOwner.creditsFeature3')}</li>
                    <li>✓ {t('auth.registerOwner.creditsFeature4')}</li>
                    <li>💎 {invitation.total_estimated_credits} {t('auth.registerOwner.creditsFeature1')}</li>
                  </ul>
                </div>
              </div>

              {selectedType && (
                <div className={`mt-4 p-4 rounded-lg ${
                  selectedType === 'booking' ? 'bg-green-50 border border-green-200' : 'bg-purple-50 border border-purple-200'
                }`}>
                  <p className="text-sm font-medium">
                    ✓ {t('auth.registerOwner.selectedOption')}: <strong>{selectedType === 'booking' ? t('auth.registerOwner.acceptAsBooking') : t('auth.registerOwner.convertToCredits')}</strong>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Registration Form */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-6">{t('auth.registerOwner.completeRegistration')}</h3>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              {/* Email (readonly) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Mail className="inline h-4 w-4 mr-2" />
                  {t('auth.registerOwner.email')}
                </label>
                <input
                  type="email"
                  value={invitation.email}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                />
              </div>

              {/* Name (readonly) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <User className="inline h-4 w-4 mr-2" />
                    {t('auth.registerOwner.firstName')}
                  </label>
                  <input
                    type="text"
                    value={invitation.first_name}
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('auth.registerOwner.lastName')}
                  </label>
                  <input
                    type="text"
                    value={invitation.last_name}
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Lock className="inline h-4 w-4 mr-2" />
                  {t('auth.registerOwner.password')} *
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth.registerOwner.passwordPlaceholder')}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Lock className="inline h-4 w-4 mr-2" />
                  {t('auth.registerOwner.confirmPassword')} *
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('auth.registerOwner.passwordPlaceholder')}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Phone className="inline h-4 w-4 mr-2" />
                  {t('auth.registerOwner.phone')}
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t('auth.registerOwner.phonePlaceholder')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <MapPin className="inline h-4 w-4 mr-2" />
                  {t('auth.registerOwner.address')}
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={t('auth.registerOwner.addressPlaceholder')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Terms */}
              <div className="flex items-start gap-3 pt-4">
                <input
                  type="checkbox"
                  id="terms"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-1 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <label htmlFor="terms" className="text-sm text-gray-600">
                  {t('auth.registerOwner.termsAccept')}
                </label>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <button
              type="submit"
              disabled={!selectedType || submitting}
              className={`
                w-full py-4 px-6 rounded-lg font-bold text-white text-lg transition-all
                ${!selectedType || submitting
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700 shadow-lg hover:shadow-xl'
                }
              `}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t('auth.registerOwner.creatingAccount')}
                </span>
              ) : (
                selectedType === 'booking' 
                  ? t('auth.registerOwner.createAccountBooking')
                  : selectedType === 'credits'
                  ? t('auth.registerOwner.createAccountCredits')
                  : t('auth.registerOwner.selectOptionFirst')
              )}
            </button>

            {!selectedType && (
              <p className="text-sm text-gray-500 text-center mt-3">
                {t('auth.registerOwner.selectOptionFirst')}
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
