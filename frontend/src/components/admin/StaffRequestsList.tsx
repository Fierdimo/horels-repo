import React from 'react';
import { useStaffRequests, useApproveStaffRequest, useRejectStaffRequest } from '@/hooks/useAdmin';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

export const StaffRequestsList: React.FC = () => {
  const { data, isLoading, error } = useStaffRequests();
  const approveMutation = useApproveStaffRequest();
  const rejectMutation = useRejectStaffRequest();

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 p-4">
        Error loading staff requests: {error.message}
      </div>
    );
  }

  const requests = data?.requests || [];

  if (requests.length === 0) {
    return (
      <div className="text-gray-500 p-4">
        No hay solicitudes de personal pendientes.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Email
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Hotel
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Rol
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Fecha
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {requests.map((request) => (
            <tr key={request.id}>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {request.email}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {request.hotelName || 'N/A'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {request.Role?.name || 'guest'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {new Date(request.createdAt).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button
                  onClick={() => approveMutation.mutate(request.id)}
                  disabled={approveMutation.isPending}
                  className="text-green-600 hover:text-green-900 mr-4 disabled:opacity-50"
                >
                  {approveMutation.isPending ? 'Aprobando...' : 'Aprobar'}
                </button>
                <button
                  onClick={() => rejectMutation.mutate(request.id)}
                  disabled={rejectMutation.isPending}
                  className="text-red-600 hover:text-red-900 disabled:opacity-50"
                >
                  {rejectMutation.isPending ? 'Rechazando...' : 'Rechazar'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};