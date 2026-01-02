import { useQuery } from '@tanstack/react-query';
import { timeshareApi } from '@/api/timeshare';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { CreditCard, TrendingUp, Plus, Clock, CheckCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';

export default function Credits() {
  // Get credit wallet
  const { data: wallet, isLoading: walletLoading, error: walletError } = useQuery({
    queryKey: ['creditWallet'],
    queryFn: timeshareApi.getCreditWallet
  });

  // Get credit transactions
  const { data: transactions, isLoading: transactionsLoading, error: transactionsError } = useQuery({
    queryKey: ['creditTransactions'],
    queryFn: timeshareApi.getCreditTransactions
  });

  console.log('💳 Credits Page - Transactions data:', transactions);

  if (walletLoading || transactionsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (walletError || transactionsError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <ErrorMessage message="Error al cargar los créditos" />
      </div>
    );
  }

  // Extract wallet data
  const totalBalance = wallet?.wallet?.totalBalance || 0;
  const totalEarned = wallet?.wallet?.totalEarned || 0;
  const totalSpent = wallet?.wallet?.totalSpent || 0;
  const expiringIn30Days = wallet?.expirations?.in30Days || 0;

  // Active transactions
  const activeTransactions = wallet?.activeTransactions || [];
  
  // All transactions for history
  const allTransactions = Array.isArray(transactions) ? transactions : [];
  
  // Calculate pending credits (ACTIVE transactions with booking_id = pending approval)
  const pendingCredits = allTransactions
    .filter((tx: any) => tx.status === 'ACTIVE' && tx.type === 'SPEND' && tx.bookingId)
    .reduce((sum: number, tx: any) => sum + Math.abs(tx.amount), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link to="/owner/dashboard" className="text-gray-600 hover:text-gray-900">
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">Créditos</h1>
              <p className="mt-1 text-sm text-gray-500">
                Gestiona tus créditos de timeshare
              </p>
            </div>
            <CreditCard className="h-12 w-12 text-blue-600" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Credit Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* Total Balance */}
          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Balance Total</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{totalBalance.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">créditos disponibles</p>
              </div>
              <TrendingUp className="h-12 w-12 text-blue-500 opacity-20" />
            </div>
          </div>

          {/* Total Earned */}
          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Ganados</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{totalEarned.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">créditos totales</p>
              </div>
              <Plus className="h-12 w-12 text-green-500 opacity-20" />
            </div>
          </div>

          {/* Total Spent (Only approved/confirmed) */}
          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Gastados</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{totalSpent.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">confirmados e irrecuperables</p>
              </div>
              <CheckCircle className="h-12 w-12 text-orange-500 opacity-20" />
            </div>
          </div>

          {/* Pending Credits (Awaiting staff approval) */}
          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pendientes</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{pendingCredits.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">esperando aprobación</p>
              </div>
              <Clock className="h-12 w-12 text-yellow-500 opacity-20" />
            </div>
          </div>
        </div>

        {/* Expiring Soon - Moved to info box */}
        {expiringIn30Days > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8 flex items-start gap-3">
            <Clock className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-900">⚠️ Créditos por expirar</p>
              <p className="text-sm text-red-700">
                <strong>{expiringIn30Days.toLocaleString()}</strong> créditos expirarán en los próximos 30 días. ¡Úsalos pronto!
              </p>
            </div>
          </div>
        )}

        {/* Active Credits (with expiration info) */}
        {activeTransactions.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Créditos Activos</h2>
              <p className="text-sm text-gray-500">Créditos disponibles con fecha de expiración</p>
            </div>
            <div className="divide-y divide-gray-200">
              {activeTransactions.map((tx: any) => (
                <div key={tx.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {tx.amount.toLocaleString()} créditos
                          </p>
                          <p className="text-sm text-gray-500">
                            Depositado: {format(parseISO(tx.depositedAt), 'dd/MM/yyyy')}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        Expira: {format(parseISO(tx.expiresAt), 'dd/MM/yyyy')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {tx.daysUntilExpiration} días restantes
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transaction History */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Historial de Transacciones</h2>
            <p className="text-sm text-gray-500">Todas tus transacciones de créditos</p>
          </div>
          {allTransactions.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No hay transacciones aún</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {allTransactions.map((tx: any) => {
                const isDeposit = tx.type === 'DEPOSIT';
                const isPending = tx.status === 'ACTIVE' && tx.type === 'SPEND' && tx.bookingId;
                const isSpent = tx.status === 'SPENT';
                const isRefunded = tx.status === 'REFUNDED';
                
                return (
                  <div key={tx.id} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          {isDeposit ? (
                            <Plus className="h-5 w-5 text-green-500" />
                          ) : isPending ? (
                            <Clock className="h-5 w-5 text-yellow-500" />
                          ) : isRefunded ? (
                            <ArrowLeft className="h-5 w-5 text-blue-500" />
                          ) : (
                            <CheckCircle className="h-5 w-5 text-orange-500" />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900">
                                {isDeposit ? 'Depósito' : isPending ? 'Pendiente' : isRefunded ? 'Reembolsado' : 'Gasto'} - {Math.abs(tx.amount).toLocaleString()} créditos
                              </p>
                              {isPending && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-yellow-100 text-yellow-800">
                                  ⏳ Esperando aprobación
                                </span>
                              )}
                              {isSpent && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-800">
                                  ✓ Confirmado
                                </span>
                              )}
                              {isRefunded && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                                  ↩️ Devuelto
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">
                              {tx.description || 'Sin descripción'}
                            </p>
                            <p className="text-xs text-gray-400">
                              {format(parseISO(tx.createdAt), 'dd/MM/yyyy HH:mm')}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-semibold ${
                          isDeposit || isRefunded ? 'text-green-600' : 
                          isPending ? 'text-yellow-600' : 
                          'text-orange-600'
                        }`}>
                          {isDeposit || isRefunded ? '+' : '-'}{Math.abs(tx.amount).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">
                          Balance: {tx.balanceAfter.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
