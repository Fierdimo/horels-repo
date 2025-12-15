import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

export default function BookingAccess() {
  const { t } = useTranslation();
  const { token } = useParams();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">{t('guest.booking.title')}</h1>
        <p className="text-gray-600">Token: {token}</p>
      </div>
    </div>
  );
}
