import React, { useState } from 'react';
import { ServiceStatusActions } from './ServiceStatusActions';

export type ServiceStatus = 'solicitado' | 'confirmado' | 'completado';

export interface PendingService {
  id: number;
  tipo: string;
  estado: ServiceStatus;
  propiedad: string;
  fecha: string;
  usuario: string;
}

interface PendingServicesListProps {
  services: PendingService[];
}

const statusColors: Record<ServiceStatus, string> = {
  solicitado: 'bg-yellow-200 text-yellow-800',
  confirmado: 'bg-blue-200 text-blue-800',
  completado: 'bg-green-200 text-green-800',
};

export const PendingServicesList: React.FC<PendingServicesListProps> = ({ services }) => {
  const [localServices, setLocalServices] = useState(services);

  const handleStatusChange = (id: number, newStatus: ServiceStatus) => {
    setLocalServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, estado: newStatus } : s))
    );
    // TODO: Llamar API para actualizar en backend
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border">Servicio</th>
            <th className="p-2 border">Estado</th>
            <th className="p-2 border">Propiedad</th>
            <th className="p-2 border">Fecha</th>
            <th className="p-2 border">Usuario</th>
            <th className="p-2 border">Acción</th>
          </tr>
        </thead>
        <tbody>
          {localServices.map((s) => (
            <tr key={s.id}>
              <td className="p-2 border">{s.tipo}</td>
              <td className="p-2 border">
                <span className={`px-2 py-1 rounded text-xs font-semibold ${statusColors[s.estado]}`}>{s.estado}</span>
              </td>
              <td className="p-2 border">{s.propiedad}</td>
              <td className="p-2 border">{s.fecha}</td>
              <td className="p-2 border">{s.usuario}</td>
              <td className="p-2 border">
                <ServiceStatusActions status={s.estado} onChange={(newStatus) => handleStatusChange(s.id, newStatus)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
