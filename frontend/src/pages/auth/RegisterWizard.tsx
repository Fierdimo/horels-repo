import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/api/auth';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/api/client';
import {
  Hotel,
  ArrowLeft,
  ArrowRight,
  User,
  Briefcase,
  Mail,
  Lock,
  Building,
  MapPin,
  Check,
  Loader2,
  Search,
  AlertCircle,
  Calendar,
  Home
} from 'lucide-react';
import toast from 'react-hot-toast';
import { LanguageSelector } from '@/components/common/LanguageSelector';

type UserRole = 'guest' | 'staff' | 'owner';

interface FormData {
  role: UserRole | null;
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  hotelName?: string;
  hotelLocation?: string;
  propertyId?: string;
  pmsExternalId?: string; // External ID from PMS
}

export default function RegisterWizard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { register, user } = useAuth();
  const [searchParams] = useSearchParams();
  
  // Detect invitation token from URL
  const invitationToken = searchParams.get('invitation');

  // Validate invitation token if present
  const { data: invitationData, isLoading: isLoadingInvitation, error: invitationError } = useQuery({
    queryKey: ['invitation', invitationToken],
    queryFn: async () => {
      if (!invitationToken) return null;
      const response = await apiClient.get(`/staff/invitations/public/invitation/${invitationToken}`);
      return response.data;
    },
    enabled: !!invitationToken,
    retry: false,
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [propertyResults, setPropertyResults] = useState<Array<{ id?: number; propertyId: string; name: string; location?: string; city?: string; country?: string; alreadyRegistered: boolean; source: 'platform' | 'pms'; }>>([]);
  const [isLoadingProperties, setIsLoadingProperties] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    role: null,
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    hotelName: '',
    hotelLocation: '',
    propertyId: '',
    pmsExternalId: ''
  });

  // Pre-fill form data if invitation is valid
  useEffect(() => {
    if (invitationData?.success && invitationData?.data) {
      const invitation = invitationData.data;
      setFormData(prev => ({
        ...prev,
        role: 'owner',
        email: invitation.email,
        firstName: invitation.first_name || '',
        lastName: invitation.last_name || '',
      }));
    }
  }, [invitationData]);

  // Search properties in platform
  useEffect(() => {
    const searchProperties = async () => {
      if (!formData.hotelName || formData.hotelName.length < 2) {
        setPropertyResults([]);
        return;
      }

      try {
        setIsLoadingProperties(true);
        const response = await authApi.searchPropertiesInPlatform(formData.hotelName);
        if (response.success && response.data) {
          setPropertyResults(response.data);
        }
      } catch (error) {
        console.error('Error searching properties:', error);
        setPropertyResults([]);
      } finally {
        setIsLoadingProperties(false);
      }
    };

    // Debounce search
    const timeoutId = setTimeout(() => {
      searchProperties();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [formData.hotelName]);

  const totalSteps = invitationToken ? 2 : (formData.role === 'staff' ? 4 : 3);

  const updateFormData = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.email || !formData.password || !formData.firstName || !formData.lastName) {
      toast.error(t('auth.fillAllFields'));
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error(t('auth.passwordsDoNotMatch'));
      return;
    }

    if (formData.password.length < 8) {
      toast.error(t('auth.passwordMinLength'));
      return;
    }

    if (formData.role === 'staff' && !formData.hotelName) {
      toast.error(t('auth.hotelNameRequired'));
      return;
    }

    setIsLoading(true);
    try {
      const registerData: any = {
        email: formData.email,
        password: formData.password,
        roleName: formData.role!,
        firstName: formData.firstName,
        lastName: formData.lastName
      };

      // If registering from an invitation, include the token
      if (invitationToken && formData.role === 'owner') {
        registerData.invitationToken = invitationToken;
      }

      // If staff, include PMS data
      if (formData.role === 'staff' && formData.pmsExternalId) {
        registerData.pms_property_id = formData.pmsExternalId;
        registerData.property_data = {
          name: formData.hotelName!,
          location: formData.hotelLocation
        };
      }

      register(registerData, {
        onSuccess: async (data: any) => {
          toast.success(t('auth.accountCreatedSuccess'));

          // If owner registered via invitation, the backend automatically accepts it
          if (invitationToken && formData.role === 'owner') {
            toast.success('Invitation accepted successfully!');
          }

          setIsLoading(false);

          // Redirect based on user status
          if (data.status === 'pending') {
            navigate('/pending-approval');
          } else if (data.user.role === 'owner' || data.user.role === 'admin') {
            navigate(`/${data.user.role}/dashboard`);
          } else if (data.user.role === 'guest') {
            navigate('/guest/dashboard');
          } else if (data.user.role === 'staff') {
            navigate('/staff/dashboard');
          } else {
            navigate('/');
          }
        },
        onError: (error: any) => {
          toast.error(error.response?.data?.error || t('auth.registrationFailed'));
          setIsLoading(false);
        }
      });
    } catch (error: any) {
      toast.error(t('auth.registrationFailed'));
      setIsLoading(false);
    }
  };

  // Render invitation info for owners
  const renderInvitationInfo = () => {
    if (!invitationData?.data) return null;
    
    const invitation = invitationData.data;
    
    return (
      <div className="space-y-4 mb-6 animate-fadeIn">
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                <Mail className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                You've been invited!
              </h3>
              <p className="text-gray-600 mb-4">
                You've been invited to become an owner at <strong>{invitation.property?.name}</strong>
              </p>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center text-gray-700">
                  <Building className="h-4 w-4 mr-2 text-blue-600" />
                  <span><strong>Property:</strong> {invitation.property?.name}</span>
                </div>
                {invitation.property?.location && (
                  <div className="flex items-center text-gray-700">
                    <MapPin className="h-4 w-4 mr-2 text-blue-600" />
                    <span><strong>Location:</strong> {invitation.property.location}</span>
                  </div>
                )}
                <div className="flex items-center text-gray-700">
                  <Home className="h-4 w-4 mr-2 text-blue-600" />
                  <span><strong>Rooms assigned:</strong> {invitation.rooms_count || invitation.rooms_data?.length || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Step 1: Role Selection
  const renderStep1 = () => (
    <div className="space-y-6 animate-fadeIn">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {t('auth.chooseAccountType')}
        </h2>
        <p className="text-gray-600">
          {t('auth.selectOption')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Guest Card */}
        <button
          onClick={() => {
            updateFormData('role', 'guest');
            nextStep();
          }}
          className={`p-6 border-2 rounded-xl transition-all hover:shadow-lg ${formData.role === 'guest'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-blue-300'
            }`}
        >
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
              <User className="h-8 w-8 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {t('auth.guest')}
              </h3>
              <p className="text-sm text-gray-600">
                {t('auth.guestDescription')}
              </p>
            </div>
            <ul className="text-left text-sm text-gray-600 space-y-2">
              <li className="flex items-center">
                <Check className="h-4 w-4 text-green-500 mr-2" />
                {t('auth.bookHotelRooms')}
              </li>
              <li className="flex items-center">
                <Check className="h-4 w-4 text-green-500 mr-2" />
                {t('auth.digitalCheckin')}
              </li>
              <li className="flex items-center">
                <Check className="h-4 w-4 text-green-500 mr-2" />
                {t('auth.requestServices')}
              </li>
            </ul>
          </div>
        </button>

        {/* Staff Card */}
        <button
          onClick={() => {
            updateFormData('role', 'staff');
            nextStep();
          }}
          className={`p-6 border-2 rounded-xl transition-all hover:shadow-lg ${formData.role === 'staff'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-blue-300'
            }`}
        >
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-teal-600 rounded-2xl flex items-center justify-center">
              <Briefcase className="h-8 w-8 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {t('auth.hotelStaff')}
              </h3>
              <p className="text-sm text-gray-600">
                {t('auth.staffDescription')}
              </p>
            </div>
            <ul className="text-left text-sm text-gray-600 space-y-2">
              <li className="flex items-center">
                <Check className="h-4 w-4 text-green-500 mr-2" />
                {t('auth.manageBookings')}
              </li>
              <li className="flex items-center">
                <Check className="h-4 w-4 text-green-500 mr-2" />
                {t('auth.approveRequests')}
              </li>
              <li className="flex items-center">
                <Check className="h-4 w-4 text-green-500 mr-2" />
                {t('auth.handleServices')}
              </li>
            </ul>
          </div>
        </button>
      </div>
    </div>
  );

  // Step 2: Account Details
  const renderStep2 = () => (
    <div className="space-y-6 animate-fadeIn">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {invitationToken ? 'Complete Your Profile' : t('auth.createYourAccount')}
        </h2>
        <p className="text-gray-600">
          {invitationToken ? 'Create your password to activate your owner account' : t('auth.enterEmailPassword')}
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Mail className="inline h-4 w-4 mr-2" />
            {t('auth.emailAddress')}
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => updateFormData('email', e.target.value)}
            placeholder={t('auth.emailPlaceholder')}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            required
            disabled={!!invitationToken}
            readOnly={!!invitationToken}
          />
          {invitationToken && (
            <p className="mt-1 text-xs text-gray-500">
              Email from invitation (cannot be changed)
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Lock className="inline h-4 w-4 mr-2" />
            {t('auth.password')}
          </label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) => updateFormData('password', e.target.value)}
            placeholder={t('auth.atLeast8Characters')}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
          <p className="mt-1 text-sm text-gray-500">
            {t('auth.mustBe8Characters')}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Lock className="inline h-4 w-4 mr-2" />
            {t('auth.confirmPassword')}
          </label>
          <input
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => updateFormData('confirmPassword', e.target.value)}
            placeholder={t('auth.reenterPassword')}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>
      </div>

      <div className="flex gap-4 pt-4">
        <button
          onClick={prevStep}
          className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="inline h-4 w-4 mr-2" />
          {t('auth.back')}
        </button>
        <button
          onClick={nextStep}
          disabled={!formData.email || !formData.password || !formData.confirmPassword}
          className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('auth.continue')}
          <ArrowRight className="inline h-4 w-4 ml-2" />
        </button>
      </div>
    </div>
  );

  // Step 3: Personal Info
  const renderStep3 = () => (
    <div className="space-y-6 animate-fadeIn">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {t('auth.tellUsAboutYourself')}
        </h2>
        <p className="text-gray-600">
          {t('auth.likeToKnowName')}
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <User className="inline h-4 w-4 mr-2" />
            {t('auth.firstName')}
          </label>
          <input
            type="text"
            value={formData.firstName}
            onChange={(e) => updateFormData('firstName', e.target.value)}
            placeholder="John"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <User className="inline h-4 w-4 mr-2" />
            {t('auth.lastName')}
          </label>
          <input
            type="text"
            value={formData.lastName}
            onChange={(e) => updateFormData('lastName', e.target.value)}
            placeholder="Doe"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>
      </div>

      <div className="flex gap-4 pt-4">
        <button
          onClick={prevStep}
          className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="inline h-4 w-4 mr-2" />
          {t('auth.back')}
        </button>
        <button
          onClick={formData.role === 'staff' ? nextStep : handleSubmit}
          disabled={!formData.firstName || !formData.lastName || isLoading}
          className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin h-5 w-5 mr-2" />
              {t('auth.creating')}
            </>
          ) : formData.role === 'staff' ? (
            <>
              {t('auth.continue')}
              <ArrowRight className="inline h-4 w-4 ml-2" />
            </>
          ) : (
            t('auth.createAccount')
          )}
        </button>
      </div>
    </div>
  );

  // Step 4: Hotel Info (Staff only)
  const renderStep4 = () => (
    <div className="space-y-6 animate-fadeIn">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {t('auth.hotelInformation')}
        </h2>
        <p className="text-gray-600">
          {t('auth.tellUsAboutHotel')}
        </p>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Building className="inline h-4 w-4 mr-2" />
            {t('auth.hotelName')}
          </label>
          <div className="relative">
            <input
              type="text"
              value={formData.hotelName}
              onChange={(e) => updateFormData('hotelName', e.target.value)}
              placeholder={t('auth.startTypingHotel')}
              className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
              autoComplete="off"
            />
            {isLoadingProperties ? (
              <Loader2 className="absolute right-3 top-3.5 h-5 w-5 text-blue-600 animate-spin" />
            ) : (
              <Search className="absolute right-3 top-3.5 h-5 w-5 text-gray-400" />
            )}
          </div>

          {/* Dropdown with search results */}
          {propertyResults.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-xl max-h-80 overflow-y-auto">
              {propertyResults.map((property, idx) => (
                <button
                  key={property.id || `pms-${idx}`}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                  }}
                  onClick={() => {
                    const location = [property.city, property.country].filter(Boolean).join(', ') || property.location || '';
                    updateFormData('hotelName', property.name);
                    updateFormData('hotelLocation', location);
                    updateFormData('pmsExternalId', property.propertyId);
                    if (property.id) {
                      updateFormData('propertyId', property.id.toString());
                    }
                    setPropertyResults([]);
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0 group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 group-hover:text-blue-600">
                        {property.name}
                      </div>
                      {(property.location || property.city) && (
                        <div className="text-sm text-gray-500 flex items-center mt-1">
                          <MapPin className="h-3 w-3 mr-1" />
                          {property.location || [property.city, property.country].filter(Boolean).join(', ')}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 ml-2 shrink-0">
                      {property.alreadyRegistered && (
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full font-medium">
                          {t('auth.registered')}
                        </span>
                      )}
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${property.source === 'platform'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-purple-100 text-purple-700'
                        }`}>
                        {property.source === 'platform' ? t('auth.platform') : t('auth.pms')}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <MapPin className="inline h-4 w-4 mr-2" />
            {t('auth.hotelLocation')}
          </label>
          <input
            type="text"
            value={formData.hotelLocation}
            onChange={(e) => updateFormData('hotelLocation', e.target.value)}
            placeholder={t('auth.hotelLocationPlaceholder')}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            readOnly={!!formData.pmsExternalId}
          />
          {formData.pmsExternalId && (
            <p className="mt-1 text-xs text-green-600 flex items-center">
              <Check className="h-3 w-3 mr-1" />
              {t('auth.locationAutoFilled')}
            </p>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>{t('common.note')}:</strong> {t('auth.noteApprovalRequired')}
          </p>
        </div>
      </div>

      <div className="flex gap-4 pt-4">
        <button
          onClick={prevStep}
          className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="inline h-4 w-4 mr-2" />
          {t('auth.back')}
        </button>
        <button
          onClick={handleSubmit}
          disabled={!formData.hotelName || isLoading}
          className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin h-5 w-5 mr-2" />
              {t('auth.creating')}
            </>
          ) : (
            t('auth.createAccount')
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center space-x-2 mb-6">
            <Hotel className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">SW2 Platform</span>
          </Link>
        </div>

        {/* Language Selector - Fixed Top Right */}
        <div className="fixed top-4 right-2 z-50">
          <LanguageSelector />
        </div>

        {/* Loading invitation */}
        {isLoadingInvitation && (
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 text-blue-600 animate-spin mb-4" />
              <p className="text-gray-600">Validating invitation...</p>
            </div>
          </div>
        )}

        {/* Invalid or expired invitation */}
        {invitationToken && !isLoadingInvitation && (invitationError || !invitationData?.success) && (
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Invalid Invitation</h2>
              <p className="text-gray-600 text-center mb-6">
                This invitation link is invalid, expired, or has already been used.
              </p>
              <Link
                to="/register"
                className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Register as Guest or Staff
              </Link>
            </div>
          </div>
        )}

        {/* Valid invitation or normal registration */}
        {(!invitationToken || (invitationData?.success && !isLoadingInvitation)) && (
          <>
            {/* Show invitation info if present */}
            {invitationToken && invitationData?.success && renderInvitationInfo()}

            {/* Progress Steps - Only show for normal registration or hide role selection for invitation */}
            {!invitationToken && (
              <div className="mb-8">
                <div className="flex items-center justify-center">
                  {Array.from({ length: totalSteps }).map((_, index) => (
                    <div key={index} className="flex items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${index + 1 < currentStep
                            ? 'bg-green-500 text-white'
                            : index + 1 === currentStep
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 text-gray-500'
                          }`}
                      >
                        {index + 1 < currentStep ? (
                          <Check className="h-5 w-5" />
                        ) : (
                          index + 1
                        )}
                      </div>
                      {index < totalSteps - 1 && (
                        <div
                          className={`w-16 h-1 transition-all ${index + 1 < currentStep ? 'bg-green-500' : 'bg-gray-200'
                            }`}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-4 text-sm text-gray-600">
                  <span className={currentStep === 1 ? 'font-semibold text-blue-600' : ''}>{t('auth.role')}</span>
                  <span className={currentStep === 2 ? 'font-semibold text-blue-600' : ''}>{t('auth.account')}</span>
                  <span className={currentStep === 3 ? 'font-semibold text-blue-600' : ''}>{t('auth.personal')}</span>
                  {totalSteps === 4 && (
                    <span className={currentStep === 4 ? 'font-semibold text-blue-600' : ''}>{t('auth.hotel')}</span>
                  )}
                </div>
              </div>
            )}

            {/* Form Card */}
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
              {/* For invitation flow, skip step 1 and go directly to step 2 */}
              {invitationToken ? (
                <>
                  {currentStep === 1 && renderStep2()}
                  {currentStep === 2 && renderStep3()}
                </>
              ) : (
                <>
                  {currentStep === 1 && renderStep1()}
                  {currentStep === 2 && renderStep2()}
                  {currentStep === 3 && renderStep3()}
                  {currentStep === 4 && renderStep4()}
                </>
              )}
            </div>

            {/* Footer */}
            <p className="mt-8 text-center text-sm text-gray-600">
              {t('auth.alreadyHaveAccountQuestion')}{' '}
              <Link to="/login" className="text-blue-600 hover:text-blue-700 font-semibold">
                {t('auth.signIn')}
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
