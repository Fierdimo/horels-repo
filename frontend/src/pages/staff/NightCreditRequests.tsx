import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStaffNightCredits } from '@/hooks/useNightCredits';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Calendar, User, Euro, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export default function StaffNightCreditDashboard() {
  const { t } = useTranslation();
  const { pendingRequests, isLoading, approveRequest, rejectRequest } = useStaffNightCredits();

  const [selectedRequest, setSelectedRequest] = useState<number | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');

  const handleApprove = async (requestId: number) => {
    setSelectedRequest(requestId);
    setActionType('approve');
  };

  const handleReject = async (requestId: number) => {
    setSelectedRequest(requestId);
    setActionType('reject');
  };

  const confirmApprove = async () => {
    if (selectedRequest) {
      await approveRequest.mutateAsync({ requestId: selectedRequest, notes });
      setSelectedRequest(null);
      setActionType(null);
      setNotes('');
    }
  };

  const confirmReject = async () => {
    if (selectedRequest && reason.trim()) {
      await rejectRequest.mutateAsync({ requestId: selectedRequest, reason });
      setSelectedRequest(null);
      setActionType(null);
      setReason('');
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t('staff.nightCredits.title')}
          </h1>
          <p className="text-gray-600">
            {t('staff.nightCredits.subtitle')}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('staff.nightCredits.pendingRequests')}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{pendingRequests.length}</p>
              </div>
              <Clock className="h-12 w-12 text-yellow-500 opacity-20" />
            </div>
          </div>
        </div>

        {/* Requests List */}
        {pendingRequests.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {t('staff.nightCredits.allCaughtUp')}
            </h3>
            <p className="text-gray-600">
              {t('staff.nightCredits.noRequestsDesc')}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingRequests.map((request) => (
              <div key={request.id} className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        Request #{request.id}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {request.Property?.name || `Property #${request.property_id}`}
                      </p>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      <Clock className="w-3 h-3 mr-1" />
                      {t('staff.nightCredits.status.pending')}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="flex items-center text-sm">
                      <User className="h-4 w-4 text-gray-400 mr-2" />
                      <div>
                        <p className="text-gray-500">{t('staff.nightCredits.owner')}</p>
                        <p className="font-medium text-gray-900">
                          {request.User?.email || `User #${request.owner_id}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center text-sm">
                      <Euro className="h-4 w-4 text-gray-400 mr-2" />
                      <div>
                        <p className="text-gray-500">{t('staff.nightCredits.revenue')}</p>
                        <p className="font-medium text-green-600">
                          €{((request.additional_commission || 0) / 100).toFixed(2)} {t('staff.nightCredits.commission')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="flex items-center text-sm">
                      <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                      <div>
                        <p className="text-gray-500">{t('staff.nightCredits.checkIn')}</p>
                        <p className="font-medium text-gray-900">
                          {format(parseISO(request.check_in), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center text-sm">
                      <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                      <div>
                        <p className="text-gray-500">{t('staff.nightCredits.checkOut')}</p>
                        <p className="font-medium text-gray-900">
                          {format(parseISO(request.check_out), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="text-sm">
                      <p className="text-gray-500">{t('staff.nightCredits.roomType')}</p>
                      <p className="font-medium text-gray-900">
                        {request.room_type || t('staff.nightCredits.notSpecified')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm bg-blue-50 rounded-lg p-3 mb-4">
                    <div className="flex items-center space-x-4">
                      <div>
                        <span className="text-gray-500">{t('staff.nightCredits.usingCredits')}:</span>
                        <span className="font-medium text-green-600 ml-2">
                          {request.nights_requested} {t('staff.nightCredits.nights')}
                        </span>
                      </div>
                      {request.additional_nights > 0 && (
                        <div>
                          <span className="text-gray-500">{t('staff.nightCredits.purchasing')}:</span>
                          <span className="font-medium text-blue-600 ml-2">
                            {request.additional_nights} {t('staff.nightCredits.nights')} (€{((request.additional_price || 0) / 100).toFixed(2)})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => handleApprove(request.id)}
                      disabled={approveRequest.isPending || rejectRequest.isPending}
                      className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {t('staff.nightCredits.actions.approve')}
                    </button>
                    <button
                      onClick={() => handleReject(request.id)}
                      disabled={approveRequest.isPending || rejectRequest.isPending}
                      className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      {t('staff.nightCredits.actions.reject')}
                    </button>
                  </div>
                </div>

                <div className="bg-gray-50 px-6 py-3 text-xs text-gray-500">
                  {t('staff.nightCredits.requested')}: {format(parseISO(request.created_at), 'MMM d, yyyy h:mm a')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Approve Modal */}
      {actionType === 'approve' && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                {t('staffNightCredits.approveModal.title')}{selectedRequest}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {t('staffNightCredits.approveModal.subtitle')}
              </p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                rows={3}
                placeholder={t('staffNightCredits.approveModal.notesPlaceholder')}
              />
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setSelectedRequest(null);
                    setActionType(null);
                    setNotes('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={confirmApprove}
                  disabled={approveRequest.isPending}
                  className="flex-1 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {approveRequest.isPending ? t('staffNightCredits.approveModal.approving') : t('staffNightCredits.approveModal.confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {actionType === 'reject' && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <AlertTriangle className="h-6 w-6 text-red-600 mr-2" />
                <h3 className="text-lg font-bold text-gray-900">
                  {t('staffNightCredits.rejectModal.title')}{selectedRequest}
                </h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                {t('staffNightCredits.rejectModal.subtitle')}
              </p>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                rows={3}
                placeholder={t('staffNightCredits.rejectModal.reasonPlaceholder')}
                required
              />
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setSelectedRequest(null);
                    setActionType(null);
                    setReason('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={confirmReject}
                  disabled={!reason.trim() || rejectRequest.isPending}
                  className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {rejectRequest.isPending ? t('staffNightCredits.rejectModal.rejecting') : t('staffNightCredits.rejectModal.confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
