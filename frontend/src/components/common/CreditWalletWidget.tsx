import { useEffect, useState } from 'react';
import { Wallet, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { creditsApi } from '@/api/credits';
import type { CreditWallet } from '@/types/credits';

interface CreditWalletWidgetProps {
  userId: number;
  onDepositClick?: () => void;
  className?: string;
}

export default function CreditWalletWidget({ userId, onDepositClick, className = '' }: CreditWalletWidgetProps) {
  const [wallet, setWallet] = useState<CreditWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expiringCredits, setExpiringCredits] = useState<number>(0);

  useEffect(() => {
    loadWalletData();
  }, [userId]);

  const loadWalletData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load wallet and expiring credits in parallel
      const [walletResponse, expiringResponse] = await Promise.all([
        creditsApi.getWallet(userId),
        creditsApi.getExpiringCredits(userId, 30)
      ]);

      if (walletResponse.success) {
        setWallet(walletResponse.wallet);
      }

      if (expiringResponse.success) {
        setExpiringCredits(expiringResponse.expiringCredits.total);
      }
    } catch (err: any) {
      console.error('Error loading wallet:', err);
      setError(err.response?.data?.message || 'Error al cargar la billetera');
    } finally {
      setLoading(false);
    }
  };

  const formatCredits = (amount: number): string => {
    return new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-12 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <p>{error}</p>
        </div>
        <button
          onClick={loadWalletData}
          className="mt-4 text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!wallet) {
    return null;
  }

  return (
    <div className={`bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-lg shadow-lg p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-3 rounded-lg">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Billetera de Créditos</h3>
            <p className="text-sm text-blue-100">Sistema de intercambio</p>
          </div>
        </div>
      </div>

      {/* Balance */}
      <div className="mb-6">
        <p className="text-sm text-blue-100 mb-1">Balance Actual</p>
        <h2 className="text-4xl font-bold">{formatCredits(wallet.balance)}</h2>
        <p className="text-sm text-blue-100 mt-1">créditos disponibles</p>
      </div>

      {/* Expiring Credits Alert */}
      {expiringCredits > 0 && (
        <div className="bg-yellow-500/20 border border-yellow-400/30 rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-300 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-100">
                {formatCredits(expiringCredits)} créditos expiran en 30 días
              </p>
              <p className="text-xs text-yellow-200 mt-1">
                Úsalos antes de que pierdan su validez
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white/10 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-300" />
            <p className="text-xs text-blue-100">Ganados</p>
          </div>
          <p className="text-xl font-semibold">{formatCredits(wallet.total_earned)}</p>
        </div>

        <div className="bg-white/10 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-red-300" />
            <p className="text-xs text-blue-100">Gastados</p>
          </div>
          <p className="text-xl font-semibold">{formatCredits(wallet.total_spent)}</p>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
        <div>
          <p className="text-blue-100">Expirados</p>
          <p className="font-medium">{formatCredits(wallet.total_expired)}</p>
        </div>
        <div>
          <p className="text-blue-100">Reembolsados</p>
          <p className="font-medium">{formatCredits(wallet.total_refunded)}</p>
        </div>
      </div>

      {/* Action Button */}
      {onDepositClick && (
        <button
          onClick={onDepositClick}
          className="w-full bg-white text-blue-700 font-semibold py-3 px-4 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
        >
          <Wallet className="w-4 h-4" />
          Depositar Semana
        </button>
      )}

      {/* Last Updated */}
      <p className="text-xs text-blue-200 text-center mt-4">
        Última actualización: {new Date(wallet.updated_at).toLocaleString('es-ES')}
      </p>
    </div>
  );
}
