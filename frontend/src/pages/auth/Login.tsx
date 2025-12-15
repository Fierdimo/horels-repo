import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useBridge } from '@/hooks/useBridge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { loginSchema } from '@/lib/validations';
import toast from 'react-hot-toast';

export default function Login() {
  const { t } = useTranslation();
  const { login, isLoggingIn } = useAuth();
  const { isWebView: isInWebView } = useBridge();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid }
  } = useForm({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false
    }
  });

  const onSubmit = (data: { email: string; password: string }) => {
    console.log('Login form submitted:', { email: data.email });
    login(
      { email: data.email, password: data.password },
      {
        onSuccess: () => {
          console.log('Login success callback triggered');
          toast.success(t('auth.loginSuccess') || 'Login successful!');
        },
        onError: (error: any) => {
          console.error('Login error:', error);
          const errorMessage = error?.response?.data?.error || error?.message || 'Login failed';
          toast.error(errorMessage);
        }
      }
    );
  };

  // Show SSO message if in webview
  useEffect(() => {
    if (isInWebView) {
      toast.success(t('auth.ssoActive') || 'SSO authentication active');
    }
  }, [isInWebView, t]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-primary rounded-lg flex items-center justify-center mb-4">
            <LogIn className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">SW2 Platform</h2>
          <p className="mt-2 text-gray-600">{t('auth.loginSubtitle') || 'Sign in to your account'}</p>
          {isInWebView && (
            <p className="mt-1 text-xs text-primary font-medium">
              {t('auth.webviewMode') || 'WebView Mode'}
            </p>
          )}
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
                autoComplete="current-password"
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

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="rememberMe"
                type="checkbox"
                {...register('rememberMe')}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              />
              <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-700">
                {t('auth.rememberMe') || 'Remember me'}
              </label>
            </div>

            <div className="text-sm">
              <a href="#" className="font-medium text-primary hover:text-primary/80">
                {t('auth.forgotPassword') || 'Forgot password?'}
              </a>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoggingIn || !isValid}
            className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isLoggingIn ? (
              <>
                <LoadingSpinner size="sm" />
                <span>{t('auth.signingIn') || 'Signing in...'}</span>
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                <span>{t('auth.login')}</span>
              </>
            )}
          </button>

          <div className="text-center text-sm text-gray-600">
            {t('auth.noAccount') || "Don't have an account?"}{' '}
            <a href="/register" className="font-medium text-primary hover:text-primary/80">
              {t('auth.signUp') || 'Sign up'}
            </a>
          </div>
        </form>

        <p className="text-center text-xs text-gray-500">
          {t('auth.termsNotice') || 'By signing in, you agree to our Terms of Service and Privacy Policy'}
        </p>
      </div>
    </div>
  );
}
