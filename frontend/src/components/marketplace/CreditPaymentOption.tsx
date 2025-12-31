import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Wallet, Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { timeshareApi } from '@/api/timeshare';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface CreditPaymentOptionProps {
  propertyId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  totalAmount: number;
  nights: number;
}

export default function CreditPaymentOption({
  propertyId,
  roomId,
  checkIn,
  checkOut,
  guests,
  guestName,
  guestEmail,
  guestPhone,
  totalAmount,
  nights
}: CreditPaymentOptionProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Fetch credit wallet
  const { data: walletData, isLoading: loadingWallet } = useQuery({
    queryKey: ['credit-wallet'],
    queryFn: timeshareApi.getCreditWallet,
    staleTime: 30000 // 30 seconds
  });

  const wallet = walletData || null;
  
  // TODO: Calculate actual credits required based on season/tier/room type
  // For now: 1 credit = 1 EUR
  const creditsRequired = Math.round(totalAmount);
  const hasEnoughCredits = wallet && wallet.total_balance >= creditsRequired;
  const creditDeficit = creditsRequired - (wallet?.total_balance || 0);

  // Mutation to create booking with credits
  const bookMutation = useMutation({
    mutationFn: () => timeshareApi.bookRoomWithCredits({
      propertyId: parseInt(propertyId),
      roomId: parseInt(roomId),
      guestName,
      guestEmail,
      guestPhone,
      checkIn,
      checkOut,
      guests
    }),
    onSuccess: (response) => {
      toast.success(t('marketplace.bookingCreatedPendingApproval'));
      queryClient.invalidateQueries({ queryKey: ['credit-wallet'] });
      queryClient.invalidateQueries({ queryKey: ['credit-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['owner-bookings'] });
      
      // Navigate to success/pending page
      navigate('/owner/bookings', {
        state: { message: 'Booking created. Awaiting staff approval.' }
      });
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || error.message || t('marketplace.bookingError');
      toast.error(message);
    }
  });

  if (loadingWallet) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <LoadingSpinner size="sm" />
      </div>
    );
  }

  if (!wallet) {
    return null; // No wallet = no credits option
  }

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-6 border-2 border-purple-200">
      <div className="flex items-start gap-3 mb-4">
        <Wallet className="h-6 w-6 text-purple-600 flex-shrink-0 mt-1" />
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900 mb-1">
            {t('marketplace.payWithCredits')}
          </h3>
          <p className="text-sm text-gray-600">
            {t('marketplace.payWithCreditsDescription')}
          </p>
        </div>
      </div>

      {/* Credit Balance */}
      <div className="bg-white rounded-lg p-4 mb-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase mb-1">{t('credits.available')}</p>
            <p className="text-2xl font-bold text-purple-600">
              {wallet.total_balance.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">{t('credits.credits')}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase mb-1">{t('credits.required')}</p>
            <p className="text-2xl font-bold text-gray-900">
              {creditsRequired.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">{t('credits.credits')}</p>
          </div>
        </div>

        {!hasEnoughCredits && (
          <div className="mt-3 flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded p-3">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>
              {t('credits.insufficientCredits')} ({creditDeficit} {t('credits.creditsShort')})
            </span>
          </div>
        )}
      </div>

      {/* Pending Approval Notice */}
      <div className="bg-blue-50 rounded-lg p-3 mb-4 flex items-start gap-2">
        <Clock className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800">
          <strong>{t('marketplace.pendingApprovalNotice')}:</strong>{' '}
          {t('marketplace.creditBookingsRequireApproval')}
        </p>
      </div>

      {/* Action Button */}
      {hasEnoughCredits ? (
        <>
          <button
            onClick={() => setShowConfirmation(true)}
            disabled={bookMutation.isPending}
            className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-semibold"
          >
            {bookMutation.isPending ? (
              <>
                <LoadingSpinner size="sm" />
                {t('common.processing')}
              </>
            ) : (
              <>
                <Wallet className="h-5 w-5" />
                {t('marketplace.bookWithCredits')}
              </>
            )}
          </button>

          {/* Confirmation Modal */}
          {showConfirmation && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-md w-full p-6">
                <h3 className="text-xl font-bold mb-4">{t('marketplace.confirmBookingWithCredits')}</h3>
                
                <div className="space-y-3 mb-6 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('marketplace.nights')}:</span>
                    <span className="font-medium">{nights}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('credits.creditsToSpend')}:</span>
                    <span className="font-bold text-purple-600">{creditsRequired}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('credits.remainingBalance')}:</span>
                    <span className="font-medium">{wallet.total_balance - creditsRequired}</span>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-6 text-xs text-yellow-800">
                  <strong>{t('common.important')}:</strong> {t('marketplace.creditsWillBeHeldUntilApproval')}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowConfirmation(false)}
                    className="flex-1 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={() => {
                      setShowConfirmation(false);
                      bookMutation.mutate();
                    }}
                    disabled={bookMutation.isPending}
                    className="flex-1 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-300 transition-colors font-semibold"
                  >
                    {t('common.confirm')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <button
          disabled
          className="w-full py-3 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed flex items-center justify-center gap-2 font-semibold"
        >
          <AlertCircle className="h-5 w-5" />
          {t('credits.insufficientCredits')}
        </button>
      )}

      <p className="text-xs text-center text-gray-500 mt-3">
        {t('marketplace.or')}{' '}
        <span className="text-gray-700 font-medium">{t('marketplace.continueToPayWithCard')}</span>
      </p>
    </div>
  );
}
