
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import PaymentModal from './PaymentModal';
import { paymentsApi } from '@/api/payments';

interface ConfirmWeekModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (extraNights: number, paymentIntentId?: string) => void;
  week: any;
}

export default function ConfirmWeekModal({onClose, onConfirm, open, week}: ConfirmWeekModalProps){
  const { t } = useTranslation();
  const [extraNights, setExtraNights] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  if (!open) return null;

  // Lógica de negocio: precio y comisión
  const pricePerNight = 100; // Precio base por noche extra (puede venir de API)
  const commissionRate = 0.12; // Comisión plataforma (12%)
  const hotelAmount = extraNights * pricePerNight;
  const commission = Math.round(hotelAmount * commissionRate);
  const totalAmount = hotelAmount + commission;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
        <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
          <h2 className="text-xl font-bold mb-2">{t('owner.weeks.confirmTitle')}</h2>
          <p className="mb-4 text-gray-600">{t('owner.weeks.confirmDesc', { property: week.Property?.name })}</p>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('owner.weeks.extraNights')}
            </label>
            <input
              type="number"
              min={0}
              max={7}
              value={extraNights}
              onChange={e => setExtraNights(Number(e.target.value))}
              className="border rounded px-2 py-1 w-20"
            />
            <span className="ml-2 text-xs text-gray-500">{t('owner.weeks.extraNightsHelp')}</span>
          </div>
          {extraNights > 0 && (
            <div className="mb-2 text-xs text-blue-700 font-semibold">
              {t('payment.amount')}: {hotelAmount} EUR + {commission} EUR (fee) = <b>{totalAmount} EUR</b>
            </div>
          )}
          {paymentError && <div className="text-red-600 text-xs mb-2">{paymentError}</div>}
          <div className="flex justify-end gap-2 mt-6">
            <button onClick={onClose} className="px-4 py-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200">
              {t('common.cancel')}
            </button>
            <button
              onClick={async () => {
                setPaymentError(null);
                if (extraNights > 0) {
                  setLoading(true);
                  try {
                    // Crear PaymentIntent con Stripe (negocio: hotel_payment, metadata)
                    const paymentIntent = await paymentsApi.createPaymentIntent({
                      amount: totalAmount,
                      currency: 'EUR',
                      type: 'hotel_payment',
                      metadata: {
                        weekId: week.id,
                        extraNights,
                        hotelAmount,
                        commission
                      }
                    });
                    setPaymentIntentId(paymentIntent.paymentIntentId);
                    setShowPayment(true);
                  } catch (err: any) {
                    setPaymentError(err.message || 'Error creando pago');
                  }
                  setLoading(false);
                } else {
                  setLoading(true);
                  onConfirm(0);
                  setLoading(false);
                }
              }}
              className="px-4 py-2 rounded bg-primary text-white hover:bg-primary/90"
              disabled={loading}
            >
              {loading ? t('common.loading') : t('owner.weeks.confirmAction')}
            </button>
          </div>
        </div>
      </div>
      {/* Payment Modal for extra nights */}
      <PaymentModal
        currency='EUR'
        open={showPayment}
        onClose={() => setShowPayment(false)}
        amount={totalAmount}
        onPay={(stripePaymentIntentId) => {
          setShowPayment(false);
          setLoading(true);
          // Confirmar semana con paymentIntentId y extraNights
          if (onConfirm && paymentIntentId) {
            onConfirm(extraNights, paymentIntentId);
          }
          setLoading(false);
        }}
      />
    </>
  );
}
