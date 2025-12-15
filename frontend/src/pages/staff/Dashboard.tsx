import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Clock, CheckCircle, Users, Calendar, AlertCircle, Bed, ArrowRight } from 'lucide-react';
import apiClient from '@/api/client';

export default function StaffDashboard() {
  const { t } = useTranslation();

  // Fetch hotel services
  const { data: servicesData, isLoading: servicesLoading } = useQuery({
    queryKey: ['staff-services'],
    queryFn: async () => {
      const { data } = await apiClient.get('/hotel-staff/services');
      return data;
    }
  });

  // Fetch rooms for the property
  const { data: roomsData } = useQuery({
    queryKey: ['staff-rooms'],
    queryFn: async () => {
      const { data } = await apiClient.get('/hotel-staff/rooms');
      return data;
    }
  });

  // Fetch bookings (check-ins/check-outs)
  const { data: bookingsData } = useQuery({
    queryKey: ['staff-bookings'],
    queryFn: async () => {
      const { data } = await apiClient.get('/dashboard/bookings');
      return data;
    }
  });

  // Calculate stats
  const services = Array.isArray(servicesData?.services) ? servicesData.services : [];
  const pendingServices = services.filter((s: any) => s.status === 'pending').length;
  const confirmedServices = services.filter((s: any) => s.status === 'confirmed').length;
  
  const bookings = Array.isArray(bookingsData?.bookings) ? bookingsData.bookings : [];
  const today = new Date().toISOString().split('T')[0];
  const todayCheckIns = bookings.filter((b: any) => b.check_in_date?.startsWith(today)).length;
  const todayCheckOuts = bookings.filter((b: any) => b.check_out_date?.startsWith(today)).length;

  const rooms = Array.isArray(roomsData?.rooms) ? roomsData.rooms : [];
  const totalRooms = rooms.length;
  const availableRooms = rooms.filter((r: any) => r.status === 'available' || r.status === 'disponible').length;

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center space-x-3 mb-2">
          <Users className="h-8 w-8" />
          <h1 className="text-2xl font-bold">{t('staff.dashboard.title')}</h1>
        </div>
        <p className="text-blue-100">{t('staff.dashboard.subtitle')}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Pending Services */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            {pendingServices > 0 && (
              <span className="px-3 py-1 bg-red-100 text-red-600 text-sm font-semibold rounded-full">
                {pendingServices}
              </span>
            )}
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{t('staff.dashboard.pendingServices')}</h3>
          <p className="text-sm text-gray-600">{t('staff.dashboard.requiresAttention')}</p>
        </div>

        {/* Confirmed Services */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{t('staff.dashboard.confirmedServices')}</h3>
          <p className="text-2xl font-bold text-blue-600">{confirmedServices}</p>
        </div>

        {/* Today Check-ins */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Calendar className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{t('staff.dashboard.todayCheckIns')}</h3>
          <p className="text-2xl font-bold text-green-600">{todayCheckIns}</p>
        </div>

        {/* Today Check-outs */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Calendar className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{t('staff.dashboard.todayCheckOuts')}</h3>
          <p className="text-2xl font-bold text-purple-600">{todayCheckOuts}</p>
        </div>
      </div>

      {/* Quick Actions */}
      {pendingServices > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-lg">
          <div className="flex items-start">
            <AlertCircle className="h-6 w-6 text-yellow-600 mt-0.5" />
            <div className="ml-4 flex-1">
              <h3 className="text-lg font-semibold text-yellow-800">{t('staff.dashboard.actionRequired')}</h3>
              <p className="text-sm text-yellow-700 mt-1">
                {t('staff.dashboard.pendingServicesMessage', { count: pendingServices })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Services List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{t('staff.services.title')}</h2>
            <p className="text-sm text-gray-600 mt-1">{t('staff.services.manageRequests')}</p>
          </div>
          <Link
            to="/staff/services"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center"
          >
            {t('common.viewAll')}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </div>
        
        {servicesLoading ? (
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-20 bg-gray-200 rounded"></div>
              <div className="h-20 bg-gray-200 rounded"></div>
            </div>
          </div>
        ) : services.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-gray-900">{t('staff.services.noServices')}</h3>
            <p className="text-sm text-gray-500 mt-1">{t('staff.services.allProcessed')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {services.slice(0, 5).map((service: any) => (
              <div key={service.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{service.service_type || service.serviceType}</p>
                        <p className="text-sm text-gray-500 mt-1">{service.description}</p>
                        {service.Booking && (
                          <p className="text-xs text-gray-400 mt-1">
                            {t('staff.services.room')}: {service.Booking.room_number || service.Booking.roomNumber}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="ml-4">
                    {service.status === 'pending' && (
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                        {t('staff.services.pending')}
                      </span>
                    )}
                    {service.status === 'confirmed' && (
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                        {t('staff.services.confirmed')}
                      </span>
                    )}
                    {service.status === 'completed' && (
                      <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                        {t('staff.services.completed')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rooms Overview */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{t('staff.dashboard.roomsOverview')}</h2>
            <p className="text-sm text-gray-600 mt-1">{t('staff.dashboard.currentOccupancy')}</p>
          </div>
          <Link
            to="/staff/rooms"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center"
          >
            {t('staff.dashboard.manageRooms')}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-600 mb-1">{t('staff.dashboard.totalRooms')}</p>
              <p className="text-2xl font-bold text-gray-900">{totalRooms}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">{t('staff.dashboard.availableRooms')}</p>
              <p className="text-2xl font-bold text-green-600">{availableRooms}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">{t('staff.dashboard.occupiedRooms')}</p>
              <p className="text-2xl font-bold text-blue-600">{totalRooms - availableRooms}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
