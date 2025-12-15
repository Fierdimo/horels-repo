import { FC } from 'react';

interface ActivityItem {
  type: string;
  description: string;
  timestamp: string;
}

interface ActivityFeedProps {
  activity: ActivityItem[];
}

const typeLabels: Record<string, string> = {
  week_confirmed: 'Semana confirmada',
  week_converted: 'Semana convertida a créditos',
  swap_created: 'Solicitud de intercambio',
  swap_accepted: 'Intercambio aceptado',
  // ...otros tipos
};

export const ActivityFeed: FC<ActivityFeedProps> = ({ activity }) => {
  if (!activity || activity.length === 0) {
    return <div className="text-sm text-gray-500 py-4">Sin actividad reciente.</div>;
  }
  return (
    <ul className="divide-y divide-gray-200 py-4">
      {activity.map((item, idx) => (
        <li key={idx} className="py-2 flex items-center gap-3">
          <span className="text-xs font-semibold text-gray-700 bg-gray-100 rounded px-2 py-1">
            {typeLabels[item.type] || item.type}
          </span>
          <span className="text-sm text-gray-800">{item.description}</span>
          <span className="ml-auto text-xs text-gray-400">{new Date(item.timestamp).toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
};

export default ActivityFeed;
