import React from 'react';

export interface LogEntry {
  id: number;
  fecha: string;
  usuario: string;
  accion: string;
  tipo: string;
  detalle: string;
}

interface LogsTableProps {
  logs: LogEntry[];
}

export const LogsTable: React.FC<LogsTableProps> = ({ logs }) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border">Fecha</th>
            <th className="p-2 border">Usuario</th>
            <th className="p-2 border">Acción</th>
            <th className="p-2 border">Tipo</th>
            <th className="p-2 border">Detalle</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td className="p-2 border">{log.fecha}</td>
              <td className="p-2 border">{log.usuario}</td>
              <td className="p-2 border">{log.accion}</td>
              <td className="p-2 border">{log.tipo}</td>
              <td className="p-2 border">{log.detalle}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
