import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timeshareApi } from '@/api/timeshare';
import { 
  Calendar, MapPin, Home, Star, Search, Filter,
  Loader2, AlertCircle, Coins, X, CheckCircle, TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface WeekAllocation {
  id: number;
  ownership_id: number;
  year: number;
  week_number: number;
  status: 'ASSIGNED' | 'RELEASED' | 'BOOKED' | 'USED' | 'EXPIRED';
  released_at: string | null;
  converted_to_credits: boolean;
  credits_amount: number | null;
  Ownership: {
    id: number;
    type: string;
    fixed_week_number: number;
    contract_reference: string;
    Unit: {
      id: number;
      name: string;
      category: string;
      max_occupancy: number;
      Property: {
        id: number;
        name: string;
        city: string;
        state: string;
        country: string;
        stars: number;
      };
    };
  };
}

export default function MyWeeks() {
  const { t } = useTranslation();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [convertingWeekId, setConvertingWeekId] = useState<number | null>(null);
  const [showConvertModal, setShowConvertModal] = useState(false);
  
  const queryClient = useQueryClient();

  // Fetch weeks for selected year
  const { data: weeks = [], isLoading, error } = useQuery({
    queryKey: ['owner-weeks-v2', selectedYear],
    queryFn: () => timeshareApi.getOwnerWeeks(selectedYear),
    retry: 1
  });

  // Fetch preview when modal opens
  const { data: preview, isLoading: isLoadingPreview } = useQuery({
    queryKey: ['week-release-preview', convertingWeekId],
    queryFn: () => timeshareApi.previewWeekRelease(convertingWeekId!),
    enabled: !!convertingWeekId && showConvertModal,
    retry: 1,
    onSuccess: (data) => {
      console.log('Preview data received:', data);
    }
  });

  // Release mutation
  const releaseMutation = useMutation({
    mutationFn: (weekId: number) => timeshareApi.releaseWeekToCredits(weekId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['owner-weeks-v2'] });
      queryClient.invalidateQueries({ queryKey: ['credit-balance'] });
      toast.success(t('owner.myWeeks.conversionSuccess', { credits: result.creditsEarned }));
      setShowConvertModal(false);
      setConvertingWeekId(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('owner.myWeeks.conversionError'));
    }
  });

  const handleOpenConvertModal = (weekId: number) => {
    setConvertingWeekId(weekId);
    setShowConvertModal(true);
  };

  const handleCloseConvertModal = () => {
    setShowConvertModal(false);
    setConvertingWeekId(null);
  };

  const handleConfirmConvert = () => {
    if (convertingWeekId) {
      releaseMutation.mutate(convertingWeekId);
    }
  };

  // Filter weeks
  const filteredWeeks = useMemo(() => {
    return weeks.filter((week: WeekAllocation) => {
      const matchesStatus = statusFilter === 'all' || week.status === statusFilter;
      const matchesSearch = searchTerm === '' || 
        week.Ownership.Unit.Property.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        week.Ownership.Unit.Property.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
        week.Ownership.Unit.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesStatus && matchesSearch;
    });
  }, [weeks, statusFilter, searchTerm]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = weeks.length;
    const assigned = weeks.filter((w: WeekAllocation) => w.status === 'ASSIGNED').length;
    const released = weeks.filter((w: WeekAllocation) => w.status === 'RELEASED').length;
    const booked = weeks.filter((w: WeekAllocation) => w.status === 'BOOKED').length;
    const used = weeks.filter((w: WeekAllocation) => w.status === 'USED').length;
    
    return { total, assigned, released, booked, used };
  }, [weeks]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      ASSIGNED: 'bg-green-100 text-green-800 border-green-300',
      RELEASED: 'bg-blue-100 text-blue-800 border-blue-300',
      BOOKED: 'bg-purple-100 text-purple-800 border-purple-300',
      USED: 'bg-gray-100 text-gray-800 border-gray-300',
      EXPIRED: 'bg-red-100 text-red-800 border-red-300'
    };

    const labels: Record<string, string> = {
      ASSIGNED: t('owner.myWeeks.statusAssigned'),
      RELEASED: t('owner.myWeeks.statusReleased'),
      BOOKED: t('owner.myWeeks.statusBooked'),
      USED: t('owner.myWeeks.statusUsed'),
      EXPIRED: t('owner.myWeeks.statusExpired')
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">{t('owner.myWeeks.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('owner.myWeeks.errorLoading')}</h3>
          <p className="text-gray-600">
            {t('owner.myWeeks.errorMessage')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="h-7 w-7 text-blue-600" />
              {t('owner.myWeeks.pageTitle')}
            </h1>
            <p className="text-gray-600 mt-1">
              {t('owner.myWeeks.pageSubtitle')}
            </p>
          </div>

          {/* Year selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">{t('owner.myWeeks.year')}:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {[2024, 2025, 2026, 2027, 2028].map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-xs text-gray-600 mt-1">{t('owner.myWeeks.totalStats')}</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-700">{stats.assigned}</div>
            <div className="text-xs text-green-700 mt-1">{t('owner.myWeeks.assignedStats')}</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-700">{stats.released}</div>
            <div className="text-xs text-blue-700 mt-1">{t('owner.myWeeks.releasedStats')}</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-purple-700">{stats.booked}</div>
            <div className="text-xs text-purple-700 mt-1">{t('owner.myWeeks.bookedStats')}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-700">{stats.used}</div>
            <div className="text-xs text-gray-700 mt-1">{t('owner.myWeeks.usedStats')}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder={t('owner.myWeeks.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">{t('owner.myWeeks.allStatuses')}</option>
              <option value="ASSIGNED">{t('owner.myWeeks.statusAssigned')}</option>
              <option value="RELEASED">{t('owner.myWeeks.statusReleased')}</option>
              <option value="BOOKED">{t('owner.myWeeks.statusBooked')}</option>
              <option value="USED">{t('owner.myWeeks.statusUsed')}</option>
              <option value="EXPIRED">{t('owner.myWeeks.statusExpired')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Weeks List */}
      {filteredWeeks.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {t('owner.myWeeks.noWeeksFound')}
          </h3>
          <p className="text-gray-600">
            {searchTerm || statusFilter !== 'all' 
              ? t('owner.myWeeks.adjustFilters')
              : t('owner.myWeeks.noWeeksForYear', { year: selectedYear })
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredWeeks.map((week: WeekAllocation) => (
            <div
              key={week.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                {/* Property Info */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Home className="h-5 w-5 text-blue-600" />
                      <h3 className="font-semibold text-gray-900">
                        {week.Ownership.Unit.Property.name}
                      </h3>
                      {week.Ownership.Unit.Property.stars && (
                        <div className="flex items-center gap-1">
                          {[...Array(week.Ownership.Unit.Property.stars)].map((_, i) => (
                            <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin className="h-4 w-4" />
                      {week.Ownership.Unit.Property.city}, {week.Ownership.Unit.Property.country}
                    </div>
                  </div>
                  {getStatusBadge(week.status)}
                </div>

                {/* Unit & Week Info */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{t('owner.myWeeks.unit')}:</span>
                    <span className="font-medium text-gray-900">
                      {week.Ownership.Unit.category}
                    </span>
                  </div>
                  {week.Ownership.Unit.description && (
                    <div className="text-sm">
                      <span className="text-gray-600">{t('owner.myWeeks.description')}:</span>
                      <p className="text-gray-700 mt-1 text-xs leading-relaxed">
                        {week.Ownership.Unit.description}
                      </p>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{t('owner.myWeeks.dates')}:</span>
                    <span className="font-medium text-gray-900">
                      {format(new Date(week.start_date), 'dd MMM', { locale: es })} - {format(new Date(week.end_date), 'dd MMM yyyy', { locale: es })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{t('owner.myWeeks.weekNumber')}:</span>
                    <span className="font-medium text-gray-900">
                      {t('owner.myWeeks.weekHashNumber', { number: week.week_number })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{t('owner.myWeeks.contract')}:</span>
                    <span className="font-mono text-xs text-gray-700">
                      {week.Ownership.contract_reference}
                    </span>
                  </div>
                </div>

                {/* Credits Info (if released) */}
                {week.converted_to_credits && week.credits_amount && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-blue-800">{t('owner.myWeeks.convertedToCredits')}</span>
                      <span className="font-bold text-blue-900">{t('owner.myWeeks.creditsAmount', { amount: week.credits_amount })}</span>
                    </div>
                    {week.released_at && (
                      <div className="text-xs text-blue-700 mt-1">
                        {t('owner.myWeeks.releasedOn', { date: format(new Date(week.released_at), 'dd MMM yyyy', { locale: es }) })}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                {week.status === 'ASSIGNED' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenConvertModal(week.id)}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-center text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <Coins className="h-4 w-4" />
                      {t('owner.myWeeks.convertToCredits')}
                    </button>
                  </div>
                )}

                {week.status === 'BOOKED' && (
                  <div className="text-sm text-gray-600 text-center py-2 bg-purple-50 rounded-lg">
                    {t('owner.myWeeks.weekIsBooked')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Convert to Credits Modal */}
      {showConvertModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Coins className="h-6 w-6" />
                  </div>
                  <h2 className="text-2xl font-bold">{t('owner.myWeeks.modalTitle')}</h2>
                </div>
                <button
                  onClick={handleCloseConvertModal}
                  className="p-1 hover:bg-white/20 rounded-lg transition"
                  disabled={releaseMutation.isPending}
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              {isLoadingPreview ? (
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>{t('owner.myWeeks.calculatingCredits')}</span>
                </div>
              ) : preview && (
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm mb-1">{t('owner.myWeeks.creditsYouWillReceive')}</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold">{preview.estimatedCredits}</span>
                        <span className="text-lg text-blue-200">{t('owner.myWeeks.credits')}</span>
                      </div>
                    </div>
                    <TrendingUp className="h-12 w-12 text-white/40" />
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/20 text-sm text-blue-100">
                    <Calendar className="h-4 w-4 inline mr-2" />
                    {t('owner.myWeeks.expiresOn', { date: format(new Date(preview.expirationDate), 'dd MMM yyyy', { locale: es }) })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {isLoadingPreview ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : preview ? (
                <>
                  {/* Week Info */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('owner.myWeeks.weekInfoTitle')}</h3>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">{t('owner.myWeeks.property')}:</span>
                        <span className="font-medium text-gray-900">{preview.weekInfo.propertyName}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">{t('owner.myWeeks.unit')}:</span>
                        <span className="font-medium text-gray-900">{preview.weekInfo.unitName}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">{t('owner.myWeeks.weekLabel')}:</span>
                        <span className="font-medium text-gray-900">{t('owner.myWeeks.weekOf', { number: preview.weekInfo.weekNumber, year: preview.weekInfo.year })}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">{t('owner.myWeeks.dates')}:</span>
                        <span className="font-medium text-gray-900">
                          {format(new Date(preview.weekInfo.startDate), 'dd MMM', { locale: es })} - {' '}
                          {format(new Date(preview.weekInfo.endDate), 'dd MMM yyyy', { locale: es })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Calculation Breakdown */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('owner.myWeeks.calculationBreakdown')}</h3>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">{t('owner.myWeeks.seasonBaseValue')}</span>
                        <span className="font-medium text-gray-900">{preview.breakdown.baseSeason} {t('owner.myWeeks.credits')}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">{t('owner.myWeeks.tierMultiplier')}</span>
                        <span className="font-medium text-gray-900">×{preview.breakdown.tierMultiplier}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">{t('owner.myWeeks.roomMultiplier')}</span>
                        <span className="font-medium text-gray-900">×{preview.breakdown.roomMultiplier}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">{t('owner.myWeeks.locationMultiplier')}</span>
                        <span className="font-medium text-gray-900">×{preview.breakdown.locationMultiplier}</span>
                      </div>
                      <div className="pt-2 mt-2 border-t border-gray-200">
                        <div className="flex justify-between">
                          <span className="font-semibold text-gray-900">{t('owner.myWeeks.total')}</span>
                          <span className="text-xl font-bold text-blue-600">{preview.estimatedCredits} {t('owner.myWeeks.credits')}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Warning */}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-semibold text-amber-900 mb-2">{t('owner.myWeeks.importantInfo')}</p>
                        <ul className="space-y-1 text-amber-800 text-xs">
                          <li>• {t('owner.myWeeks.actionIrreversible')}</li>
                          <li>• {t('owner.myWeeks.creditsExpire6Months')}</li>
                          <li>• {t('owner.myWeeks.useCreditsAnywhere')}</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
                  <p className="text-gray-600">{t('owner.myWeeks.errorLoading')}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={handleCloseConvertModal}
                disabled={releaseMutation.isPending}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium disabled:opacity-50"
              >
                {t('owner.myWeeks.cancel')}
              </button>
              <button
                onClick={handleConfirmConvert}
                disabled={releaseMutation.isPending || !preview}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {releaseMutation.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {t('owner.myWeeks.processing')}
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5" />
                    {t('owner.myWeeks.confirmConversion')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
