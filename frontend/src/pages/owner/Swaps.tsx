import { useState } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { SwapsBrowseTab } from '@/components/owner/SwapsBrowseTab';
import { SwapsMyRequestsTab } from '@/components/owner/SwapsMyRequestsTab';
import { SwapsCreateTab } from '@/components/owner/SwapsCreateTab';
import { SwapPaymentModal } from '@/components/owner/SwapPaymentModal';
import { useSwaps } from '@/hooks/useSwaps';
import { useWeeks } from '@/hooks/useWeeks';
import { useAuth } from '@/hooks/useAuth';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';
import { paymentMethodApi } from '@/api/paymentMethod';
import { toast } from 'react-hot-toast';
import type { SwapRequest } from '@/types/models';
import type { CreateSwapRequest } from '@/types/api';

type TabType = 'browse' | 'my-requests' | 'create';

export default function Swaps() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { swaps, isLoading, error, createSwap, acceptSwap, isCreating, isAccepting, availableSwaps } = useSwaps();
  const { weeks } = useWeeks('available'); // Only show available weeks for swapping
  const { settings } = usePlatformSettings();
  
  // Check if user has payment method
  const { data: hasPaymentMethod, isLoading: checkingPayment } = useQuery({
    queryKey: ['payment-method-status'],
    queryFn: paymentMethodApi.hasPaymentMethod,
  });
  
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
  const [selectedResponderWeek, setSelectedResponderWeek] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPaymentWarning, setShowPaymentWarning] = useState(false);

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
    
    // Check payment method first
    if (!hasPaymentMethod) {
      setShowPaymentWarning(true);
      return;
    }
    
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
    console.log('[handleAcceptSwap] swap:', swap);
    console.log('[handleAcceptSwap] swap.id:', swap.id);
    console.log('[handleAcceptSwap] selectedResponderWeek:', selectedResponderWeek);
    
    // Check payment method first
    if (!hasPaymentMethod) {
      setShowPaymentWarning(true);
      return;
    }
    
    if (selectedResponderWeek && swap.id) {
      console.log('[handleAcceptSwap] Sending: swapId=', swap.id, 'responderWeekId=', selectedResponderWeek);
      
      acceptSwap(
        { swapId: swap.id, responderWeekId: selectedResponderWeek },
        {
          onSuccess: () => {
            setShowDetails(false);
            setSelectedSwap(null);
            setSelectedResponderWeek(null);
            // Force refetch of weeks to reflect the updated status
            queryClient.refetchQueries({ queryKey: ['weeks'] });
          }
        } as any
      );
    } else {
      console.log('[handleAcceptSwap] Missing selectedResponderWeek or swap.id');
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

  // Get the accommodation type and duration offered in the swap
  const getSwapOfferedDetails = (swap: SwapRequest | null) => {
    if (!swap) return { type: null, duration: null };

    if (swap.RequesterWeek) {
      const start = new Date(swap.RequesterWeek.start_date);
      const end = new Date(swap.RequesterWeek.end_date);
      const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return {
        type: swap.RequesterWeek.accommodation_type,
        duration
      };
    } else if (swap.RequesterBookings && swap.RequesterBookings.length > 0) {
      const checkIn = new Date(swap.RequesterBookings[0].check_in);
      const checkOut = new Date(swap.RequesterBookings[0].check_out);
      const duration = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
      return {
        type: swap.RequesterBookings[0].room_type,
        duration
      };
    }

    return { type: null, duration: null };
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
            availableSwaps={availableSwaps || []}
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
            swaps={swaps || []}
            weeks={weeks}
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
            hasPaymentMethod={hasPaymentMethod}
            getAccommodationTypeName={getAccommodationTypeName}
            getAccommodationTypeEmoji={getAccommodationTypeEmoji}
          />
        )}

        {/* Swap Details Modal */}
        {showDetails && selectedSwap && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            {(() => {
              console.log('[Modal] selectedSwap:', selectedSwap);
              console.log('[Modal] selectedSwap.id:', selectedSwap.id);
              return null;
            })()}
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
                  <p className="text-xs text-gray-600 mb-2">🏨 What they offer:</p>
                  <div className="bg-blue-50 p-3 rounded-lg">
                    {/* Get data from either RequesterWeek or RequesterBookings */}
                    {selectedSwap.RequesterWeek ? (
                      <>
                        <p className="font-semibold text-gray-900">{selectedSwap.RequesterWeek.Property?.name}</p>
                        {selectedSwap.RequesterWeek.Property?.city && selectedSwap.RequesterWeek.Property?.country && (
                          <p className="text-xs text-gray-700 mt-1">📍 {selectedSwap.RequesterWeek.Property.city}, {selectedSwap.RequesterWeek.Property.country}</p>
                        )}
                        <p className="text-sm text-gray-700 mt-2">
                          📅 {new Date(selectedSwap.RequesterWeek.start_date).toLocaleDateString()} -{' '}
                          {new Date(selectedSwap.RequesterWeek.end_date).toLocaleDateString()}
                        </p>
                      </>
                    ) : selectedSwap.RequesterBookings && selectedSwap.RequesterBookings.length > 0 ? (
                      <>
                        <p className="font-semibold text-gray-900">{selectedSwap.RequesterBookings[0].Property?.name}</p>
                        {selectedSwap.RequesterBookings[0].Property?.city && selectedSwap.RequesterBookings[0].Property?.country && (
                          <p className="text-xs text-gray-700 mt-1">📍 {selectedSwap.RequesterBookings[0].Property.city}, {selectedSwap.RequesterBookings[0].Property.country}</p>
                        )}
                        <p className="text-sm text-gray-700 mt-2">
                          📅 {new Date(selectedSwap.RequesterBookings[0].check_in).toLocaleDateString()} -{' '}
                          {new Date(selectedSwap.RequesterBookings[0].check_out).toLocaleDateString()}
                        </p>
                      </>
                    ) : (
                      <p className="text-gray-600">No booking information available</p>
                    )}
                  </div>
                </div>

                {/* Fee */}
                <div>
                  <p className="text-xs text-gray-600 mb-2">💰 Platform Fee:</p>
                  <p className="text-2xl font-bold text-yellow-700">€{settings.swapFee ? Number(settings.swapFee).toFixed(2) : '—'}</p>
                  <p className="text-xs text-gray-600 mt-1">Charged when swap is completed</p>
                </div>

                {/* Accept Swap - Only show if user is NOT the requester */}
                {selectedSwap.status === 'pending' && selectedSwap.requester_id !== user?.id && (
                  <div className="border-t pt-4">
                    <p className="text-sm font-semibold text-gray-900 mb-3">
                      ✓ Select your week to offer in exchange:
                    </p>
                    <p className="text-xs text-gray-600 mb-3">
                      💡 You can exchange weeks of different lengths. Both parties must agree to the terms.
                    </p>
                    {(() => {
                      const offeredDetails = getSwapOfferedDetails(selectedSwap);
                      console.log('[Swaps Modal] Offered details:', offeredDetails);
                      console.log('[Swaps Modal] Available weeks:', weeks.map(w => ({
                        id: w.id,
                        type: w.accommodation_type,
                        status: w.status,
                        start: w.start_date,
                        end: w.end_date,
                        duration: Math.ceil((new Date(w.end_date).getTime() - new Date(w.start_date).getTime()) / (1000 * 60 * 60 * 24))
                      })));

                      // Get IDs of weeks already involved in active swaps (where this user is responder)
                      const weeksInActiveSwaps = new Set(
                        swaps
                          .filter(s => s.status === 'pending' || s.status === 'matched')
                          .map(s => {
                            if (s.responder_source_type === 'week' && s.responder_week_id) {
                              return String(s.responder_week_id);
                            }
                            if (s.responder_source_type === 'booking' && s.responder_source_id) {
                              return `booking_${s.responder_source_id}`;
                            }
                            return null;
                          })
                          .filter(id => id !== null)
                      );

                      console.log('[Swaps Modal] Weeks in active swaps:', Array.from(weeksInActiveSwaps));
                      
                      const compatibleWeeks = weeks.filter((w) => {
                        // Exclude weeks already in active swaps
                        if (weeksInActiveSwaps.has(String(w.id))) {
                          console.log(`[Swaps Modal] Week ${w.id} filtered out: already in active swap`);
                          return false;
                        }

                        // Must be available or confirmed status
                        if (w.status !== 'available' && w.status !== 'confirmed') {
                          console.log(`[Swaps Modal] Week ${w.id} filtered out: status=${w.status}`);
                          return false;
                        }
                        
                        // If swap has type info, must match
                        if (offeredDetails.type) {
                          const normalizedOfferedType = (offeredDetails.type || '').toLowerCase();
                          const normalizedUserType = (w.accommodation_type || '').toLowerCase();
                          if (normalizedUserType !== normalizedOfferedType) {
                            console.log(`[Swaps Modal] Week ${w.id} filtered out: type mismatch ${normalizedUserType} !== ${normalizedOfferedType}`);
                            return false;
                          }
                        }
                        
                        // If swap has duration info, must match
                        if (offeredDetails.duration) {
                          const userDuration = Math.ceil(
                            (new Date(w.end_date).getTime() - new Date(w.start_date).getTime()) / (1000 * 60 * 60 * 24)
                          );
                          if (userDuration !== offeredDetails.duration) {
                            console.log(`[Swaps Modal] Week ${w.id} filtered out: duration mismatch ${userDuration} !== ${offeredDetails.duration}`);
                            return false;
                          }
                        }
                        
                        console.log(`[Swaps Modal] Week ${w.id} MATCHES!`);
                        return true;
                      });

                      console.log('[Swaps Modal] Compatible weeks:', compatibleWeeks.length);

                      if (compatibleWeeks.length === 0) {
                        return (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                            <p className="text-sm text-yellow-800">
                              ⚠️ You don't have any {offeredDetails.type} weeks of {offeredDetails.duration} nights to offer.
                            </p>
                          </div>
                        );
                      }

                      return (
                        <>
                          <select
                            value={selectedResponderWeek || ''}
                            onChange={(e) => {
                              const val = e.target.value || null;
                              console.log('[Swaps Modal] Select changed to:', val);
                              setSelectedResponderWeek(val);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                          >
                            <option value="">{t('common.select')}</option>
                            {compatibleWeeks.map((week) => {
                              const nights = Math.ceil(
                                (new Date(week.end_date).getTime() - new Date(week.start_date).getTime()) / (1000 * 60 * 60 * 24)
                              );
                              return (
                                <option key={week.id} value={String(week.id)}>
                                  {week.Property?.name} - {new Date(week.start_date).toLocaleDateString()} to {new Date(week.end_date).toLocaleDateString()} ({nights}n)
                                </option>
                              );
                            })}
                          </select>
                          <button
                            onClick={() => handleAcceptSwap(selectedSwap)}
                            disabled={!selectedResponderWeek || isAccepting}
                            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-semibold transition"
                          >
                            {isAccepting ? `${t('common.loading')}...` : `✓ ${t('owner.swaps.confirmAccept')}`}
                          </button>
                        </>
                      );
                    })()}
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

        {/* Payment Method Warning Modal */}
        {showPaymentWarning && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
              <div className="text-center">
                <div className="text-5xl mb-4">⚠️</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Método de Pago Requerido
                </h3>
                <p className="text-gray-600 mb-6">
                  Debes configurar un método de pago antes de crear o aceptar intercambios. 
                  Esto permite procesar automáticamente las tarifas cuando el staff apruebe tu solicitud.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowPaymentWarning(false)}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      setShowPaymentWarning(false);
                      navigate('/owner/profile');
                    }}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    Configurar Ahora
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
