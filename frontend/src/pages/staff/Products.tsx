import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Package, RefreshCw, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import apiClient from '@/api/client';
import toast from 'react-hot-toast';

export default function StaffProducts() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  // Fetch products
  const { data: productsData, isLoading } = useQuery({
    queryKey: ['staff-products'],
    queryFn: async () => {
      const { data } = await apiClient.get('/hotel-staff/products');
      return data;
    }
  });

  // Sync products mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      setSyncing(true);
      const { data } = await apiClient.post('/hotel-staff/products/sync');
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['staff-products'] });
      toast.success(data.message || t('staff.products.syncSuccess'));
      setSyncing(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('common.error'));
      setSyncing(false);
    }
  });

  const products = Array.isArray(productsData?.data) ? productsData.data : [];

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      BREAKFAST: t('staff.products.categories.breakfast') || 'Breakfast',
      CLEANING: t('staff.products.categories.cleaning') || 'Cleaning',
      MINIBAR: t('staff.products.categories.minibar') || 'Minibar',
      PARKING: t('staff.products.categories.parking') || 'Parking',
      SPA: t('staff.products.categories.spa') || 'Spa',
      EXCURSION: t('staff.products.categories.excursion') || 'Excursion',
      TRANSPORT: t('staff.products.categories.transport') || 'Transport',
      OTHER: t('staff.products.categories.other') || 'Other'
    };
    return labels[category] || category;
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      BREAKFAST: '🍳',
      CLEANING: '🧹',
      MINIBAR: '🍾',
      PARKING: '🅿️',
      SPA: '💆',
      EXCURSION: '🎫',
      TRANSPORT: '🚕',
      OTHER: '📦'
    };
    return icons[category] || '📦';
  };

  // Agrupar productos por categoría
  const groupedProducts = products.reduce((acc: any, product: any) => {
    const category = product.category || 'OTHER';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(product);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('staff.products.title') || 'Products & Services'}
          </h1>
          <p className="text-gray-600 mt-1">
            {t('staff.products.subtitle') || 'View available services synced from PMS'}
          </p>
        </div>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <RefreshCw className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? (t('common.syncing') || 'Syncing...') : (t('staff.products.manualSync') || 'Manual Sync')}
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Package className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-blue-900">
              {t('staff.products.infoTitle') || 'Automatic Sync with Rooms'}
            </h3>
            <p className="text-sm text-blue-700 mt-1">
              {t('staff.products.infoText') || 'Products are automatically synced from your PMS (Mews) when you sync rooms. To add, edit, or remove products, configure them in your PMS system and sync rooms on the Rooms page.'}
            </p>
          </div>
        </div>
      </div>

      {/* Products List */}
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {t('staff.products.noProducts') || 'No products found'}
          </h3>
          <p className="text-gray-600 mb-4">
            {t('staff.products.noProductsText') || 'Sync products from your PMS to get started'}
          </p>
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`} />
            {t('staff.products.syncNow') || 'Sync Now'}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedProducts).map(([category, categoryProducts]: [string, any]) => (
            <div key={category} className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{getCategoryIcon(category)}</span>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {getCategoryLabel(category)}
                  </h2>
                  <span className="ml-auto text-sm text-gray-500">
                    {categoryProducts.length} {categoryProducts.length === 1 ? 'product' : 'products'}
                  </span>
                </div>
              </div>
              <div className="divide-y divide-gray-200">
                {categoryProducts.map((product: any) => (
                  <div key={product.id} className="p-6 hover:bg-gray-50 transition">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {product.name}
                          </h3>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </span>
                        </div>
                        {product.description && (
                          <p className="text-sm text-gray-600 mt-1">
                            {product.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-xs text-gray-500">
                            Code: {product.code}
                          </span>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-2xl font-bold text-gray-900">
                          €{Number(product.price).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      {products.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-600">{t('staff.products.totalProducts') || 'Total Products'}</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{products.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">{t('staff.products.categories') || 'Categories'}</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{Object.keys(groupedProducts).length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">{t('staff.products.avgPrice') || 'Avg. Price'}</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                €{(products.reduce((sum: number, p: any) => sum + Number(p.price), 0) / products.length).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
