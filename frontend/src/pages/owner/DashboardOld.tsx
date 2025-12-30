import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { useAuth } from '@/hooks/useAuth';
import { Calendar, Repeat, CreditCard, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { logout } = useAuth();

  const cards = [
    { title: t('owner.dashboard.myWeeks'), icon: Calendar, link: '/owner/weeks', color: 'bg-blue-500' },
    { title: t('owner.dashboard.mySwaps'), icon: Repeat, link: '/owner/swaps', color: 'bg-green-500' },
    { title: t('owner.dashboard.myCredits'), icon: CreditCard, link: '/owner/credits', color: 'bg-purple-500' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">
            {t('owner.dashboard.welcome', { name: user?.email.split('@')[0] })}
          </h1>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <LogOut className="h-5 w-5" />
            {t('auth.logout')}
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map((card) => (
            <Link
              key={card.link}
              to={card.link}
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
            >
              <div className={`${card.color} w-12 h-12 rounded-lg flex items-center justify-center mb-4`}>
                <card.icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">{card.title}</h3>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
