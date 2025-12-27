import { useEffect, useState } from 'react';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, X, Clock } from 'lucide-react';
import { creditsApi } from '@/api/credits';
import type { CreditTransaction } from '@/types/credits';

interface ExpirationAlertProps {
  userId: number;
  warningDays?: number;
  onClose?: () => void;
  className?: string;
}

export default function ExpirationAlert({ 
  userId, 
  warningDays = 30,
  onClose,
  className = '' 
}: ExpirationAlertProps) {
  const [expiringTransactions, setExpiringTransactions] = useState<CreditTransaction[]>([]);
  const [totalExpiring, setTotalExpiring] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    loadExpiringCredits();
  }, [userId, warningDays]);

  const loadExpiringCredits = async () => {
    try {
      setLoading(true);
      const response = await creditsApi.getExpiringCredits(userId, warningDays);

      if (response.success) {
        setExpiringTransactions(response.expiringCredits.transactions);
        setTotalExpiring(response.expiringCredits.total);
      }
    } catch (err) {
      console.error('Error loading expiring credits:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    if (onClose) {
      onClose();
    }
  };

  const formatCredits = (amount: number): string => {
    return new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const getUrgencyLevel = (expiresAt: string): 'critical' | 'warning' | 'info' => {
    const daysUntil = differenceInDays(new Date(expiresAt), new Date());
    if (daysUntil <= 7) return 'critical';
    if (daysUntil <= 14) return 'warning';
    return 'info';
  };

  const getUrgencyStyles = (urgency: 'critical' | 'warning' | 'info') => {
    const styles = {
      critical: {
        container: 'bg-red-50 border-red-200',
        icon: 'text-red-600',
        text: 'text-red-900',
        subtext: 'text-red-700',
        badge: 'bg-red-100 text-red-800'
      },
      warning: {
        container: 'bg-yellow-50 border-yellow-200',
        icon: 'text-yellow-600',
        text: 'text-yellow-900',
        subtext: 'text-yellow-700',
        badge: 'bg-yellow-100 text-yellow-800'
      },
      info: {
        container: 'bg-blue-50 border-blue-200',
        icon: 'text-blue-600',
        text: 'text-blue-900',
        subtext: 'text-blue-700',
        badge: 'bg-blue-100 text-blue-800'
      }
    };
    return styles[urgency];
  };

  // Don't show if loading, no expiring credits, or dismissed
  if (loading || totalExpiring === 0 || dismissed) {
    return null;
  }

  // Get the most urgent transaction to determine alert style
  const mostUrgentTransaction = expiringTransactions.reduce((prev, current) => {
    if (!prev.expires_at || !current.expires_at) return prev;
    return new Date(current.expires_at) < new Date(prev.expires_at) ? current : prev;
  }, expiringTransactions[0]);

  const urgency = mostUrgentTransaction.expires_at 
    ? getUrgencyLevel(mostUrgentTransaction.expires_at)
    : 'info';
  
  const styles = getUrgencyStyles(urgency);

  return (
    <div className={`border-2 rounded-lg ${styles.container} ${className}`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className={`w-6 h-6 ${styles.icon} flex-shrink-0 mt-0.5`} />
            <div>
              <h4 className={`font-semibold ${styles.text}`}>
                Créditos Próximos a Expirar
              </h4>
              <p className={`text-sm ${styles.subtext} mt-1`}>
                Tienes <span className="font-semibold">{formatCredits(totalExpiring)} créditos</span> que expirarán en los próximos {warningDays} días
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={handleDismiss}
              className={`${styles.icon} hover:opacity-70 transition-opacity flex-shrink-0`}
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Transactions List */}
        {expiringTransactions.length > 0 && (
          <div className="space-y-2 mt-4">
            {expiringTransactions.slice(0, 3).map((transaction) => {
              if (!transaction.expires_at) return null;
              
              const daysUntil = differenceInDays(new Date(transaction.expires_at), new Date());
              const itemUrgency = getUrgencyLevel(transaction.expires_at);
              const itemStyles = getUrgencyStyles(itemUrgency);

              return (
                <div
                  key={transaction.id}
                  className={`flex items-center justify-between p-3 bg-white rounded-lg border ${
                    itemUrgency === 'critical' 
                      ? 'border-red-200' 
                      : itemUrgency === 'warning'
                      ? 'border-yellow-200'
                      : 'border-blue-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Clock className={`w-4 h-4 ${itemStyles.icon}`} />
                    <div>
                      <p className="font-medium text-gray-900">
                        {formatCredits(transaction.amount)} créditos
                      </p>
                      <p className="text-xs text-gray-600">
                        Expira el {format(new Date(transaction.expires_at), 'dd MMM yyyy', { locale: es })}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${itemStyles.badge}`}>
                    {daysUntil === 0 
                      ? 'Hoy' 
                      : daysUntil === 1 
                      ? 'Mañana'
                      : `${daysUntil} días`}
                  </span>
                </div>
              );
            })}

            {expiringTransactions.length > 3 && (
              <p className="text-xs text-gray-600 text-center pt-2">
                Y {expiringTransactions.length - 3} transacciones más...
              </p>
            )}
          </div>
        )}

        {/* Action suggestion */}
        <div className={`mt-4 p-3 bg-white rounded-lg border ${
          urgency === 'critical' 
            ? 'border-red-200' 
            : urgency === 'warning'
            ? 'border-yellow-200'
            : 'border-blue-200'
        }`}>
          <p className="text-sm text-gray-700">
            <span className="font-medium">💡 Sugerencia:</span> Usa estos créditos para hacer una reserva antes de que expiren.
          </p>
        </div>
      </div>
    </div>
  );
}
