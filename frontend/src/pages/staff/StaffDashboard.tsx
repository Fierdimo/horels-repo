import React from 'react';
import { StaffRequestsList } from '@/components/admin/StaffRequestsList';

const StaffDashboard: React.FC = () => {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Panel de Personal</h1>

      <h2 className="text-lg font-semibold mb-2">Solicitudes de Personal Pendientes</h2>
      <StaffRequestsList />

      <div className="mt-8">
        <p className="text-gray-500">Aquí irá el listado de servicios pendientes y acciones adicionales.</p>
      </div>
    </div>
  );
};

export default StaffDashboard;
