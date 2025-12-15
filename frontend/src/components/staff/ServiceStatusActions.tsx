import React from 'react';
import type { ServiceStatus } from './PendingServicesList';

interface ServiceStatusActionsProps {
  status: ServiceStatus;
  onChange: (newStatus: ServiceStatus) => void;
}

const nextStatus: Record<ServiceStatus, ServiceStatus | null> = {
  solicitado: 'confirmado',
  confirmado: 'completado',
  completado: null,
};

const statusLabels: Record<ServiceStatus, string> = {
  solicitado: 'Solicitado',
  confirmado: 'Confirmado',
  completado: 'Completado',
};

export const ServiceStatusActions: React.FC<ServiceStatusActionsProps> = ({ status, onChange }) => {
  const next = nextStatus[status];
  if (!next) return <span className="text-green-600 font-semibold">{statusLabels[status]}</span>;
  return (
    <button
      className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs"
      onClick={() => onChange(next)}
    >
      Marcar como {statusLabels[next]}
    </button>
  );
};
