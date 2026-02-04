import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { 
  Building2, Calendar, Users, Filter, Search, 
  CheckCircle, Clock, Ban, Package
} from 'lucide-react';
import apiClient from '@/api/client';

type TabType = 'units' | 'weeks' | 'ownerships';

export default function StaffInventoryV2() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('weeks');
  const [yearFilter, setYearFilter] = useState<string>(new Date().getFullYear().toString());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [unitFilter, setUnitFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch timeshare units
  const { data: unitsData } = useQuery({
    queryKey: ['staff-inventory-units'],
    queryFn: async () => {
      const { data } = await apiClient.get('/hotel-staff/inventory/units');
      return data;
    }
  });

  // Fetch week allocations
  const { data: weeksData, isLoading: weeksLoading } = useQuery({
    queryKey: ['staff-inventory-weeks', yearFilter, statusFilter, unitFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (yearFilter !== 'all') params.append('year', yearFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (unitFilter !== 'all') params.append('unit_id', unitFilter);
      
      const { data } = await apiClient.get(`/hotel-staff/inventory/weeks?${params.toString()}`);
      return data;
    }
  });

  // Fetch ownerships
  const { data: ownershipsData } = useQuery({
    queryKey: ['staff-inventory-ownerships', unitFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (unitFilter !== 'all') params.append('unit_id', unitFilter);
      
      const { data } = await apiClient.get(`/hotel-staff/inventory/ownerships?${params.toString()}`);
      return data;
    }
  });

  const units = unitsData?.data || [];
  const weeks = weeksData?.data || [];
  const ownerships = ownershipsData?.data || [];

  // Calculate stats
  const totalWeeks = weeks.length;
  const availableWeeks = weeks.filter((w: any) => w.status === 'RELEASED').length;
  const bookedWeeks = weeks.filter((w: any) => w.status === 'BOOKED').length;
  const assignedWeeks = weeks.filter((w: any) => w.status === 'ASSIGNED').length;

  const statusColors: Record<string, { bg: string; text: string; icon: any }> = {
    ASSIGNED: { bg: 'bg-gray-100', text: 'text-gray-700', icon: Clock },
    RELEASED: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle },
    BOOKED: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Calendar },
    RESERVED: { bg: 'bg-purple-100', text: 'text-purple-700', icon: Users },
    EXPIRED: { bg: 'bg-red-100', text: 'text-red-700', icon: Ban }
  };

  const filteredWeeks = weeks.filter((week: any) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        week.ownership?.unit?.name?.toLowerCase().includes(query) ||
        week.ownership?.unit?.category?.toLowerCase().includes(query) ||
        week.week_number?.toString().includes(query)
      );
    }
    return true;
  });

  const renderUnitsTab = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 font-medium">Total Units</p>
              <p className="text-3xl font-bold text-blue-900 mt-1">{units.length}</p>
            </div>
            <Building2 className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-700 font-medium">Physical Rooms</p>
              <p className="text-3xl font-bold text-purple-900 mt-1">
                {units.reduce((sum: number, u: any) => sum + (u.quantity || 0), 0)}
              </p>
            </div>
            <Package className="h-8 w-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-teal-50 rounded-lg p-4 border border-teal-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-teal-700 font-medium">Max Capacity</p>
              <p className="text-3xl font-bold text-teal-900 mt-1">
                {units.reduce((sum: number, u: any) => sum + (u.capacity || 0) * (u.quantity || 0), 0)}
              </p>
              <p className="text-xs text-teal-600 mt-1">Total guests</p>
            </div>
            <Users className="h-8 w-8 text-teal-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capacity</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Base Value</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {units.map((unit: any) => (
              <tr key={unit.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{unit.name}</div>
                  {unit.description && (
                    <div className="text-sm text-gray-500">{unit.description}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                    {unit.category}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {unit.capacity} guests
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {unit.quantity} units
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {unit.base_value} credits
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderWeeksTab = () => (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-700 font-medium">Total Weeks</p>
              <p className="text-3xl font-bold text-purple-900 mt-1">{totalWeeks}</p>
            </div>
            <Calendar className="h-8 w-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 font-medium">Available</p>
              <p className="text-3xl font-bold text-green-900 mt-1">{availableWeeks}</p>
              <p className="text-xs text-green-600 mt-1">Ready to book</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 font-medium">Booked</p>
              <p className="text-3xl font-bold text-blue-900 mt-1">{bookedWeeks}</p>
              <p className="text-xs text-blue-600 mt-1">Reserved</p>
            </div>
            <Calendar className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700 font-medium">Assigned</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{assignedWeeks}</p>
              <p className="text-xs text-gray-600 mt-1">With owners</p>
            </div>
            <Clock className="h-8 w-8 text-gray-600" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="2024">2024</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="RELEASED">Available</option>
              <option value="BOOKED">Booked</option>
              <option value="RESERVED">Reserved</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
            <select
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="all">All Units</option>
              {units.map((unit: any) => (
                <option key={unit.id} value={unit.id}>{unit.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search weeks..."
                className="w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Weeks Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {weeksLoading ? (
          <div className="p-8 text-center text-gray-500">Loading weeks...</div>
        ) : filteredWeeks.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No weeks found</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Week</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dates</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Season</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredWeeks.slice(0, 100).map((week: any) => {
                const StatusIcon = statusColors[week.status]?.icon || Clock;
                return (
                  <tr key={week.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{week.ownership?.unit?.name}</div>
                      <div className="text-sm text-gray-500">{week.ownership?.unit?.category}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">Week {week.week_number}</div>
                      <div className="text-sm text-gray-500">{week.year}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(week.start_date).toLocaleDateString()} - {new Date(week.end_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1 w-fit ${statusColors[week.status]?.bg} ${statusColors[week.status]?.text}`}>
                        <StatusIcon className="h-3 w-3" />
                        {week.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {week.season || 'Standard'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  const renderOwnershipsTab = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-indigo-700 font-medium">Total Ownerships</p>
              <p className="text-3xl font-bold text-indigo-900 mt-1">{ownerships.length}</p>
            </div>
            <Users className="h-8 w-8 text-indigo-600" />
          </div>
        </div>

        <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-emerald-700 font-medium">Active</p>
              <p className="text-3xl font-bold text-emerald-900 mt-1">
                {ownerships.filter((o: any) => o.status === 'ACTIVE').length}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-emerald-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {ownerships.slice(0, 50).map((ownership: any) => (
              <tr key={ownership.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{ownership.unit?.name}</div>
                  <div className="text-sm text-gray-500">{ownership.unit?.category}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                    {ownership.type}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    ownership.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {ownership.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(ownership.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Timeshare Inventory</h1>
        <p className="text-gray-600">Manage timeshare units, week allocations, and ownerships</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('weeks')}
            className={`${
              activeTab === 'weeks'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
          >
            <Calendar className="h-4 w-4" />
            Week Allocations
          </button>
          <button
            onClick={() => setActiveTab('units')}
            className={`${
              activeTab === 'units'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
          >
            <Building2 className="h-4 w-4" />
            Timeshare Units
          </button>
          <button
            onClick={() => setActiveTab('ownerships')}
            className={`${
              activeTab === 'ownerships'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
          >
            <Users className="h-4 w-4" />
            Ownerships
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'units' && renderUnitsTab()}
      {activeTab === 'weeks' && renderWeeksTab()}
      {activeTab === 'ownerships' && renderOwnershipsTab()}
    </div>
  );
}
