import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bed, Plus, Edit, Trash2, Search, X, Eye, Building2,
  ChevronDown, ChevronUp, Users, Check, Calculator, Edit2
} from 'lucide-react';
import apiClient from '@/api/client';
import toast from 'react-hot-toast';
import ImageUploader from '@/components/common/ImageUploader';

interface TimeshareProperty {
  id: number;
  name: string;
  city: string;
  country: string;
  tier?: string;
  location_multiplier?: number;
}

interface TimeshareUnit {
  id: number;
  property_id: number;
  category: string;
  slug: string;
  capacity_min: number;
  capacity_max: number;
  quantity: number;
  bedrooms: number;
  bathrooms: number;
  size_sqm?: number;
  floor_range?: string;
  base_credit_value: number;
  view_type?: string;
  description?: string;
  amenities?: string | string[];
  images?: string | string[];
  is_active: boolean;
  property?: TimeshareProperty;
}

type FormMode = 'create' | 'edit';

const VIEW_TYPES = ['OCEAN', 'POOL', 'GARDEN', 'CITY', 'MOUNTAIN', 'NO_VIEW'];

const AMENITY_PRESETS = [
  'Air Conditioning', 'Full Kitchen', 'Dishwasher', 'Washer/Dryer',
  'Balcony', 'Terrace', 'Living Room', 'Dining Area',
  'Flat-screen TV', 'WiFi', 'Safe', 'Jacuzzi',
  'Ocean View', 'Pool View', 'Garden View',
];

const EMPTY_FORM = {
  property_id: '',
  category: '',
  capacity_min: 1,
  capacity_max: 2,
  quantity: 1,
  bedrooms: 1,
  bathrooms: 1,
  size_sqm: '' as any,
  floor_range: '',
  base_credit_value: 500,
  credit_room_type: 'STANDARD' as 'STANDARD' | 'SUPERIOR' | 'DELUXE' | 'SUITE' | 'PRESIDENTIAL',
  view_type: 'NO_VIEW',
  description: '',
  amenities: [] as string[],
  images: [] as string[],
  is_active: true,
};

export default function AdminUnits() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [selectedUnit, setSelectedUnit] = useState<TimeshareUnit | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [newAmenity, setNewAmenity] = useState('');
  const [expandedImages, setExpandedImages] = useState(false);

  // ─── Queries ────────────────────────────────────────────────────────────────
  const { data: unitsData, isLoading } = useQuery({
    queryKey: ['admin-timeshare-units'],
    queryFn: async () => {
      const { data } = await apiClient.get('/api/admin/units', { params: { limit: 200 } });
      return data;
    },
  });

  const { data: propsData } = useQuery({
    queryKey: ['admin-timeshare-properties'],
    queryFn: async () => {
      const { data } = await apiClient.get('/api/admin/properties');
      return data;
    },
  });

  const units: TimeshareUnit[] = unitsData?.data || [];
  const properties: TimeshareProperty[] = propsData?.data || [];

  const { data: formulaConfigData } = useQuery({
    queryKey: ['formula-config-units'],
    queryFn: async () => {
      const { data } = await apiClient.get('/api/admin/credits/config');
      return data.data as {
        base_seasons: Record<string, number>;
        tier_multipliers: Record<string, number>;
        room_multipliers: Record<string, number>;
      };
    },
  });

  const [creditOverride, setCreditOverride] = useState(false);

  const ROOM_TYPES = [
    { value: 'STANDARD',     label: '🏠 Standard' },
    { value: 'SUPERIOR',     label: '🏡 Superior' },
    { value: 'DELUXE',       label: '🏘️ Deluxe' },
    { value: 'SUITE',        label: '🏰 Suite' },
    { value: 'PRESIDENTIAL', label: '👑 Presidential' },
  ] as const;

  const autoCredits = useMemo(() => {
    const cfg = formulaConfigData;
    const baseWhite = cfg?.base_seasons?.WHITE ?? 600;
    const selProp = properties.find(p => String(p.id) === String(form.property_id));
    const tier = selProp?.tier || 'STANDARD';
    const tierFallback: Record<string, number> = { DIAMOND: 1.5, GOLD: 1.3, SILVER_PLUS: 1.1, STANDARD: 1.0 };
    const tierMult = cfg?.tier_multipliers?.[tier] ?? tierFallback[tier] ?? 1.0;
    const roomKey = form.credit_room_type || 'STANDARD';
    const roomFallback: Record<string, number> = { STANDARD: 1.0, SUPERIOR: 1.2, DELUXE: 1.5, SUITE: 2.0, PRESIDENTIAL: 2.5 };
    const roomMult = cfg?.room_multipliers?.[roomKey] ?? roomFallback[roomKey] ?? 1.0;
    return Math.round(baseWhite * tierMult * roomMult);
  }, [formulaConfigData, form.property_id, form.credit_room_type, properties]);

  // Sync auto value into form unless user has manually overridden
  useEffect(() => {
    if (!creditOverride) {
      setForm(f => ({ ...f, base_credit_value: autoCredits }));
    }
  }, [autoCredits, creditOverride]);

  // ─── Mutations ──────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (payload: typeof EMPTY_FORM) => {
      const { data } = await apiClient.post('/api/admin/units', {
        ...payload,
        property_id: Number(payload.property_id),
        size_sqm: payload.size_sqm ? Number(payload.size_sqm) : undefined,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-timeshare-units'] });
      toast.success(t('admin.units.createSuccess', 'Unit created successfully'));
      closeModal();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || t('admin.units.createError', 'Failed to create unit'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: Partial<typeof EMPTY_FORM> }) => {
      const { data } = await apiClient.put(`/api/admin/units/${id}`, {
        ...payload,
        size_sqm: payload.size_sqm ? Number(payload.size_sqm) : undefined,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-timeshare-units'] });
      toast.success(t('admin.units.updateSuccess', 'Unit updated successfully'));
      closeModal();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || t('admin.units.updateError', 'Failed to update unit'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/api/admin/units/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-timeshare-units'] });
      toast.success(t('admin.units.deleteSuccess', 'Unit deleted successfully'));
      setDeleteConfirm(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || t('admin.units.deleteError', 'Failed to delete unit'));
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
    setCreditOverride(false);
    setShowModal(true);
  };

  const openEdit = (u: TimeshareUnit) => {
    setFormMode('edit');
    setSelectedUnit(u);
    setCreditOverride(true); // editing existing: keep current value
    setForm({
      property_id: String(u.property_id),
      category: u.category,
      capacity_min: u.capacity_min,
      capacity_max: u.capacity_max,
      quantity: u.quantity,
      bedrooms: u.bedrooms,
      bathrooms: u.bathrooms,
      size_sqm: u.size_sqm ?? '',
      floor_range: u.floor_range || '',
      base_credit_value: u.base_credit_value,
      credit_room_type: ((u as any).credit_room_type || 'STANDARD') as 'STANDARD' | 'SUPERIOR' | 'DELUXE' | 'SUITE' | 'PRESIDENTIAL',
      view_type: u.view_type || 'NO_VIEW',
      description: u.description || '',
      amenities: parseArray(u.amenities),
      images: parseArray(u.images),
      is_active: u.is_active,
    });
    setShowModal(true);
  };

  const openDetails = (u: TimeshareUnit) => {
    setSelectedUnit(u);
    setShowDetailsModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedUnit(null);
    setNewAmenity('');
    setExpandedImages(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.property_id || !form.category || !form.capacity_max || !form.quantity || !form.base_credit_value) {
      toast.error(t('admin.units.fillRequired', 'Please fill in all required fields'));
      return;
    }
    if (formMode === 'create') {
      createMutation.mutate(form);
    } else if (selectedUnit) {
      updateMutation.mutate({ id: selectedUnit.id, payload: form });
    }
  };

  const addAmenity = (amenity: string) => {
    const val = amenity.trim();
    if (val && !form.amenities.includes(val)) {
      setForm(f => ({ ...f, amenities: [...f.amenities, val] }));
    }
    setNewAmenity('');
  };

  const removeAmenity = (a: string) =>
    setForm(f => ({ ...f, amenities: f.amenities.filter(x => x !== a) }));

  const viewTypeColor = (v: string) => {
    const map: Record<string, string> = {
      OCEAN: 'bg-blue-100 text-blue-800',
      POOL: 'bg-cyan-100 text-cyan-800',
      GARDEN: 'bg-green-100 text-green-800',
      CITY: 'bg-gray-100 text-gray-800',
      MOUNTAIN: 'bg-amber-100 text-amber-800',
      NO_VIEW: 'bg-slate-100 text-slate-600',
    };
    return map[v] || 'bg-gray-100 text-gray-800';
  };

  // ─── Filter ─────────────────────────────────────────────────────────────────
  const filtered = units.filter(u => {
    const propertyName = u.property?.name || '';
    const matchSearch =
      u.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      propertyName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchProp =
      propertyFilter === 'all' || String(u.property_id) === propertyFilter;
    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && u.is_active) ||
      (statusFilter === 'inactive' && !u.is_active);
    return matchSearch && matchProp && matchStatus;
  });

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('admin.units.title', 'Unit Management')}
          </h1>
          <p className="text-gray-600 mt-1">
            {t('admin.units.subtitle', 'Manage apartment/unit categories within each property')}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span>{t('admin.units.addUnit', 'Add Unit')}</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('admin.units.searchPlaceholder', 'Search by category or property...')}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            value={propertyFilter}
            onChange={e => setPropertyFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">{t('admin.units.allProperties', 'All Properties')}</option>
            {properties.map(p => (
              <option key={p.id} value={String(p.id)}>{p.name}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">{t('admin.units.allStatuses', 'All Statuses')}</option>
            <option value="active">{t('admin.units.active', 'Active')}</option>
            <option value="inactive">{t('admin.units.inactive', 'Inactive')}</option>
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('admin.units.totalUnits', 'Total Unit Types')}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{units.length}</p>
            </div>
            <Bed className="h-8 w-8 text-blue-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('admin.units.activeUnits', 'Active')}</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{units.filter(u => u.is_active).length}</p>
            </div>
            <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
              <Check className="h-5 w-5 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-indigo-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('admin.units.totalPhysicalUnits', 'Total Physical Units')}</p>
              <p className="text-2xl font-bold text-indigo-600 mt-1">{units.reduce((sum, u) => sum + u.quantity, 0)}</p>
            </div>
            <Building2 className="h-8 w-8 text-indigo-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-amber-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('admin.units.propertiesWithUnits', 'Properties')}</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{new Set(units.map(u => u.property_id)).size}</p>
            </div>
            <Users className="h-8 w-8 text-amber-400" />
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
            <Bed className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {t('admin.units.noUnits', 'No units found')}
            </h3>
            <p className="text-gray-500 mb-6">
              {t('admin.units.noUnitsDesc', 'Add the first unit/apartment category to a property')}
            </p>
            <button
              onClick={openCreate}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-5 w-5" />
              <span>{t('admin.units.addUnit', 'Add Unit')}</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('admin.units.colUnit', 'Unit Category')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('admin.units.colProperty', 'Property')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('admin.units.colCapacity', 'Capacity')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('admin.units.colDetails', 'Beds / Bath')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('admin.units.colCredits', 'Base Credits')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('admin.units.colView', 'View')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('admin.units.colStatus', 'Status')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('admin.units.colActions', 'Actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filtered.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                          <Bed className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-900">{u.category}</p>
                          <p className="text-xs text-gray-400">{u.quantity} {t('admin.units.units', 'units')}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-900">{u.property?.name || `#${u.property_id}`}</p>
                      <p className="text-xs text-gray-500">{u.property?.city}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-900">{u.capacity_min}–{u.capacity_max}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-900">
                        {u.bedrooms === 0 ? t('admin.units.studio', 'Studio') : `${u.bedrooms} ${t('admin.units.br', 'BR')}`} / {u.bathrooms} {t('admin.units.ba', 'BA')}
                      </p>
                      {u.size_sqm && <p className="text-xs text-gray-400">{u.size_sqm} m²</p>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-gray-900">{u.base_credit_value.toLocaleString()}</span>
                      <span className="text-xs text-gray-400 ml-1">{t('admin.units.credits', 'cr')}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${viewTypeColor(u.view_type || 'NO_VIEW')}`}>
                        {u.view_type || 'NO_VIEW'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        u.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {u.is_active ? t('admin.units.active', 'Active') : t('admin.units.inactive', 'Inactive')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => openDetails(u)}
                          className="p-2 text-gray-500 hover:bg-gray-100 rounded transition-colors"
                          title={t('admin.units.viewDetails', 'View Details')}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEdit(u)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title={t('admin.units.edit', 'Edit')}
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        {deleteConfirm === u.id ? (
                          <div className="flex items-center gap-1 ml-1">
                            <button
                              onClick={() => deleteMutation.mutate(u.id)}
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
                            onClick={() => setDeleteConfirm(u.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded transition-colors"
                            title={t('admin.units.delete', 'Delete')}
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
                    ? t('admin.units.createTitle', 'Create New Unit Category')
                    : t('admin.units.editTitle', 'Edit Unit Category')}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {formMode === 'create'
                    ? t('admin.units.createSubtitle', 'Add a new apartment/room category to a property')
                    : t('admin.units.editSubtitle', 'Update unit information')}
                </p>
              </div>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Property & Category */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                  {t('admin.units.sectionBasic', 'Basic Information')}
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('admin.units.fieldProperty', 'Property')} <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={form.property_id}
                      onChange={e => setForm(f => ({ ...f, property_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                      disabled={formMode === 'edit'}
                    >
                      <option value="">{t('admin.units.selectProperty', 'Select a property...')}</option>
                      {properties.map(p => (
                        <option key={p.id} value={String(p.id)}>{p.name} — {p.city}</option>
                      ))}
                    </select>
                    {properties.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        {t('admin.units.noPropertiesYet', 'No properties yet. Create a property first.')}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('admin.units.fieldCategory', 'Category Name')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      placeholder="e.g. Studio Ocean View, 2BR Garden, Penthouse Suite"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      {t('admin.units.categoryHint', 'This represents a type/category, not an individual room')}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('admin.units.fieldDescription', 'Description')}
                    </label>
                    <textarea
                      value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      rows={2}
                      placeholder={t('admin.units.descriptionPlaceholder', 'Describe this unit type for guests...')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Capacity & Size */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                  {t('admin.units.sectionCapacity', 'Capacity & Configuration')}
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('admin.units.fieldQuantity', 'Physical Units')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={form.quantity}
                      onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))}
                      min={1}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">{t('admin.units.quantityHint', 'How many identical units exist')}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('admin.units.fieldCapacityMin', 'Min Guests')}
                    </label>
                    <input
                      type="number"
                      value={form.capacity_min}
                      onChange={e => setForm(f => ({ ...f, capacity_min: Number(e.target.value) }))}
                      min={1}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('admin.units.fieldCapacityMax', 'Max Guests')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={form.capacity_max}
                      onChange={e => setForm(f => ({ ...f, capacity_max: Number(e.target.value) }))}
                      min={1}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('admin.units.fieldBedrooms', 'Bedrooms')}
                    </label>
                    <select
                      value={form.bedrooms}
                      onChange={e => setForm(f => ({ ...f, bedrooms: Number(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value={0}>{t('admin.units.studio', 'Studio (0)')}</option>
                      {[1, 2, 3, 4, 5].map(n => (
                        <option key={n} value={n}>{n} {t('admin.units.bedroom', 'bedroom')}{n > 1 ? 's' : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('admin.units.fieldBathrooms', 'Bathrooms')}
                    </label>
                    <select
                      value={form.bathrooms}
                      onChange={e => setForm(f => ({ ...f, bathrooms: Number(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {[1, 1.5, 2, 2.5, 3].map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('admin.units.fieldSizeSqm', 'Size (m²)')}
                    </label>
                    <input
                      type="number"
                      value={form.size_sqm}
                      onChange={e => setForm(f => ({ ...f, size_sqm: e.target.value }))}
                      min={1}
                      placeholder="e.g. 65"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('admin.units.fieldFloorRange', 'Floor Range')}
                    </label>
                    <input
                      type="text"
                      value={form.floor_range}
                      onChange={e => setForm(f => ({ ...f, floor_range: e.target.value }))}
                      placeholder="e.g. 3-5, Ground"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('admin.units.fieldViewType', 'View Type')}
                    </label>
                    <select
                      value={form.view_type}
                      onChange={e => setForm(f => ({ ...f, view_type: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {VIEW_TYPES.map(v => (
                        <option key={v} value={v}>{v.replace('_', ' ')}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Credits */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  {t('admin.units.sectionCredits', 'Credit Valuation')}
                </h3>

                <div className="space-y-3">
                  {/* Room type selector — drives auto-calc */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('admin.units.fieldCreditRoomType', 'Categoría de créditos')} <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-5 gap-2">
                      {ROOM_TYPES.map(rt => (
                        <button
                          key={rt.value}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, credit_room_type: rt.value }))}
                          className={`flex flex-col items-center py-2 px-1 rounded-lg border-2 text-xs font-medium transition-colors ${
                            form.credit_room_type === rt.value
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600'
                          }`}
                        >
                          <span className="text-lg mb-0.5">{rt.label.split(' ')[0]}</span>
                          <span>{rt.label.split(' ').slice(1).join(' ')}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Auto-calculated value preview */}
                  {!creditOverride ? (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-blue-500 mb-0.5">
                          {(() => {
                            const cfg = formulaConfigData;
                            const selProp = properties.find(p => String(p.id) === String(form.property_id));
                            const tier = selProp?.tier || 'STANDARD';
                            const tierFallback: Record<string, number> = { DIAMOND: 1.5, GOLD: 1.3, SILVER_PLUS: 1.1, STANDARD: 1.0 };
                            const tierMult = (cfg?.tier_multipliers?.[tier] ?? tierFallback[tier] ?? 1.0).toFixed(2);
                            const roomKey = form.credit_room_type || 'STANDARD';
                            const roomFallback: Record<string, number> = { STANDARD: 1.0, SUPERIOR: 1.2, DELUXE: 1.5, SUITE: 2.0, PRESIDENTIAL: 2.5 };
                            const roomMult = (cfg?.room_multipliers?.[roomKey] ?? roomFallback[roomKey] ?? 1.0).toFixed(2);
                            const baseWhite = cfg?.base_seasons?.WHITE ?? 600;
                            return `Base WHITE: ${baseWhite}  ×  Tier propiedad: ×${tierMult} (${tier})  ×  Tipo unidad: ×${roomMult} (${roomKey})`;
                          })()}
                        </p>
                        <p className="text-xl font-bold text-blue-800">
                          {autoCredits.toLocaleString()}
                          <span className="text-sm font-normal text-blue-500 ml-1">créditos (temporada media)</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCreditOverride(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-100 transition-colors ml-4 shrink-0"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        Editar
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-end gap-3">
                      <div className="flex-1 max-w-xs">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('admin.units.fieldBaseCredits', 'Valor base (temporada media)')} <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            value={form.base_credit_value}
                            onChange={e => setForm(f => ({ ...f, base_credit_value: Number(e.target.value) }))}
                            min={1}
                            className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <span className="absolute right-3 top-2.5 text-sm text-gray-400">cr</span>
                        </div>
                      </div>
                      {formMode === 'create' && (
                        <button
                          type="button"
                          onClick={() => setCreditOverride(false)}
                          className="px-3 py-2 text-xs text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50 whitespace-nowrap"
                        >
                          ← Auto
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Amenities */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                  {t('admin.units.sectionAmenities', 'Amenities & Features')}
                </h3>
                <div className="flex flex-wrap gap-2 mb-3">
                  {AMENITY_PRESETS.map(a => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => addAmenity(a)}
                      className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                        form.amenities.includes(a)
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600'
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newAmenity}
                    onChange={e => setNewAmenity(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addAmenity(newAmenity))}
                    placeholder={t('admin.units.customAmenityPlaceholder', 'Add custom feature...')}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                  <button type="button" onClick={() => addAmenity(newAmenity)} className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {form.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {form.amenities.map(a => (
                      <span key={a} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200">
                        {a}
                        <button type="button" onClick={() => removeAmenity(a)} className="hover:text-red-500">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Images */}
              <div>
                <button
                  type="button"
                  onClick={() => setExpandedImages(!expandedImages)}
                  className="flex items-center gap-2 text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2"
                >
                  {t('admin.units.sectionImages', 'Photos')}
                  {expandedImages ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  <span className="normal-case font-normal text-gray-400">
                    {form.images.length > 0
                      ? `${form.images.length} photo(s)`
                      : '(optional)'}
                  </span>
                </button>
                {expandedImages && (
                  <ImageUploader
                    images={form.images}
                    onChange={imgs => setForm(f => ({ ...f, images: imgs }))}
                  />
                )}
              </div>

              {/* Active Toggle */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-700">{t('admin.units.fieldIsActive', 'Unit Active')}</p>
                    <p className="text-xs text-gray-500">{t('admin.units.fieldIsActiveDesc', 'Inactive units will not be available for booking or assignment')}</p>
                  </div>
                </label>
              </div>

              {/* Footer */}
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
                    ? t('admin.units.createButton', 'Create Unit')
                    : t('admin.units.saveButton', 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedUnit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{selectedUnit.category}</h2>
              <button onClick={() => setShowDetailsModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <DetailRow label={t('admin.units.fieldProperty', 'Property')} value={selectedUnit.property?.name || `#${selectedUnit.property_id}`} />
              <DetailRow label={t('admin.units.fieldQuantity', 'Physical Units')} value={String(selectedUnit.quantity)} />
              <DetailRow label={t('admin.units.colCapacity', 'Capacity')} value={`${selectedUnit.capacity_min}–${selectedUnit.capacity_max} guests`} />
              <DetailRow
                label={t('admin.units.colDetails', 'Layout')}
                value={`${selectedUnit.bedrooms === 0 ? 'Studio' : `${selectedUnit.bedrooms} BR`} / ${selectedUnit.bathrooms} BA${selectedUnit.size_sqm ? ` / ${selectedUnit.size_sqm} m²` : ''}`}
              />
              <DetailRow label={t('admin.units.colCredits', 'Base Credits')} value={`${selectedUnit.base_credit_value.toLocaleString()} credits`} />
              {selectedUnit.view_type && <DetailRow label={t('admin.units.fieldViewType', 'View')} value={selectedUnit.view_type} />}
              {selectedUnit.floor_range && <DetailRow label={t('admin.units.fieldFloorRange', 'Floors')} value={selectedUnit.floor_range} />}
              {selectedUnit.description && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">{t('admin.units.fieldDescription', 'Description')}</p>
                  <p className="text-sm text-gray-700">{selectedUnit.description}</p>
                </div>
              )}
              {parseArray(selectedUnit.amenities).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-2">{t('admin.units.sectionAmenities', 'Amenities')}</p>
                  <div className="flex flex-wrap gap-2">
                    {parseArray(selectedUnit.amenities).map(a => (
                      <span key={a} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200">{a}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  onClick={() => { setShowDetailsModal(false); openEdit(selectedUnit); }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  <Edit className="h-4 w-4" />
                  {t('admin.units.edit', 'Edit')}
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
