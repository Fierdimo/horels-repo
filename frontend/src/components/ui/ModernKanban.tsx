import { ReactNode } from 'react';

interface KanbanColumnProps {
  title: string;
  total: string | number;
  count: number;
  children: ReactNode;
  color?: 'purple' | 'blue' | 'green' | 'yellow';
  icon?: ReactNode;
}

const headerColors = {
  purple: 'text-purple-600',
  blue: 'text-blue-600',
  green: 'text-green-600',
  yellow: 'text-yellow-600'
};

export function KanbanColumn({ title, total, count, children, color = 'purple', icon }: KanbanColumnProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          {icon && <div className={headerColors[color]}>{icon}</div>}
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-bold ${headerColors[color]}`}>{total}</span>
          <span className="text-sm text-gray-500">· {count} {count === 1 ? 'item' : 'items'}</span>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 space-y-3 overflow-y-auto pr-2">
        {children}
      </div>
    </div>
  );
}

interface KanbanContainerProps {
  children: ReactNode;
  columns?: number;
}

export function KanbanContainer({ children, columns = 3 }: KanbanContainerProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 lg:grid-cols-2',
    3: 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3',
    4: 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-4'
  };

  return (
    <div className={`grid ${gridCols[columns as keyof typeof gridCols] || gridCols[3]} gap-6 h-full`}>
      {children}
    </div>
  );
}
