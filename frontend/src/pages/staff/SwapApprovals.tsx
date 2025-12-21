import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { useSwaps } from '@/hooks/useSwaps';
import type { SwapRequest } from '@/types/models';

export default function StaffSwapApprovals() {
  const { t } = useTranslation();
  const { pendingSwaps, pendingLoading, approveSwap, approvingSwap, rejectStaffSwap, rejectingStaffSwap } = useSwaps();
  
  const [selectedSwap, setSelectedSwap] = useState<SwapRequest | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [approveNotes, setApproveNotes] = useState('');

  if (pendingLoading) {
    return <LoadingSpinner />;
  }

  const getAccommodationTypeName = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'sencilla':
        return 'Sencilla';
      case 'duplex':
        return 'Duplex';
      case 'suite':
        return 'Suite';
      default:
        return type;
    }
  };

  const getAccommodationTypeEmoji = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'sencilla':
        return '🛏️';
      case 'duplex':
        return '🏠';
      case 'suite':
        return '👑';
      default:
        return '🏘️';
    }
  };

  const handleApprove = () => {
    if (selectedSwap?.id) {
      approveSwap(
        { swapId: selectedSwap.id, notes: approveNotes },
        {
          onSuccess: () => {
            setShowDetails(false);
            setSelectedSwap(null);
            setApproveNotes('');
          }
        } as any
      );
    }
  };

  const handleReject = () => {
    if (selectedSwap?.id && rejectReason) {
      rejectStaffSwap(
        { swapId: selectedSwap.id, reason: rejectReason },
        {
          onSuccess: () => {
            setShowDetails(false);
            setSelectedSwap(null);
            setRejectReason('');
            setShowRejectForm(false);
          }
        } as any
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t('staff.swaps.title', { defaultValue: 'Swap Requests Review' })}
          </h1>
          <p className="text-gray-600">
            {t('staff.swaps.description', { defaultValue: 'Review and approve week swap requests from owners' })}
          </p>
        </div>

        {/* Pending Swaps Count */}
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800 font-semibold">
            {pendingSwaps.length} {t('staff.swaps.pendingCount', { defaultValue: 'pending swaps awaiting approval' })}
          </p>
        </div>

        {/* Empty State */}
        {pendingSwaps.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-600 text-lg">
              ✓ {t('staff.swaps.noRequests', { defaultValue: 'No swap requests to review at the moment' })}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingSwaps.map((swap) => (
              <div
                key={swap.id}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition cursor-pointer border-l-4 border-yellow-500"
                onClick={() => {
                  setSelectedSwap(swap);
                  setShowDetails(true);
                  setShowRejectForm(false);
                  setRejectReason('');
                  setApproveNotes('');
                }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Requester Week */}
                  <div>
                    <p className="text-xs text-gray-600 mb-2">
                      {t('staff.swaps.requesterOffers', { defaultValue: 'Requester Offers' })}
                    </p>
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="font-semibold text-gray-900">
                        {getAccommodationTypeEmoji(swap.RequesterWeek?.accommodation_type || '')} 
                        {' '}{getAccommodationTypeName(swap.RequesterWeek?.accommodation_type || '')}
                      </p>
                      <p className="text-sm text-gray-700 mt-1">
                        {swap.RequesterWeek?.Property?.name}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        📅{' '}
                        {new Date(swap.RequesterWeek?.start_date || '').toLocaleDateString()} -{' '}
                        {new Date(swap.RequesterWeek?.end_date || '').toLocaleDateString()}
                      </p>
                      <p className="text-xs text-gray-600 mt-2">
                        👤 {swap.Requester?.firstName || swap.Requester?.email || 'Unknown'} {swap.Requester?.lastName || ''}
                      </p>
                    </div>
                  </div>

                  {/* Responder Week (if selected) */}
                  {swap.responder_week_id && swap.ResponderWeek ? (
                    <div>
                      <p className="text-xs text-gray-600 mb-2">
                        {t('staff.swaps.responderOffers', { defaultValue: 'Responder Offers' })}
                      </p>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <p className="font-semibold text-gray-900">
                          {getAccommodationTypeEmoji(swap.ResponderWeek?.accommodation_type || '')}
                          {' '}{getAccommodationTypeName(swap.ResponderWeek?.accommodation_type || '')}
                        </p>
                        <p className="text-sm text-gray-700 mt-1">
                          {swap.ResponderWeek?.Property?.name}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          📅{' '}
                          {new Date(swap.ResponderWeek?.start_date || '').toLocaleDateString()} -{' '}
                          {new Date(swap.ResponderWeek?.end_date || '').toLocaleDateString()}
                        </p>
                        <p className="text-xs text-gray-600 mt-2">
                          👤 {swap.Responder?.firstName || swap.Responder?.email || 'Unknown'} {swap.Responder?.lastName || ''}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-gray-600 mb-2">
                        {t('staff.swaps.awaitingResponder', { defaultValue: 'Awaiting Responder Selection' })}
                      </p>
                      <div className="bg-gray-50 p-4 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center h-full">
                        <p className="text-gray-600 text-sm text-center">
                          ⏳ {t('staff.swaps.responderPending', { defaultValue: 'Waiting for a property owner to respond with their available week' })}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Fee Info */}
                <div className="mt-4 pt-4 border-t flex justify-between items-center">
                  <span className="text-gray-700 font-semibold">
                    {t('staff.swaps.platformFee', { defaultValue: 'Platform Fee' })}
                  </span>
                  <span className="text-xl font-bold text-yellow-700">€{swap.swap_fee || 10}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Swap Details Modal */}
        {showDetails && selectedSwap && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gray-100 px-6 py-4 border-b flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">
                  {t('staff.swaps.reviewSwap', { defaultValue: 'Review Swap Request' })}
                </h2>
                <button
                  onClick={() => {
                    setShowDetails(false);
                    setSelectedSwap(null);
                  }}
                  className="text-gray-600 hover:text-gray-900 text-2xl leading-none"
                >
                  ×
                </button>
              </div>

              <div className="px-6 py-6 space-y-6">
                {/* Requester Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    {t('staff.swaps.requesterInfo', { defaultValue: 'Requester Information' })}
                  </h3>
                  <div className="bg-blue-50 p-4 rounded-lg space-y-3">
                    <div>
                      <p className="text-xs text-gray-600">Name</p>
                      <p className="font-semibold text-gray-900">
                        {selectedSwap.Requester?.firstName || selectedSwap.Requester?.email || 'Unknown'} {selectedSwap.Requester?.lastName || ''}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Email</p>
                      <p className="text-gray-900">{selectedSwap.Requester?.email}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">
                        {t('staff.swaps.offeringAccommodation', { defaultValue: 'Offering Accommodation Type' })}
                      </p>
                      <p className="text-gray-900 font-semibold">
                        {getAccommodationTypeEmoji(selectedSwap.RequesterWeek?.accommodation_type || '')}
                        {' '}{getAccommodationTypeName(selectedSwap.RequesterWeek?.accommodation_type || '')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Week</p>
                      <p className="text-gray-900">
                        {new Date(selectedSwap.RequesterWeek?.start_date || '').toLocaleDateString()} -{' '}
                        {new Date(selectedSwap.RequesterWeek?.end_date || '').toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Property</p>
                      <p className="text-gray-900">{selectedSwap.RequesterWeek?.Property?.name}</p>
                    </div>
                  </div>
                </div>

                {/* Responder Information */}
                {selectedSwap.responder_week_id && selectedSwap.ResponderWeek && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      {t('staff.swaps.responderInfo', { defaultValue: 'Responder Information' })}
                    </h3>
                    <div className="bg-green-50 p-4 rounded-lg space-y-3">
                      <div>
                        <p className="text-xs text-gray-600">Name</p>
                        <p className="font-semibold text-gray-900">
                          {selectedSwap.Responder?.firstName || selectedSwap.Responder?.email || 'Unknown'} {selectedSwap.Responder?.lastName || ''}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Email</p>
                        <p className="text-gray-900">{selectedSwap.Responder?.email}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">
                          {t('staff.swaps.offeringAccommodation', { defaultValue: 'Offering Accommodation Type' })}
                        </p>
                        <p className="text-gray-900 font-semibold">
                          {getAccommodationTypeEmoji(selectedSwap.ResponderWeek?.accommodation_type || '')}
                          {' '}{getAccommodationTypeName(selectedSwap.ResponderWeek?.accommodation_type || '')}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Week</p>
                        <p className="text-gray-900">
                          {new Date(selectedSwap.ResponderWeek?.start_date || '').toLocaleDateString()} -{' '}
                          {new Date(selectedSwap.ResponderWeek?.end_date || '').toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Property</p>
                        <p className="text-gray-900">{selectedSwap.ResponderWeek?.Property?.name}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Fee Information */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-yellow-900 font-semibold">
                      {t('staff.swaps.platformFeeTotal', { defaultValue: 'Total Platform Fee' })}
                    </span>
                    <span className="text-2xl font-bold text-yellow-700">€{selectedSwap.swap_fee || 10}</span>
                  </div>
                  <p className="text-xs text-yellow-800 mt-2">
                    {t('staff.swaps.feeDescription', { defaultValue: 'This fee will be charged to both owners when the swap is completed' })}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="border-t pt-6">
                  {!showRejectForm ? (
                    <div className="space-y-3">
                      {/* Approve Section */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          {t('staff.swaps.approveNotes', { defaultValue: 'Approval Notes (Optional)' })}
                        </label>
                        <textarea
                          value={approveNotes}
                          onChange={(e) => setApproveNotes(e.target.value)}
                          placeholder="Any notes about this approval..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                          rows={3}
                        />
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={handleApprove}
                          disabled={approvingSwap}
                          className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg font-semibold transition"
                        >
                          {approvingSwap ? '⏳ Processing' : '✓ Approve Swap'}
                        </button>
                        <button
                          onClick={() => setShowRejectForm(true)}
                          disabled={rejectingStaffSwap}
                          className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg font-semibold transition"
                        >
                          {rejectingStaffSwap ? '⏳ Processing' : '✗ Reject'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {t('staff.swaps.rejectReason', { defaultValue: 'Reason for Rejection' })}
                      </label>
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Explain why you're rejecting this swap request..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                        rows={4}
                        required
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            setShowRejectForm(false);
                            setRejectReason('');
                          }}
                          className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg font-semibold transition"
                        >
                          {t('common.cancel')}
                        </button>
                        <button
                          onClick={handleReject}
                          disabled={!rejectReason || rejectingStaffSwap}
                          className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg font-semibold transition"
                        >
                          {rejectingStaffSwap ? '⏳ Processing' : 'Confirm Rejection'}
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setShowDetails(false);
                      setSelectedSwap(null);
                      setShowRejectForm(false);
                    }}
                    className="w-full mt-3 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg font-semibold transition"
                  >
                    {t('common.close')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
