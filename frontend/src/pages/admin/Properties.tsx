import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, Plus, Edit, Trash2, Search, X, Eye, MapPin,
  Wifi, ChevronDown, ChevronUp, Globe, Check
} from 'lucide-react';
import apiClient from '@/api/client';
import toast from 'react-hot-toast';

interface TimeshareProperty {
  id: number;
  name: string;
  slug: string;
  city: string;
  country: string;
  region?: string;
  address?: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
  pms_provider?: string;
  pms_property_id?: string;
  program_type: 'FIXED_WEEK' | 'FLOATING' | 'POINTS';
  weeks_per_year: number;
  check_in_day?: string;
  description?: string;
  amenities?: string | string[];
  images?: string | string[];
  is_active: boolean;
  is_marketplace_enabled: boolean;
  created_at: string;
}

type FormMode = 'create' | 'edit';

type PropertyForm = {
  name: string;
  city: string;
  country: string;
  region: string;
  address: string;
  postal_code: string;
  pms_provider: string;
  pms_property_id: string;
  program_type: 'FLOATING' | 'FIXED_WEEK' | 'POINTS';
  weeks_per_year: number;
  check_in_day: string;
  is_active: boolean;
  is_marketplace_enabled: boolean;
};

const EMPTY_FORM: PropertyForm = {
  name: '',
  city: '',
  country: '',
  region: '',
  address: '',
  postal_code: '',
  pms_provider: 'mews',
  pms_property_id: '',
  program_type: 'FLOATING',
  weeks_per_year: 52,
  check_in_day: 'SATURDAY',
  is_active: true,
  is_marketplace_enabled: false,
};

export default function AdminProperties() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [selectedProperty, setSelectedProperty] = useState<TimeshareProperty | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [expandedPms, setExpandedPms] = useState(false);

  // ─── Queries ────────────────────────────────────────────────────────────────
  const { data: propsData, isLoading } = useQuery({
    queryKey: ['admin-timeshare-properties'],
    queryFn: async () => {
      const { data } = await apiClient.get('/api/admin/properties');
      return data;
    },
  });

  const properties: TimeshareProperty[] = propsData?.data || [];

  // ─── Mutations ──────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (payload: typeof EMPTY_FORM) => {
      const { data } = await apiClient.post('/api/admin/properties', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-timeshare-properties'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-properties'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-cities'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast.success(t('admin.properties.createSuccess', 'Property created successfully'));
      closeModal();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || t('admin.properties.createError', 'Failed to create property'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: Partial<typeof EMPTY_FORM> }) => {
      const { data } = await apiClient.put(`/api/admin/properties/${id}`, payload);
      return data;
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-timeshare-properties'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-properties'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-cities'] });
      queryClient.invalidateQueries({ queryKey: ['property', id] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['staff-marketplace-config'] });
      toast.success(t('admin.properties.updateSuccess', 'Property updated successfully'));
      closeModal();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || t('admin.properties.updateError', 'Failed to update property'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/api/admin/properties/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-timeshare-properties'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-properties'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-cities'] });
      queryClient.invalidateQueries({ queryKey: ['property'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['staff-marketplace-config'] });
      toast.success(t('admin.properties.deleteSuccess', 'Property deleted successfully'));
      setDeleteConfirm(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || t('admin.properties.deleteError', 'Failed to delete property'));
    },
  });

  // ─── Helpers ────────────────────────────────────────────────────────────────
  const parseArray = (val: string | string[] | undefined): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    try { return JSON.parse(val); } catch { return []; }
  };

  const openCreate = () => {
    setFormMode('create');
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  };

  const openEdit = (p: TimeshareProperty) => {
    setFormMode('edit');
    setSelectedProperty(p);
    setForm({
      name: p.name,
      city: p.city,
      country: p.country,
      region: p.region || '',
      address: p.address || '',
      postal_code: p.postal_code || '',
      pms_provider: p.pms_provider || 'mews',
      pms_property_id: p.pms_property_id || '',
      program_type: p.program_type,
      weeks_per_year: p.weeks_per_year,
      check_in_day: p.check_in_day || 'SATURDAY',
      is_active: p.is_active,
      is_marketplace_enabled: p.is_marketplace_enabled,
    });
    setShowModal(true);
  };

  const openDetails = (p: TimeshareProperty) => {
    setSelectedProperty(p);
    setShowDetailsModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedProperty(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.city || !form.country) {
      toast.error(t('admin.properties.fillRequired', 'Please fill in required fields'));
      return;
    }
    if (formMode === 'create') {
      createMutation.mutate(form);
    } else if (selectedProperty) {
      updateMutation.mutate({ id: selectedProperty.id, payload: form });
    }
  };

  // ─── Filter ─────────────────────────────────────────────────────────────────
  const filtered = properties.filter(p => {
    const matchSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.country.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && p.is_active) ||
      (statusFilter === 'inactive' && !p.is_active) ||
      (statusFilter === 'marketplace' && p.is_marketplace_enabled);
    return matchSearch && matchStatus;
  });

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('admin.properties.title', 'Property Management')}
          </h1>
          <p className="text-gray-600 mt-1">
            {t('admin.properties.subtitle', 'Create and manage timeshare resort properties')}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span>{t('admin.properties.addProperty', 'Add Property')}</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('admin.properties.searchPlaceholder', 'Search by name, city, or country...')}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">{t('admin.properties.allStatuses', 'All Statuses')}</option>
            <option value="active">{t('admin.properties.active', 'Active')}</option>
            <option value="inactive">{t('admin.properties.inactive', 'Inactive')}</option>
            <option value="marketplace">{t('admin.properties.inMarketplace', 'In Marketplace')}</option>
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('admin.properties.totalProperties', 'Total Properties')}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{properties.length}</p>
            </div>
            <Building2 className="h-8 w-8 text-blue-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('admin.properties.activeProperties', 'Active')}</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{properties.filter(p => p.is_active).length}</p>
            </div>
            <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
              <Check className="h-5 w-5 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('admin.properties.marketplaceEnabled', 'In Marketplace')}</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{properties.filter(p => p.is_marketplace_enabled).length}</p>
            </div>
            <Globe className="h-8 w-8 text-purple-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('admin.properties.withPMS', 'PMS Connected')}</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{properties.filter(p => !!p.pms_property_id).length}</p>
            </div>
            <Wifi className="h-8 w-8 text-orange-400" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {t('admin.properties.noProperties', 'No properties found')}
            </h3>
            <p className="text-gray-500 mb-6">
              {t('admin.properties.noPropertiesDesc', 'Create your first resort property to get started')}
            </p>
            <button
              onClick={openCreate}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-5 w-5" />
              <span>{t('admin.properties.addProperty', 'Add Property')}</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('admin.properties.colProperty', 'Property')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('admin.properties.colLocation', 'Location')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('admin.properties.colPMS', 'PMS')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('admin.properties.colStatus', 'Status')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('admin.properties.colActions', 'Actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-900">{p.name}</p>
                          <p className="text-xs text-gray-400">{p.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-1">
                        <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-gray-900">{p.city}</p>
                          <p className="text-xs text-gray-500">{p.country}{p.region ? `, ${p.region}` : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {p.pms_property_id ? (
                        <div>
                          <p className="text-xs font-medium text-gray-700">{p.pms_provider?.toUpperCase()}</p>
                          <p className="text-xs text-gray-400">{p.pms_property_id}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full w-fit ${
                          p.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {p.is_active ? t('admin.properties.active', 'Active') : t('admin.properties.inactive', 'Inactive')}
                        </span>
                        {p.is_marketplace_enabled && (
                          <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full w-fit bg-purple-100 text-purple-800">
                            {t('admin.properties.marketplace', 'Marketplace')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => openDetails(p)}
                          className="p-2 text-gray-500 hover:bg-gray-100 rounded transition-colors"
                          title={t('admin.properties.viewDetails', 'View Details')}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEdit(p)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title={t('admin.properties.edit', 'Edit')}
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        {deleteConfirm === p.id ? (
                          <div className="flex items-center gap-1 ml-1">
                            <button
                              onClick={() => deleteMutation.mutate(p.id)}
                              disabled={deleteMutation.isPending}
                              className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                            >
                              {t('common.yes', 'Yes')}
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="px-2 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400"
                            >
                              {t('common.no', 'No')}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(p.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded transition-colors"
                            title={t('admin.properties.delete', 'Delete')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {formMode === 'create'
                    ? t('admin.properties.createTitle', 'Create New Property')
                    : t('admin.properties.editTitle', 'Edit Property')}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {formMode === 'create'
                    ? t('admin.properties.createSubtitle', 'Add a new timeshare resort to the platform')
                    : t('admin.properties.editSubtitle', 'Update property information')}
                </p>
              </div>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Basic Info */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                  {t('admin.properties.sectionBasic', 'Basic Information')}
                </h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('admin.properties.fieldName', 'Property Name')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Sunset Beach Resort Marbella"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Location */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                  {t('admin.properties.sectionLocation', 'Location')}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('admin.properties.fieldCity', 'City')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.city}
                      onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                      placeholder="Marbella"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('admin.properties.fieldCountry', 'Country')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.country}
                      onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                      placeholder="Spain"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('admin.properties.fieldRegion', 'Region / Province')}
                    </label>
                    <input
                      type="text"
                      value={form.region}
                      onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
                      placeholder="Costa del Sol"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('admin.properties.fieldPostalCode', 'Postal Code')}
                    </label>
                    <input
                      type="text"
                      value={form.postal_code}
                      onChange={e => setForm(f => ({ ...f, postal_code: e.target.value }))}
                      placeholder="29600"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('admin.properties.fieldAddress', 'Street Address')}
                    </label>
                    <input
                      type="text"
                      value={form.address}
                      onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                      placeholder="Avenida del Mar, 123"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* PMS Configuration — collapsible advanced section */}
              <div>
                <button
                  type="button"
                  onClick={() => setExpandedPms(!expandedPms)}
                  className="flex items-center gap-2 text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2"
                >
                  {t('admin.properties.sectionPMS', 'PMS Configuration')}
                  {expandedPms ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  <span className="normal-case font-normal text-gray-400">
                    {form.pms_property_id
                      ? `${form.pms_provider} · ${form.pms_property_id}`
                      : t('admin.properties.pmsOptional', '(optional)')
                    }
                  </span>
                </button>
                {expandedPms && (
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('admin.properties.fieldPmsProvider', 'PMS Provider')}
                      </label>
                      <select
                        value={form.pms_provider}
                        onChange={e => setForm(f => ({ ...f, pms_provider: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="mews">Mews</option>
                        <option value="cloudbeds">Cloudbeds</option>
                        <option value="opera">Opera</option>
                        <option value="resnexus">ResNexus</option>
                        <option value="other">Other</option>
                        <option value="none">None</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('admin.properties.fieldPmsPropertyId', 'PMS Property ID')}
                      </label>
                      <input
                        type="text"
                        value={form.pms_property_id}
                        onChange={e => setForm(f => ({ ...f, pms_property_id: e.target.value }))}
                        placeholder="MARBELLA-001"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Settings */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                  {t('admin.properties.sectionSettings', 'Visibility Settings')}
                </h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        {t('admin.properties.fieldIsActive', 'Property Active')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {t('admin.properties.fieldIsActiveDesc', 'Inactive properties are hidden from all views')}
                      </p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_marketplace_enabled}
                      onChange={e => setForm(f => ({ ...f, is_marketplace_enabled: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        {t('admin.properties.fieldMarketplace', 'Enable in Marketplace')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {t('admin.properties.fieldMarketplaceDesc', 'Property will appear in the public marketplace for bookings')}
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      {t('common.saving', 'Saving...')}
                    </span>
                  ) : formMode === 'create'
                    ? t('admin.properties.createButton', 'Create Property')
                    : t('admin.properties.saveButton', 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedProperty && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{selectedProperty.name}</h2>
              <button onClick={() => setShowDetailsModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <DetailRow label={t('admin.properties.fieldCity', 'City')} value={`${selectedProperty.city}, ${selectedProperty.country}`} />
              {selectedProperty.region && <DetailRow label={t('admin.properties.fieldRegion', 'Region')} value={selectedProperty.region} />}
              {selectedProperty.address && <DetailRow label={t('admin.properties.fieldAddress', 'Address')} value={selectedProperty.address} />}
              <DetailRow label={t('admin.properties.fieldProgramType', 'Program')} value={selectedProperty.program_type} />
              <DetailRow label={t('admin.properties.fieldCheckInDay', 'Check-in Day')} value={selectedProperty.check_in_day || '—'} />
              {selectedProperty.pms_provider && (
                <DetailRow label={t('admin.properties.fieldPmsProvider', 'PMS')} value={`${selectedProperty.pms_provider} / ${selectedProperty.pms_property_id}`} />
              )}
              {selectedProperty.description && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">{t('admin.properties.fieldDescription', 'Description')}</p>
                  <p className="text-sm text-gray-700">{selectedProperty.description}</p>
                </div>
              )}
              {parseArray(selectedProperty.amenities).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-2">{t('admin.properties.sectionAmenities', 'Amenities')}</p>
                  <div className="flex flex-wrap gap-2">
                    {parseArray(selectedProperty.amenities).map(a => (
                      <span key={a} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200">{a}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${selectedProperty.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {selectedProperty.is_active ? 'Active' : 'Inactive'}
                </span>
                {selectedProperty.is_marketplace_enabled && (
                  <span className="px-3 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">Marketplace</span>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  onClick={() => { setShowDetailsModal(false); openEdit(selectedProperty); }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  <Edit className="h-4 w-4" />
                  {t('admin.properties.edit', 'Edit')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs font-medium text-gray-500 uppercase flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-900 text-right">{value}</span>
    </div>
  );
}
