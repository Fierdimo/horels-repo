import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useState } from 'react';
import { Utensils, Coffee, Wrench, Bell, CheckCircle, Clock, XCircle, Loader2, ArrowLeft } from 'lucide-react';
import { bookingsApi } from '@/api/bookings';
import toast from 'react-hot-toast';

export default function GuestServiceRequest() {
  const { t } = useTranslation();
  const { bookingId } = useParams();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const preselectedType = searchParams.get('type');
  
  const [serviceType, setServiceType] = useState(preselectedType || '');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState(1);

  // Get booking details
  const { data: bookingData, isLoading: loadingBooking } = useQuery({
    queryKey: ['booking', bookingId],
    queryFn: () => bookingsApi.getBookingById(Number(bookingId)),
    enabled: !!bookingId,
  });

  // Get existing service requests
  const { data: servicesData, isLoading: loadingServices } = useQuery({
    queryKey: ['bookingServices', bookingId],
    queryFn: () => bookingsApi.getBookingServices(Number(bookingId)),
    enabled: !!bookingId,
  });

  // Create service request mutation
  const createServiceMutation = useMutation({
    mutationFn: (data: { service_type: string; notes?: string; quantity?: number }) =>
      bookingsApi.requestService(Number(bookingId), data),
    onSuccess: () => {
      toast.success(t('guest.services.requestSuccess') || 'Service requested successfully');
      queryClient.invalidateQueries({ queryKey: ['bookingServices', bookingId] });
      setServiceType('');
      setDescription('');
      setQuantity(1);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('common.somethingWentWrong') || 'Something went wrong');
    },
  });

  const booking = bookingData?.booking;
  const services = servicesData?.services || [];

  const serviceTypes = [
    {
      value: 'room_service',
      label: t('guest.dashboard.roomService') || 'Room Service',
      icon: <Utensils className="h-6 w-6" />,
      color: 'orange',
      description: t('guest.dashboard.orderFoodDrinks') || 'Order food & drinks to your room',
    },
    {
      value: 'housekeeping',
      label: t('guest.dashboard.housekeeping') || 'Housekeeping',
      icon: <Coffee className="h-6 w-6" />,
      color: 'blue',
      description: t('guest.dashboard.requestCleaning') || 'Request cleaning or amenities',
    },
    {
      value: 'maintenance',
      label: t('guest.dashboard.maintenance') || 'Maintenance',
      icon: <Wrench className="h-6 w-6" />,
      color: 'red',
      description: t('guest.dashboard.reportIssues') || 'Report room issues or repairs',
    },
    {
      value: 'concierge',
      label: t('guest.dashboard.concierge') || 'Concierge',
      icon: <Bell className="h-6 w-6" />,
      color: 'purple',
      description: t('guest.dashboard.getAssistance') || 'Get assistance with local activities',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': case 'approved': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'in_progress': case 'approved': return <Clock className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'cancelled': case 'rejected': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceType) {
      toast.error(t('guest.services.selectServiceType') || 'Please select a service type');
      return;
    }
    createServiceMutation.mutate({
      service_type: serviceType,
      notes: description,
      quantity,
    });
  };

  if (loadingBooking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-5 w-5" />
            {t('common.back') || 'Back'}
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {t('guest.services.title') || 'Service Requests'}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {booking?.Property?.name || t('guest.bookings.bookingId') || 'Booking'} #{bookingId}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Request Form */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              {t('guest.services.newRequest') || 'New Service Request'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Service Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  {t('guest.services.serviceType') || 'Service Type'}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {serviceTypes.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setServiceType(type.value)}
                      className={`p-4 rounded-lg border-2 transition text-left ${
                        serviceType === type.value
                          ? `border-${type.color}-500 bg-${type.color}-50`
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className={`text-${type.color}-600 mb-2`}>{type.icon}</div>
                      <p className="font-semibold text-gray-900 text-sm">{type.label}</p>
                      <p className="text-xs text-gray-500 mt-1">{type.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity */}
              {serviceType === 'room_service' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('guest.services.quantity') || 'Quantity'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('guest.services.description') || 'Description'}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder={t('guest.services.descriptionPlaceholder') || 'Please provide details about your request...'}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={createServiceMutation.isPending || !serviceType}
                className="w-full bg-primary text-white py-3 rounded-lg hover:bg-primary/90 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {createServiceMutation.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {t('common.processing') || 'Processing...'}
                  </>
                ) : (
                  <>{t('guest.services.submitRequest') || 'Submit Request'}</>
                )}
              </button>
            </form>
          </div>

          {/* Existing Requests */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              {t('guest.services.myRequests') || 'My Requests'}
            </h2>

            {loadingServices ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : services.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">
                  {t('guest.services.noRequests') || 'No service requests yet'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {services.map((service) => (
                  <div key={service.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {serviceTypes.find(t => t.value === service.service_type)?.label || service.service_type}
                        </p>
                        <p className="text-xs text-gray-500">
                          {t('guest.services.requestedAt') || 'Requested'}: {new Date(service.requested_at || service.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(service.status)}`}>
                        {getStatusIcon(service.status)}
                        {service.status.toUpperCase()}
                      </span>
                    </div>
                    {(service.notes || service.description) && (
                      <p className="text-sm text-gray-600 mt-2 p-3 bg-gray-50 rounded">
                        {service.notes || service.description}
                      </p>
                    )}
                    {service.quantity && service.quantity > 1 && (
                      <p className="text-xs text-gray-500 mt-2">
                        {t('guest.services.quantity') || 'Quantity'}: {service.quantity}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
