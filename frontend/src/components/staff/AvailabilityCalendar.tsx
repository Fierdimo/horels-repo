import React from 'react';

export interface WeekAvailability {
  id: number;
  semana: string; // Ej: "2025-W01"
  estado: 'disponible' | 'no_disponible' | 'bloqueada';
  motivoBloqueo?: string;
}

interface AvailabilityCalendarProps {
  weeks: WeekAvailability[];
  onChange: (id: number, estado: WeekAvailability['estado']) => void;
}

const estadoColors = {
  disponible: 'bg-green-100 text-green-800',
  no_disponible: 'bg-gray-100 text-gray-800',
  bloqueada: 'bg-red-100 text-red-800',
};

export const AvailabilityCalendar: React.FC<AvailabilityCalendarProps> = ({ weeks, onChange }) => {
  return (
    <table className="min-w-full border text-sm">
      <thead>
        <tr className="bg-gray-100">
          <th className="p-2 border">Semana</th>
          <th className="p-2 border">Estado</th>
          <th className="p-2 border">Acción</th>
        </tr>
      </thead>
      <tbody>
        {weeks.map((w) => (
          <tr key={w.id}>
            <td className="p-2 border">{w.semana}</td>
            <td className={`p-2 border font-semibold ${estadoColors[w.estado]}`}>{w.estado}</td>
            <td className="p-2 border space-x-2">
              <button
                className="px-2 py-1 rounded bg-green-500 text-white text-xs disabled:opacity-50"
                disabled={w.estado === 'disponible'}
                onClick={() => onChange(w.id, 'disponible')}
              >
                Marcar disponible
              </button>
              <button
                className="px-2 py-1 rounded bg-gray-500 text-white text-xs disabled:opacity-50"
                disabled={w.estado === 'no_disponible'}
                onClick={() => onChange(w.id, 'no_disponible')}
              >
                No disponible
              </button>
              <button
                className="px-2 py-1 rounded bg-red-500 text-white text-xs disabled:opacity-50"
                disabled={w.estado === 'bloqueada'}
                onClick={() => onChange(w.id, 'bloqueada')}
              >
                Bloquear
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
