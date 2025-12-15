import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ErrorMessageProps {
  message?: string;
  error?: Error | null;
}

export function ErrorMessage({ message, error }: ErrorMessageProps) {
  const { t } = useTranslation();

  const displayMessage = message || error?.message || t('common.somethingWentWrong');

  return (
    <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
      <AlertCircle className="h-5 w-5 flex-shrink-0" />
      <p className="text-sm">{displayMessage}</p>
    </div>
  );
}
