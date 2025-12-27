import { CheckCircle, CreditCard, Wallet, Calendar, MapPin, Users } from 'lucide-react';
import type { PaymentMethod } from './BookingPaymentSelector';

interface BookingConfirmationSummaryProps {
  propertyName: string;
  checkInDate: string;
  checkOutDate: string;
  guests: number;
  roomType?: string;
  requiredCredits: number;
  paymentMethod: PaymentMethod;
  creditsUsed: number;
  amountPaid: number;
  transactionId?: string;
  bookingId?: number;
}

/**
 * Summary shown after successful booking
 * Displays booking details and payment breakdown
 */
export function BookingConfirmationSummary({
  propertyName,
  checkInDate,
  checkOutDate,
  guests,
  roomType,
  requiredCredits,
  paymentMethod,
  creditsUsed,
  amountPaid,
  transactionId,
  bookingId
}: BookingConfirmationSummaryProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const nights = Math.ceil(
    (new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="max-w-2xl mx-auto">
      {/* Success Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Booking Confirmed!</h2>
        <p className="text-gray-600">
          Your reservation has been successfully processed
        </p>
        {bookingId && (
          <p className="text-sm text-gray-500 mt-1">
            Booking ID: <span className="font-mono">#{bookingId}</span>
          </p>
        )}
      </div>

      {/* Booking Details */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
        <div className="bg-primary/5 px-6 py-3 border-b">
          <h3 className="font-semibold text-gray-900">Booking Details</h3>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-gray-600">Property</p>
              <p className="font-medium text-gray-900">{propertyName}</p>
              {roomType && (
                <p className="text-sm text-gray-500 mt-0.5">{roomType}</p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-gray-600">Dates</p>
              <p className="font-medium text-gray-900">
                {formatDate(checkInDate)} → {formatDate(checkOutDate)}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">
                {nights} {nights === 1 ? 'night' : 'nights'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-gray-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-gray-600">Guests</p>
              <p className="font-medium text-gray-900">
                {guests} {guests === 1 ? 'guest' : 'guests'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Summary */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
        <div className="bg-primary/5 px-6 py-3 border-b">
          <h3 className="font-semibold text-gray-900">Payment Summary</h3>
        </div>
        
        <div className="p-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Total booking cost:</span>
            <span className="font-medium">{requiredCredits.toLocaleString()} credits</span>
          </div>

          {paymentMethod === 'credits' && (
            <div className="flex items-center justify-between text-sm bg-blue-50 p-3 rounded">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-blue-600" />
                <span className="text-gray-700">Paid with credits:</span>
              </div>
              <span className="font-semibold text-blue-700">
                {creditsUsed.toLocaleString()} credits
              </span>
            </div>
          )}

          {paymentMethod === 'stripe' && (
            <div className="flex items-center justify-between text-sm bg-purple-50 p-3 rounded">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-purple-600" />
                <span className="text-gray-700">Paid with card:</span>
              </div>
              <span className="font-semibold text-purple-700">
                €{amountPaid.toFixed(2)}
              </span>
            </div>
          )}

          {paymentMethod === 'hybrid' && (
            <>
              <div className="flex items-center justify-between text-sm bg-blue-50 p-3 rounded">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-blue-600" />
                  <span className="text-gray-700">Credits used:</span>
                </div>
                <span className="font-semibold text-blue-700">
                  {creditsUsed.toLocaleString()} credits
                </span>
              </div>
              <div className="flex items-center justify-between text-sm bg-purple-50 p-3 rounded">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-purple-600" />
                  <span className="text-gray-700">Card payment:</span>
                </div>
                <span className="font-semibold text-purple-700">
                  €{amountPaid.toFixed(2)}
                </span>
              </div>
            </>
          )}

          {transactionId && (
            <div className="pt-3 border-t text-xs text-gray-500">
              Transaction ID: <span className="font-mono">{transactionId}</span>
            </div>
          )}
        </div>
      </div>

      {/* Next Steps */}
      <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
        <h4 className="font-medium text-blue-900 mb-2">What's Next?</h4>
        <ul className="space-y-1.5 text-sm text-blue-800">
          <li className="flex items-start gap-2">
            <span className="text-blue-600">•</span>
            <span>A confirmation email has been sent to your registered email address</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600">•</span>
            <span>You can view this booking in your dashboard under "My Bookings"</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600">•</span>
            <span>The property will be notified and will prepare for your arrival</span>
          </li>
          {creditsUsed > 0 && (
            <li className="flex items-start gap-2">
              <span className="text-blue-600">•</span>
              <span>
                {creditsUsed.toLocaleString()} credits have been deducted from your balance
              </span>
            </li>
          )}
        </ul>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-6">
        <a
          href="/guest/bookings"
          className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-center font-medium"
        >
          View My Bookings
        </a>
        <a
          href="/guest/dashboard"
          className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-center font-medium"
        >
          Back to Dashboard
        </a>
      </div>
    </div>
  );
}
