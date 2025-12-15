import { Activity } from 'lucide-react';

export default function ActivityLogs() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Activity Logs</h1>
        <p className="text-gray-600 mt-1">System activity logs and audit trail</p>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-12">
          <Activity className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-sm font-medium text-gray-900">Activity Logs</h3>
          <p className="text-sm text-gray-500 mt-1">Coming soon...</p>
        </div>
      </div>
    </div>
  );
}
