import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  RefreshCw, 
  AlertCircle,
  Clock,
  Filter,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { creditsApi } from '@/api/credits';
import type { CreditTransaction, TransactionType, TransactionStatus } from '@/types/credits';

interface TransactionHistoryTableProps {
  userId: number;
  pageSize?: number;
  className?: string;
}

export default function TransactionHistoryTable({ 
  userId, 
  pageSize = 10,
  className = '' 
}: TransactionHistoryTableProps) {
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);

  useEffect(() => {
    loadTransactions();
  }, [userId, currentPage, pageSize]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await creditsApi.getTransactions(userId, currentPage, pageSize);

      if (response.success) {
        setTransactions(response.transactions);
        setTotalPages(response.pagination.totalPages);
        setTotalTransactions(response.pagination.total);
      }
    } catch (err: any) {
      console.error('Error loading transactions:', err);
      setError(err.response?.data?.message || 'Error al cargar transacciones');
    } finally {
      setLoading(false);
    }
  };

  const getTransactionIcon = (type: TransactionType, status: TransactionStatus) => {
    if (status === 'EXPIRED') {
      return <Clock className="w-5 h-5 text-gray-400" />;
    }

    switch (type) {
      case 'DEPOSIT':
        return <ArrowUpCircle className="w-5 h-5 text-green-500" />;
      case 'SPEND':
        return <ArrowDownCircle className="w-5 h-5 text-red-500" />;
      case 'REFUND':
        return <RefreshCw className="w-5 h-5 text-blue-500" />;
      case 'EXPIRE':
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
      case 'ADJUSTMENT':
        return <Filter className="w-5 h-5 text-purple-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getTypeLabel = (type: TransactionType): string => {
    const labels: Record<TransactionType, string> = {
      DEPOSIT: 'Depósito',
      SPEND: 'Gasto',
      REFUND: 'Reembolso',
      EXPIRE: 'Expiración',
      ADJUSTMENT: 'Ajuste'
    };
    return labels[type];
  };

  const getStatusLabel = (status: TransactionStatus): string => {
    const labels: Record<TransactionStatus, string> = {
      PENDING: 'Pendiente',
      COMPLETED: 'Completado',
      SPENT: 'Gastado',
      EXPIRED: 'Expirado',
      CANCELLED: 'Cancelado'
    };
    return labels[status];
  };

  const getStatusColor = (status: TransactionStatus): string => {
    const colors: Record<TransactionStatus, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      COMPLETED: 'bg-green-100 text-green-800',
      SPENT: 'bg-blue-100 text-blue-800',
      EXPIRED: 'bg-gray-100 text-gray-800',
      CANCELLED: 'bg-red-100 text-red-800'
    };
    return colors[status];
  };

  const formatAmount = (amount: number, type: TransactionType): string => {
    const formatted = new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(Math.abs(amount));

    const sign = type === 'DEPOSIT' || type === 'REFUND' ? '+' : '-';
    return `${sign}${formatted}`;
  };

  const formatDate = (dateString: string): string => {
    return format(new Date(dateString), 'dd MMM yyyy, HH:mm', { locale: es });
  };

  if (loading && transactions.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
        <h3 className="text-lg font-semibold mb-4">Historial de Transacciones</h3>
        <div className="animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/3"></div>
              </div>
              <div className="h-6 bg-gray-200 rounded w-20"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
        <h3 className="text-lg font-semibold mb-4">Historial de Transacciones</h3>
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <p>{error}</p>
        </div>
        <button
          onClick={loadTransactions}
          className="mt-4 text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-md ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Historial de Transacciones</h3>
          <button
            onClick={loadTransactions}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            title="Actualizar"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          {totalTransactions} transacciones en total
        </p>
      </div>

      {/* Transactions List */}
      <div className="divide-y divide-gray-200">
        {transactions.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No hay transacciones todavía</p>
            <p className="text-sm mt-1">Tus movimientos de créditos aparecerán aquí</p>
          </div>
        ) : (
          transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="flex-shrink-0 mt-1">
                  {getTransactionIcon(transaction.type, transaction.status)}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-gray-900">
                        {getTypeLabel(transaction.type)}
                      </p>
                      {transaction.description && (
                        <p className="text-sm text-gray-600 mt-1">
                          {transaction.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(transaction.status)}`}>
                          {getStatusLabel(transaction.status)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDate(transaction.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="text-right flex-shrink-0">
                      <p className={`text-lg font-semibold ${
                        transaction.type === 'DEPOSIT' || transaction.type === 'REFUND'
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}>
                        {formatAmount(transaction.amount, transaction.type)}
                      </p>
                      {transaction.expires_at && transaction.status === 'COMPLETED' && (
                        <p className="text-xs text-gray-500 mt-1">
                          Expira: {format(new Date(transaction.expires_at), 'dd/MM/yyyy')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Reference Info */}
                  {transaction.reference_type && (
                    <div className="mt-2 text-xs text-gray-500">
                      Ref: {transaction.reference_type} #{transaction.reference_id}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-gray-200 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Página {currentPage} de {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1 || loading}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || loading}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
