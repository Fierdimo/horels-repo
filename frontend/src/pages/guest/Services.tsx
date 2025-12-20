import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Clock, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import axios from 'axios';

const AVAILABLE_SERVICES = [
  { id: 'room-service', name: 'Room Service', icon: '🍽️', description: 'Food and beverage delivered to your room' },
  { id: 'housekeeping', name: 'Housekeeping', icon: '🧹', description: 'Room cleaning and tidying' },
  { id: 'concierge', name: 'Concierge', icon: '🎫', description: 'Arrange activities and reservations' },
  { id: 'laundry', name: 'Laundry Service', icon: '👔', description: 'Clothing and garment care' },
  { id: 'maintenance', name: 'Maintenance', icon: '🔧', description: 'Report and fix room issues' },
  { id: 'spa', name: 'Spa Service', icon: '💆', description: 'Massage and wellness treatments' },
  { id: 'transportation', name: 'Transportation', icon: '🚕', description: 'Car rental or shuttle service' },
  { id: 'dining', name: 'Restaurant Reservation', icon: '🍽️', description: 'Reserve dining at partners' },
];

interface ServiceRequest {
  id: number;
  service_type: string;
  status: string;
  notes: string;
  price?: number;
  requested_at: string;
  payment?: {
    clientSecret: string;
    paymentIntentId: string;
  };
}

export default function Services() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const bookingToken = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [services, setServices] = useState<ServiceRequest[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedService, setSelectedService] = useState<string>('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch existing service requests
  useEffect(() => {
    const fetchServices = async () => {
      if (!bookingToken) {
        setError('Booking token not found');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await axios.get(`/api/hotels/guest/services/${bookingToken}`);
        setServices(response.data.services || []);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load services');
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, [bookingToken]);

  const handleSubmitService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) {
      setError('Please select a service');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      
      const payload = {
        service_type: selectedService,
        description: description || undefined,
        amount: amount ? parseFloat(amount) : undefined,
        currency: 'EUR'
      };

      const response = await axios.post(`/api/hotels/guest/services/${bookingToken}`, payload);
      
      // Add new service to list
      setServices([response.data.serviceRequest, ...services]);
      
      // Reset form
      setSelectedService('');
      setDescription('');
      setAmount('');
      setShowForm(false);
      setSuccess('Service requested successfully!');
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to request service');
    } finally {
      setSubmitting(false);
    }
  };

  const getServiceName = (serviceId: string) => {
    return AVAILABLE_SERVICES.find(s => s.id === serviceId)?.name || serviceId;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'requested':
        return 'bg-yellow-50 border-yellow-200';
      case 'confirmed':
        return 'bg-blue-50 border-blue-200';
      case 'completed':
        return 'bg-green-50 border-green-200';
      case 'cancelled':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="h-5 w-5 text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'requested':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'cancelled':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('guest.services.title')}</h1>
            <p className="text-gray-600 mt-1">{t('guest.services.request')}</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition"
          >
            <Plus className="h-5 w-5" />
            Request Service
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Alerts */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <p className="text-red-700">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex gap-3">
            <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
            <p className="text-green-700">{success}</p>
          </div>
        )}

        {/* Request Form */}
        {showForm && (
          <div className="mb-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Request a Service</h2>
            <form onSubmit={handleSubmitService} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Service Type
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {AVAILABLE_SERVICES.map(service => (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => setSelectedService(service.id)}
                      className={`p-3 rounded-lg border-2 text-center transition ${
                        selectedService === service.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-2xl mb-1">{service.icon}</div>
                      <div className="text-sm font-medium">{service.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {selectedService && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                  {AVAILABLE_SERVICES.find(s => s.id === selectedService)?.description}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add any special requests or details..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount (EUR) - Optional
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Leave empty if not applicable"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">If specified, payment will be requested at checkout</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={submitting || !selectedService}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white py-2 rounded-lg transition font-medium flex items-center justify-center gap-2"
                >
                  {submitting && <Loader className="h-4 w-4 animate-spin" />}
                  Submit Request
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setSelectedService('');
                    setDescription('');
                    setAmount('');
                  }}
                  className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 py-2 rounded-lg transition font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Service Requests List */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Your Service Requests</h2>
          
          {services.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg">
              <p className="text-gray-600">No service requests yet</p>
              <p className="text-sm text-gray-500 mt-1">Request a service to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {services.map(service => (
                <div
                  key={service.id}
                  className={`p-4 rounded-lg border-2 ${getStatusColor(service.status)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-1">
                        {getStatusIcon(service.status)}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">
                          {getServiceName(service.service_type)}
                        </h3>
                        {service.notes && (
                          <p className="text-sm text-gray-600 mt-1">{service.notes}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(service.requested_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-white bg-opacity-60">
                        {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
                      </span>
                      {service.price && (
                        <p className="text-sm font-semibold text-gray-900 mt-2">
                          €{service.price.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
