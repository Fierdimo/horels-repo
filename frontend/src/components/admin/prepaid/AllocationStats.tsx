import { TrendingUp, Calendar, DollarSign, Home, AlertCircle } from 'lucide-react';
import { AllocationStats as StatsType } from '@/api/prepaidInventory';

interface AllocationStatsProps {
  stats: StatsType;
}

export function AllocationStats({ stats }: AllocationStatsProps) {
  const statCards = [
    {
      label: 'Total Allocations',
      value: stats.total,
      icon: Home,
      color: 'bg-blue-500',
      detail: `${stats.active} active`,
    },
    {
      label: 'Available Rooms',
      value: stats.available,
      icon: Calendar,
      color: 'bg-green-500',
      detail: `${stats.assigned} assigned`,
    },
    {
      label: 'Total Prepaid Value',
      value: `€${stats.total_prepaid_amount.toLocaleString()}`,
      icon: DollarSign,
      color: 'bg-purple-500',
      detail: '100% margin',
    },
    {
      label: 'Expiring Soon',
      value: stats.expiring_soon,
      icon: AlertCircle,
      color: stats.expiring_soon > 0 ? 'bg-orange-500' : 'bg-gray-400',
      detail: 'Next 30 days',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((stat, index) => (
        <div
          key={index}
          className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.detail}</p>
            </div>
            <div className={`${stat.color} rounded-full p-3`}>
              <stat.icon className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      ))}

      {/* By Property Breakdown */}
      {stats.by_property && stats.by_property.length > 0 && (
        <div className="col-span-full bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            By Property
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.by_property.map((prop) => (
              <div
                key={prop.property_id}
                className="border rounded-lg p-4 hover:border-green-500 transition-colors"
              >
                <p className="font-semibold text-gray-900">{prop.property_name}</p>
                <div className="mt-2 space-y-1 text-sm text-gray-600">
                  <p>Total: {prop.count} allocations</p>
                  <p>Active: {prop.active}</p>
                  <p className="font-medium text-green-600">
                    Value: €{prop.prepaid_amount.toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
