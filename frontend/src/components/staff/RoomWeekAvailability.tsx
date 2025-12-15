import React from 'react';

export interface RoomWeek {
  id: number;
  habitacion: string;
  semana: string; // Ej: "2025-W01"
  estado: 'disponible' | 'no_disponible' | 'bloqueada' | 'reservada';
  usuarioAsignado?: string;
}

interface RoomWeekAvailabilityProps {
  data: RoomWeek[];
  onChange: (id: number, estado: RoomWeek['estado']) => void;
  onAssign?: (id: number) => void;
}

const estadoColors = {
  disponible: 'bg-green-100 text-green-800',
  no_disponible: 'bg-gray-100 text-gray-800',
  bloqueada: 'bg-red-100 text-red-800',
  reservada: 'bg-blue-100 text-blue-800',
};

export const RoomWeekAvailability: React.FC<RoomWeekAvailabilityProps> = ({ data, onChange, onAssign }) => {
  return (
    <table className="min-w-full border text-sm">
      <thead>
        <tr className="bg-gray-100">
          <th className="p-2 border">Habitación</th>
          <th className="p-2 border">Semana</th>
          <th className="p-2 border">Estado</th>
          <th className="p-2 border">Usuario asignado</th>
          <th className="p-2 border">Acción</th>
        </tr>
      </thead>
      <tbody>
        {data.map((rw) => (
          <tr key={rw.id}>
            <td className="p-2 border">{rw.habitacion}</td>
            <td className="p-2 border">{rw.semana}</td>
            <td className={`p-2 border font-semibold ${estadoColors[rw.estado]}`}>{rw.estado}</td>
            <td className="p-2 border">{rw.usuarioAsignado || '-'}</td>
            <td className="p-2 border space-x-2">
              <button
                className="px-2 py-1 rounded bg-green-500 text-white text-xs disabled:opacity-50"
                disabled={rw.estado === 'disponible'}
                onClick={() => onChange(rw.id, 'disponible')}
              >
                Marcar disponible
              </button>
              <button
                className="px-2 py-1 rounded bg-gray-500 text-white text-xs disabled:opacity-50"
                disabled={rw.estado === 'no_disponible'}
                onClick={() => onChange(rw.id, 'no_disponible')}
              >
                No disponible
              </button>
              <button
                className="px-2 py-1 rounded bg-red-500 text-white text-xs disabled:opacity-50"
                disabled={rw.estado === 'bloqueada'}
                onClick={() => onChange(rw.id, 'bloqueada')}
              >
                Bloquear
              </button>
              {rw.estado === 'disponible' && onAssign && (
                <button
                  className="px-2 py-1 rounded bg-blue-600 text-white text-xs"
                  onClick={() => onAssign(rw.id)}
                >
                  Asignar a usuario
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
