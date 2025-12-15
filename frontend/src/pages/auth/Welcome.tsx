import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Hotel, 
  CalendarCheck, 
  CreditCard, 
  Sparkles, 
  Shield, 
  Globe,
  ArrowRight,
  Check
} from 'lucide-react';
import { LanguageSelector } from '@/components/common/LanguageSelector';

export default function Welcome() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const features = [
    {
      icon: Hotel,
      title: t('auth.featureBooking'),
      description: t('auth.featureBookingDesc')
    },
    {
      icon: CalendarCheck,
      title: t('auth.featureCheckin'),
      description: t('auth.featureCheckinDesc')
    },
    {
      icon: CreditCard,
      title: t('auth.featurePayments'),
      description: t('auth.featurePaymentsDesc')
    },
    {
      icon: Sparkles,
      title: t('auth.featureServices'),
      description: t('auth.featureServicesDesc')
    }
  ];

  const benefits = [
    t('auth.benefit1'),
    t('auth.benefit2'),
    t('auth.benefit3'),
    t('auth.benefit4'),
    t('auth.benefit5'),
    t('auth.benefit6')
  ];

  const handleQuickLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Login logic will be handled by existing auth
    setTimeout(() => {
      navigate('/login');
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Language Selector - Fixed Top Right */}
      <div className="fixed top-4 right-2 z-50">
        <LanguageSelector />
      </div>

      {/* Header */}
      <header className="absolute top-0 left-0 right-2 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Hotel className="h-8 w-8 text-blue-600" />
              <span className="text-2xl font-bold text-gray-900">SW2 Platform</span>
            </div>
            <div className="flex items-center space-x-4">
              <button className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
                {t('auth.help')}
              </button>
              <Link
                to="/login"
                className="px-4 py-2 text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                {t('auth.signIn')}
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Column - Content */}
            <div className="space-y-8">
              <div className="inline-flex items-center px-4 py-2 bg-blue-100 rounded-full">
                <Globe className="h-4 w-4 text-blue-600 mr-2" />
                <span className="text-sm font-medium text-blue-900">
                  {t('auth.trustedBy')}
                </span>
              </div>

              <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                {t('auth.welcomeTitle').split(' ').slice(0, 2).join(' ')}
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                  {t('auth.welcomeTitle').split(' ').slice(2).join(' ')}
                </span>
              </h1>

              <p className="text-xl text-gray-600 leading-relaxed">
                {t('auth.welcomeSubtitle')}
              </p>

              {/* Benefits List */}
              <div className="space-y-3">
                {benefits.slice(0, 3).map((benefit, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                      <Check className="h-4 w-4 text-green-600" />
                    </div>
                    <span className="text-gray-700">{benefit}</span>
                  </div>
                ))}
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center px-8 py-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  {t('auth.getStarted')}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center px-8 py-4 bg-white text-gray-900 font-semibold rounded-xl hover:bg-gray-50 transition-all shadow-lg border-2 border-gray-200"
                >
                  {t('auth.signIn')}
                </Link>
              </div>

              <p className="text-sm text-gray-500">
                No credit card required • Free forever • Cancel anytime
              </p>
            </div>

            {/* Right Column - Features Showcase */}
            <div className="hidden lg:block">
              <div className="relative">
                {/* Main Card */}
                <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                          <Shield className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Secure Access</p>
                          <p className="font-semibold text-gray-900">Enterprise Grade</p>
                        </div>
                      </div>
                      <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                        Active
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {features.map((feature, index) => (
                        <div
                          key={index}
                          className="p-4 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100 hover:shadow-md transition-shadow"
                        >
                          <feature.icon className="h-6 w-6 text-blue-600 mb-2" />
                          <p className="text-sm font-semibold text-gray-900 mb-1">
                            {feature.title}
                          </p>
                          <p className="text-xs text-gray-600">
                            {feature.description}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="pt-4 border-t border-gray-100">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Join thousands of users</span>
                        <div className="flex -space-x-2">
                          {[1, 2, 3, 4].map((i) => (
                            <div
                              key={i}
                              className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 border-2 border-white"
                            />
                          ))}
                          <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center">
                            <span className="text-xs font-medium text-gray-600">+5K</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating Stats */}
                <div className="absolute -top-4 -right-4 bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="h-5 w-5 text-yellow-500" />
                    <div>
                      <p className="text-xs text-gray-500">Active Bookings</p>
                      <p className="text-lg font-bold text-gray-900">2,847</p>
                    </div>
                  </div>
                </div>

                <div className="absolute -bottom-4 -left-4 bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                  <div className="flex items-center space-x-2">
                    <CalendarCheck className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="text-xs text-gray-500">This Month</p>
                      <p className="text-lg font-bold text-gray-900">+1,234</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trust Indicators */}
      <div className="bg-white py-12 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500 mb-8">
            Trusted by leading hotel chains worldwide
          </p>
          <div className="flex items-center justify-center space-x-12 opacity-50">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="text-2xl font-bold text-gray-400">
                HOTEL {i}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <p className="text-5xl font-bold text-white mb-2">5,000+</p>
              <p className="text-blue-100">Active Users</p>
            </div>
            <div>
              <p className="text-5xl font-bold text-white mb-2">500+</p>
              <p className="text-blue-100">Partner Hotels</p>
            </div>
            <div>
              <p className="text-5xl font-bold text-white mb-2">50K+</p>
              <p className="text-blue-100">Bookings Made</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Ready to get started?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Join thousands of guests enjoying seamless hotel experiences
          </p>
          <Link
            to="/register"
            className="inline-flex items-center justify-center px-8 py-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl"
          >
            Create Free Account
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
