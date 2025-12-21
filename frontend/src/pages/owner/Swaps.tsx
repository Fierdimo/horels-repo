import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { SwapsBrowseTab } from '@/components/owner/SwapsBrowseTab';
import { SwapsMyRequestsTab } from '@/components/owner/SwapsMyRequestsTab';
import { SwapsCreateTab } from '@/components/owner/SwapsCreateTab';
import { SwapPaymentModal } from '@/components/owner/SwapPaymentModal';
import { useSwaps } from '@/hooks/useSwaps';
import { useWeeks } from '@/hooks/useWeeks';
import { useAuth } from '@/hooks/useAuth';
import type { SwapRequest } from '@/types/models';
import type { CreateSwapRequest } from '@/types/api';

type TabType = 'browse' | 'my-requests' | 'create';

export default function Swaps() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { swaps, isLoading, error, createSwap, acceptSwap, isCreating, isAccepting, availableSwaps } = useSwaps();
  const { weeks } = useWeeks();
  
  // Tab navigation
  const [activeTab, setActiveTab] = useState<TabType>('browse');
  
  // Create form state
  const [formData, setFormData] = useState<CreateSwapRequest>({
    requester_week_id: 0,
    desired_start_date: '',
    desired_property_id: 0
  });

  const [selectedSwap, setSelectedSwap] = useState<SwapRequest | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedResponderWeek, setSelectedResponderWeek] = useState<number | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Only show loading if both are loading for the first time
  const isInitialLoading = isLoading;

  if (isInitialLoading) {
    return <LoadingSpinner />;
  }

  // Debug info if no user or error
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <ErrorMessage message="You must be logged in to view swaps" />
          <div className="mt-4 text-center">
            <a href="/login" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition inline-block">
              Go to Login
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <ErrorMessage message={t('common.error')} />
          <div className="mt-4 text-center">
            <p className="text-gray-600 mb-4">{t('owner.swaps.loadError')}</p>
            <p className="text-sm text-gray-500 mb-4">User: {user?.email}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              {t('common.retry')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Get user's owned week types (from weeks AND marketplace bookings)
  // The backend filters based on actual booking types, so if availableSwaps exist, 
  // the user has compatible bookings
  const userWeekAccommodationTypes = [
    ...new Set(weeks.map(w => w.accommodation_type))
  ];

  // availableSwaps come directly from the hook (already filtered by backend)

  const handleCreateSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.requester_week_id) {
      createSwap(formData, {
        onSuccess: () => {
          setActiveTab('my-requests');
          setFormData({
            requester_week_id: 0,
            desired_start_date: '',
            desired_property_id: 0
          });
        }
      } as any);
    }
  };

  const handleAcceptSwap = (swap: SwapRequest) => {
    if (selectedResponderWeek && swap.id) {
      acceptSwap(
        { swapId: swap.id, data: { responderWeekId: selectedResponderWeek } },
        {
          onSuccess: () => {
            setShowDetails(false);
            setSelectedSwap(null);
            setSelectedResponderWeek(null);
          }
        } as any
      );
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'matched':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'matched':
        return '✓';
      case 'completed':
        return '✓✓';
      case 'cancelled':
        return '✗';
      default:
        return '•';
    }
  };

  // Accommodation type name helper
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

  // Get visual indicator for accommodation type
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

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('owner.swaps.title')}</h1>
          <p className="text-gray-600">{t('common.description')}</p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 bg-white rounded-lg shadow-md overflow-hidden">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('browse')}
              className={`flex-1 px-6 py-4 font-semibold text-center transition ${
                activeTab === 'browse'
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              🔍 {t('owner.swaps.browseSwaps')} {availableSwaps.length > 0 && <span className="ml-2 bg-blue-600 text-white rounded-full w-6 h-6 inline-flex items-center justify-center text-sm">{availableSwaps.length}</span>}
            </button>
            <button
              onClick={() => setActiveTab('my-requests')}
              className={`flex-1 px-6 py-4 font-semibold text-center transition ${
                activeTab === 'my-requests'
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              📋 {t('owner.swaps.myRequests')} {swaps.length > 0 && <span className="ml-2 bg-blue-600 text-white rounded-full w-6 h-6 inline-flex items-center justify-center text-sm">{swaps.length}</span>}
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`flex-1 px-6 py-4 font-semibold text-center transition ${
                activeTab === 'create'
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              ➕ {t('owner.swaps.createRequest')}
            </button>
          </div>
        </div>

        {/* TAB 1: BROWSE AVAILABLE SWAPS */}
        {activeTab === 'browse' && (
          <SwapsBrowseTab
            availableSwaps={availableSwaps}
            weeks={weeks}
            userWeekAccommodationTypes={userWeekAccommodationTypes}
            onSelectSwap={(swap) => {
              setSelectedSwap(swap);
              setShowDetails(true);
            }}
            onCreateRequest={() => setActiveTab('create')}
            getAccommodationTypeName={getAccommodationTypeName}
            getAccommodationTypeEmoji={getAccommodationTypeEmoji}
            getStatusColor={getStatusColor}
            getStatusIcon={getStatusIcon}
          />
        )}

        {/* TAB 2: MY SWAP REQUESTS */}
        {activeTab === 'my-requests' && (
          <SwapsMyRequestsTab
            swaps={swaps}
            weeks={weeks}
            onSelectSwap={(swap) => {
              setSelectedSwap(swap);
              setShowDetails(true);
            }}
            onCreateRequest={() => setActiveTab('create')}
            getStatusColor={getStatusColor}
            getStatusIcon={getStatusIcon}
          />
        )}

        {/* TAB 3: CREATE SWAP REQUEST */}
        {activeTab === 'create' && (
          <SwapsCreateTab
            formData={formData}
            onFormChange={setFormData}
            onSubmit={handleCreateSwap}
            onCancel={() => setActiveTab('browse')}
            weeks={weeks}
            isCreating={isCreating}
            getAccommodationTypeName={getAccommodationTypeName}
            getAccommodationTypeEmoji={getAccommodationTypeEmoji}
          />
        )}

        {/* Swap Details Modal */}
        {showDetails && selectedSwap && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gray-100 px-6 py-4 border-b flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">
                  {t('owner.swaps.details')}
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

              <div className="px-6 py-4 space-y-4">
                {/* Status */}
                <div>
                  <p className="text-xs text-gray-600 mb-1">{t('common.status')}</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(selectedSwap.status)}`}>
                    {getStatusIcon(selectedSwap.status)} {t(`common.${selectedSwap.status}`)}
                  </span>
                </div>

                {/* What They Offer */}
                <div>
                  <p className="text-xs text-gray-600 mb-2">What they offer:</p>
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="font-semibold text-gray-900">{selectedSwap.RequesterWeek?.Property?.name}</p>
                    <p className="text-sm text-gray-700 mt-1">
                      {new Date(selectedSwap.RequesterWeek?.start_date || '').toLocaleDateString()} -{' '}
                      {new Date(selectedSwap.RequesterWeek?.end_date || '').toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Fee */}
                <div>
                  <p className="text-xs text-gray-600 mb-2">Platform Fee:</p>
                  <p className="text-2xl font-bold text-yellow-700">€{selectedSwap.swap_fee}</p>
                  <p className="text-xs text-gray-600 mt-1">Charged to both owners when swap is completed</p>
                </div>

                {/* Accept Swap - Only show if user is NOT the requester */}
                {selectedSwap.status === 'pending' && selectedSwap.requester_id !== user?.id && (
                  <div className="border-t pt-4">
                    <p className="text-sm font-semibold text-gray-900 mb-3">
                      Select which of your weeks to offer in exchange:
                    </p>
                    <p className="text-xs text-gray-600 mb-3">
                      💡 You can exchange weeks of different lengths. Both parties must agree to the terms.
                    </p>
                    <select
                      value={selectedResponderWeek || ''}
                      onChange={(e) =>
                        setSelectedResponderWeek(
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                    >
                      <option value="">{t('common.select')}</option>
                      {weeks
                        .filter(
                          (w) =>
                            w.status === 'available' && 
                            w.Property?.id === selectedSwap.RequesterWeek?.Property?.id
                        )
                        .map((week) => {
                          const nights = Math.ceil(
                            (new Date(week.end_date).getTime() - new Date(week.start_date).getTime()) / (1000 * 60 * 60 * 24)
                          );
                          const requesterNights = Math.ceil(
                            (new Date(selectedSwap.RequesterWeek?.end_date || '').getTime() - new Date(selectedSwap.RequesterWeek?.start_date || '').getTime()) / (1000 * 60 * 60 * 24)
                          );
                          return (
                            <option key={week.id} value={week.id}>
                              {new Date(week.start_date).toLocaleDateString()} -{' '}
                              {new Date(week.end_date).toLocaleDateString()}{' '}
                              ({nights} nights) {nights !== requesterNights && `vs ${requesterNights} nights offered`}
                            </option>
                          );
                        })}
                    </select>
                    <button
                      onClick={() => handleAcceptSwap(selectedSwap)}
                      disabled={!selectedResponderWeek || isAccepting}
                      className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-semibold transition"
                    >
                      {isAccepting
                        ? t('common.processing')
                        : t('owner.swaps.confirmAccept')}
                    </button>
                  </div>
                )}

                {/* Payment Button - Show when swap is matched and requester is viewing their swap */}
                {selectedSwap.status === 'matched' && selectedSwap.requester_id === user?.id && (
                  <div className="border-t pt-4">
                    <button
                      onClick={() => {
                        setShowDetails(false);
                        setShowPaymentModal(true);
                      }}
                      className="w-full bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg font-semibold transition"
                    >
                      💳 {t('owner.swaps.proceedPayment', { defaultValue: 'Proceed to Payment' })}
                    </button>
                  </div>
                )}

                {/* Close Button */}
                <button
                  onClick={() => {
                    setShowDetails(false);
                    setSelectedSwap(null);
                    setSelectedResponderWeek(null);
                  }}
                  className="w-full bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg font-semibold transition"
                >
                  {t('common.close')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && selectedSwap && (
          <SwapPaymentModal
            swap={selectedSwap}
            onClose={() => {
              setShowPaymentModal(false);
              setSelectedSwap(null);
            }}
            onSuccess={() => {
              setShowPaymentModal(false);
              setSelectedSwap(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
