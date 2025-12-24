import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useOwnerNightCredits } from '@/hooks/useNightCredits';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Plus, Calendar, Euro, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import PaymentModal from '@/components/owner/PaymentModal';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export default function MyNightCreditRequests() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { requests, isLoading, cancelRequest } = useOwnerNightCredits();

  const [selectedRequestForPayment, setSelectedRequestForPayment] = useState<number | null>(null);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            {t('owner.nightCredits.status.pending')}
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <AlertCircle className="w-3 h-3 mr-1" />
            {t('owner.nightCredits.status.approved')}
          </span>
        );
      case 'paid':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            {t('owner.nightCredits.status.paid')}
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            {t('owner.nightCredits.status.completed')}
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            {t('owner.nightCredits.status.rejected')}
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <XCircle className="w-3 h-3 mr-1" />
            {t('owner.nightCredits.status.cancelled')}
          </span>
        );
      default:
        return <span className="text-gray-600">{status}</span>;
    }
  };

  const handleCancelRequest = async (requestId: number) => {
    if (confirm(t('owner.nightCredits.cancelConfirm'))) {
      await cancelRequest.mutateAsync(requestId);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {t('owner.nightCredits.myRequests')}
            </h1>
            <p className="text-gray-600">
              {t('owner.nightCredits.viewManageRequests')}
            </p>
          </div>
          <Link
            to="/owner/night-credit-requests/new"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="h-5 w-5 mr-2" />
            {t('owner.nightCredits.newRequest')}
          </Link>
        </div>

        {/* Requests List */}
        {requests.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Calendar className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {t('owner.nightCredits.noRequests')}
            </h3>
            <p className="text-gray-600 mb-6">
              {t('owner.nightCredits.noRequestsDesc')}
            </p>
            <button
              onClick={() => navigate('/owner/night-credit-requests/new')}
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-5 w-5 mr-2" />
              {t('owner.nightCredits.createRequest')}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div key={request.id} className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200 hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {t('owner.nightCredits.requestId')}{request.id}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {request.Property?.name || `${t('owner.nightCredits.property')} #${request.property_id}`}
                      </p>
                    </div>
                    {getStatusBadge(request.status)}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="flex items-center text-sm">
                      <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                      <div>
                        <p className="text-gray-500">{t('owner.nightCredits.checkInDate')}</p>
                        <p className="font-medium text-gray-900">
                          {format(parseISO(request.check_in), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center text-sm">
                      <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                      <div>
                        <p className="text-gray-500">{t('owner.nightCredits.checkOutDate')}</p>
                        <p className="font-medium text-gray-900">
                          {format(parseISO(request.check_out), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center text-sm">
                      <Euro className="h-4 w-4 text-gray-400 mr-2" />
                      <div>
                        <p className="text-gray-500">{t('owner.nightCredits.totalCost')}</p>
                        <p className="font-medium text-gray-900">
                          €{((request.total_amount || 0) / 100).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm bg-gray-50 rounded-lg p-3 mb-4">
                    <div className="flex items-center space-x-4">
                      <div>
                        <span className="text-gray-500">{t('owner.nightCredits.usingCredits')}:</span>
                        <span className="font-medium text-green-600 ml-2">
                          {request.nights_requested} {t('owner.nightCredits.nights')} ({t('owner.nightCredits.free')})
                        </span>
                      </div>
                      {request.additional_nights > 0 && (
                        <div>
                          <span className="text-gray-500">{t('owner.nightCredits.buying')}:</span>
                          <span className="font-medium text-blue-600 ml-2">
                            {request.additional_nights} {t('owner.nightCredits.nights')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action buttons based on status */}
                  <div className="flex gap-3">
                    {request.status === 'pending' && (
                      <button
                        onClick={() => handleCancelRequest(request.id)}
                        disabled={cancelRequest.isPending}
                        className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        {t('owner.nightCredits.actions.cancel')}
                      </button>
                    )}

                    {request.status === 'approved' && request.additional_nights > 0 && (
                      <button
                        onClick={() => setSelectedRequestForPayment(request.id)}
                        className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        {t('owner.nightCredits.actions.payNow')} (€{((request.additional_price + request.additional_commission) / 100).toFixed(2)})
                      </button>
                    )}

                    {request.status === 'rejected' && request.rejection_reason && (
                      <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3 flex-1">
                        <span className="font-medium">{t('owner.nightCredits.rejectionReason')}:</span> {request.rejection_reason}
                      </div>
                    )}

                    {request.status === 'completed' && request.booking_id && (
                      <Link
                        to={`/owner/bookings/${request.booking_id}`}
                        className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        {t('owner.nightCredits.actions.viewBooking')}
                      </Link>
                    )}
                  </div>

                  {request.staff_notes && (
                    <div className="mt-4 text-sm text-gray-600 bg-blue-50 rounded-lg p-3">
                      <span className="font-medium">{t('owner.nightCredits.staffNotes')}:</span> {request.staff_notes}
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 px-6 py-3 text-xs text-gray-500">
                  {t('owner.nightCredits.created')}: {format(parseISO(request.created_at), 'MMM d, yyyy h:mm a')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {selectedRequestForPayment && (
        <Elements stripe={stripePromise}>
          <PaymentModal
            requestId={selectedRequestForPayment}
            onClose={() => setSelectedRequestForPayment(null)}
          />
        </Elements>
      )}
    </div>
  );
}
