import { useTranslation } from 'react-i18next';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

export default function Swaps() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">{t('owner.swaps.title')}</h1>
        <p className="text-gray-600">{t('common.loading')}</p>
        <LoadingSpinner />
      </div>
    </div>
  );
}
