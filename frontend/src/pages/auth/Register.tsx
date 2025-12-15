import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProperties } from '@/hooks/useProperties';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { registerSchema, type RegisterFormData } from '@/lib/validations';
import toast from 'react-hot-toast';

export default function Register() {
  const { t } = useTranslation();
  const { register: registerUser, isRegistering } = useAuth();
  const { data: propertiesData } = useProperties();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid }
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',
    defaultValues: {
      roleName: 'owner'
    }
  });

  const selectedRole = watch('roleName');

  const onSubmit = (data: RegisterFormData) => {
    const { confirmPassword, ...registerData } = data;
    registerUser(registerData, {
      onSuccess: () => {
        toast.success(t('auth.registerSuccess') || 'Registration successful! Please login.');
      },
      onError: (error: any) => {
        const errorMessage = error?.response?.data?.error || error?.message || 'Registration failed';
        toast.error(errorMessage);
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-12">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-primary rounded-lg flex items-center justify-center mb-4">
            <UserPlus className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">SW2 Platform</h2>
          <p className="mt-2 text-gray-600">{t('auth.registerSubtitle') || 'Create your account'}</p>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6 bg-white p-8 rounded-xl shadow-lg">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              {t('auth.email')}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              {...register('email')}
              className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition ${
                errors.email ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              {t('auth.password')}
            </label>
            <div className="relative mt-1">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                {...register('password')}
                className={`block w-full px-3 py-2 pr-10 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition ${
                  errors.password ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              {t('auth.confirmPassword') || 'Confirm Password'}
            </label>
            <div className="relative mt-1">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                {...register('confirmPassword')}
                className={`block w-full px-3 py-2 pr-10 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition ${
                  errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="roleName" className="block text-sm font-medium text-gray-700">
              {t('auth.accountType') || 'Account Type'}
            </label>
            <select
              id="roleName"
              {...register('roleName')}
              className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition ${
                errors.roleName ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="owner">{t('auth.roleOwner') || 'Property Owner'}</option>
              <option value="staff">{t('auth.roleStaff') || 'Hotel Staff'}</option>
              <option value="admin">{t('auth.roleAdmin') || 'Administrator'}</option>
            </select>
            {errors.roleName && (
              <p className="mt-1 text-sm text-red-600">{errors.roleName.message}</p>
            )}
          </div>

          {selectedRole === 'staff' && (
            <>
              <div>
                <label htmlFor="hotelName" className="block text-sm font-medium text-gray-700">
                  {t('auth.hotelName') || 'Hotel Name'}
                </label>
                <input
                  id="hotelName"
                  type="text"
                  list="hotelNames"
                  {...register('hotelName')}
                  className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition ${
                    errors.hotelName ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder={t('auth.hotelNamePlaceholder') || 'Enter or select hotel name'}
                />
                <datalist id="hotelNames">
                  {propertiesData?.properties?.map((property, index) => (
                    <option key={index} value={property.name} />
                  ))}
                </datalist>
                {errors.hotelName && (
                  <p className="mt-1 text-sm text-red-600">{errors.hotelName.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="hotelLocation" className="block text-sm font-medium text-gray-700">
                  {t('auth.hotelLocation') || 'Hotel Location'}
                </label>
                <input
                  id="hotelLocation"
                  type="text"
                  {...register('hotelLocation')}
                  className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition ${
                    errors.hotelLocation ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder={t('auth.hotelLocationPlaceholder') || 'Enter hotel location'}
                />
                {errors.hotelLocation && (
                  <p className="mt-1 text-sm text-red-600">{errors.hotelLocation.message}</p>
                )}
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={isRegistering || !isValid}
            className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isRegistering ? (
              <>
                <LoadingSpinner size="sm" />
                <span>{t('auth.registering') || 'Registering...'}</span>
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                <span>{t('auth.register') || 'Create Account'}</span>
              </>
            )}
          </button>

          <div className="text-center text-sm text-gray-600">
            {t('auth.hasAccount') || 'Already have an account?'}{' '}
            <a href="/login" className="font-medium text-primary hover:text-primary/80">
              {t('auth.signIn') || 'Sign in'}
            </a>
          </div>
        </form>

        <p className="text-center text-xs text-gray-500">
          {t('auth.termsNotice') || 'By creating an account, you agree to our Terms of Service and Privacy Policy'}
        </p>
      </div>
    </div>
  );
}
