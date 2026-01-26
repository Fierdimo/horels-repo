import { ReactNode } from 'react';

interface ModernCardProps {
  children: ReactNode;
  statusColor?: 'purple' | 'yellow' | 'green' | 'red' | 'blue' | 'gray';
  onClick?: () => void;
  className?: string;
}

const statusColors = {
  purple: 'bg-purple-500',
  yellow: 'bg-yellow-400',
  green: 'bg-green-500',
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  gray: 'bg-gray-400'
};

export function ModernCard({ children, statusColor, onClick, className = '' }: ModernCardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200
        border border-gray-100 overflow-hidden
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
    >
      {statusColor && (
        <div className={`h-1 ${statusColors[statusColor]}`} />
      )}
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  icon?: ReactNode;
}

export function CardHeader({ title, subtitle, badge, icon }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {icon && <div className="text-gray-400">{icon}</div>}
          <h3 className="text-base font-semibold text-gray-900 truncate">{title}</h3>
        </div>
        {subtitle && (
          <p className="text-sm text-gray-500 truncate">{subtitle}</p>
        )}
      </div>
      {badge && <div className="ml-2 flex-shrink-0">{badge}</div>}
    </div>
  );
}

interface CardFooterProps {
  avatar?: string;
  name?: string;
  amount?: string | number;
  rightIcon?: ReactNode;
}

export function CardFooter({ avatar, name, amount, rightIcon }: CardFooterProps) {
  return (
    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
      <div className="flex items-center gap-2">
        {avatar && (
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white text-xs font-medium">
            {name?.charAt(0).toUpperCase() || '?'}
          </div>
        )}
        {amount && (
          <span className="text-sm font-semibold text-gray-900">{amount}</span>
        )}
      </div>
      {rightIcon && (
        <div className="text-gray-400 hover:text-gray-600 transition-colors">
          {rightIcon}
        </div>
      )}
    </div>
  );
}

interface StatBadgeProps {
  value: string | number;
  label?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

const badgeVariants = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-green-50 text-green-700',
  warning: 'bg-yellow-50 text-yellow-700',
  danger: 'bg-red-50 text-red-700',
  info: 'bg-blue-50 text-blue-700'
};

export function StatBadge({ value, label, variant = 'default' }: StatBadgeProps) {
  return (
    <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${badgeVariants[variant]}`}>
      {label && <span className="opacity-75">{label}:</span>}
      <span>{value}</span>
    </div>
  );
}
