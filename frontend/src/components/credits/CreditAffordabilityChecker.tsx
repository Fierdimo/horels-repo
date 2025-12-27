import { useQuery } from '@tanstack/react-query';
import { creditsApi } from '@/api/credits';
import { Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface CreditAffordabilityCheckerProps {
  propertyId: number;
  checkInDate: string;
  checkOutDate: string;
  roomTypeId?: number;
  onAffordabilityChange?: (canAfford: boolean, requiredCredits: number) => void;
}

/**
 * Component to check if user has enough credits for a booking
 * Shows real-time affordability status as booking details change
 */
export function CreditAffordabilityChecker({
  propertyId,
  checkInDate,
  checkOutDate,
  roomTypeId,
  onAffordabilityChange
}: CreditAffordabilityCheckerProps) {
  // Get user's credit balance
  const { data: wallet, isLoading: loadingWallet } = useQuery({
    queryKey: ['creditWallet'],
    queryFn: creditsApi.getWallet,
  });

  // Estimate required credits for this booking
  const { data: estimate, isLoading: loadingEstimate } = useQuery({
    queryKey: ['creditEstimate', propertyId, checkInDate, checkOutDate, roomTypeId],
    queryFn: () => creditsApi.estimateBookingCost({
      property_id: propertyId,
      check_in_date: checkInDate,
      check_out_date: checkOutDate,
      room_type_id: roomTypeId,
    }),
    enabled: !!(propertyId && checkInDate && checkOutDate),
  });

  const isLoading = loadingWallet || loadingEstimate;
  const availableCredits = wallet?.balance || 0;
  const requiredCredits = estimate?.total_credits || 0;
  const canAfford = availableCredits >= requiredCredits;

  // Notify parent of affordability status
  React.useEffect(() => {
    if (!isLoading && estimate) {
      onAffordabilityChange?.(canAfford, requiredCredits);
    }
  }, [canAfford, requiredCredits, isLoading, estimate, onAffordabilityChange]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Checking credit affordability...</span>
      </div>
    );
  }

  if (!estimate) {
    return null;
  }

  return (
    <div className={`rounded-lg border p-4 ${
      canAfford ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
    }`}>
      <div className="flex items-start gap-3">
        {canAfford ? (
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
        ) : (
          <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h4 className={`font-medium ${
              canAfford ? 'text-green-900' : 'text-red-900'
            }`}>
              {canAfford ? 'You can afford this booking!' : 'Insufficient credits'}
            </h4>
          </div>

          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Required credits:</span>
              <span className="font-semibold">{requiredCredits.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Your balance:</span>
              <span className={`font-semibold ${
                canAfford ? 'text-green-700' : 'text-red-700'
              }`}>
                {availableCredits.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between border-t pt-1.5 mt-1.5">
              <span className="text-gray-600">
                {canAfford ? 'Remaining after booking:' : 'Credits needed:'}
              </span>
              <span className={`font-semibold ${
                canAfford ? 'text-gray-900' : 'text-red-700'
              }`}>
                {canAfford 
                  ? (availableCredits - requiredCredits).toLocaleString()
                  : (requiredCredits - availableCredits).toLocaleString()
                }
              </span>
            </div>
          </div>

          {/* Breakdown of costs */}
          {estimate.breakdown && (
            <details className="mt-3">
              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                View cost breakdown
              </summary>
              <div className="mt-2 space-y-1 text-xs text-gray-600 pl-2 border-l-2 border-gray-200">
                <div className="flex justify-between">
                  <span>Base cost:</span>
                  <span>{estimate.breakdown.base_cost.toLocaleString()} credits</span>
                </div>
                {estimate.breakdown.seasonal_multiplier !== 1 && (
                  <div className="flex justify-between">
                    <span>Seasonal adjustment (×{estimate.breakdown.seasonal_multiplier}):</span>
                    <span>
                      {((estimate.breakdown.seasonal_multiplier - 1) * estimate.breakdown.base_cost).toLocaleString()} credits
                    </span>
                  </div>
                )}
                {estimate.breakdown.room_type_multiplier !== 1 && (
                  <div className="flex justify-between">
                    <span>Room type adjustment (×{estimate.breakdown.room_type_multiplier}):</span>
                    <span>
                      {((estimate.breakdown.room_type_multiplier - 1) * estimate.breakdown.base_cost).toLocaleString()} credits
                    </span>
                  </div>
                )}
              </div>
            </details>
          )}

          {/* Warning if credits will be low */}
          {canAfford && (availableCredits - requiredCredits) < 100 && (
            <div className="flex items-start gap-2 mt-3 text-xs text-amber-700 bg-amber-50 p-2 rounded">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <span>Your credit balance will be low after this booking. Consider depositing more weeks.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
