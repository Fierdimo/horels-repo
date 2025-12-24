import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Clock, AlertCircle, ArrowRight, CheckCircle } from 'lucide-react';
import { format, parseISO, differenceInDays, addMonths } from 'date-fns';
import toast from 'react-hot-toast';
import { timeshareApi } from '@/services/timeshareApi';

export default function ConvertWeek() {
  const { weekId } = useParams<{ weekId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [confirmed, setConfirmed] = useState(false);

  // Fetch week details
  const { data: week, isLoading } = useQuery({
    queryKey: ['week', weekId],
    queryFn: () => timeshareApi.get(`/weeks/${weekId}`).then(res => res.data),
  });

  // Convert mutation
  const convertMutation = useMutation({
    mutationFn: (weekId: string) =>
      timeshareApi.post(`/weeks/${weekId}/convert`).then(res => res.data),
    onSuccess: () => {
      toast.success(t('owner.credits.convertSuccess'));
      queryClient.invalidateQueries({ queryKey: ['night-credits'] });
      queryClient.invalidateQueries({ queryKey: ['weeks'] });
      navigate('/owner/credits');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('common.error'));
    },
  });

  const handleConvert = () => {
    if (!confirmed) {
      toast.error(t('owner.credits.confirmRequired'));
      return;
    }
    convertMutation.mutate(weekId!);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!week) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-red-800">{t('owner.weeks.notFound')}</p>
        </div>
      </div>
    );
  }

  const nights = differenceInDays(parseISO(week.end_date), parseISO(week.start_date));
  
  // All weeks convert to 7 night credits (standard week)
  const creditsToReceive = 7;
  const expiresAt = format(addMonths(new Date(), 18), 'MMM d, yyyy');


  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {t('owner.credits.convertToCredits')}
        </h1>
        <p className="text-gray-600">
          {t('owner.credits.convertDescription')}
        </p>
      </div>

      {/* Week Details Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {t('owner.weeks.weekDetails')}
          </h2>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Property */}
            <div>
              <label className="text-sm font-medium text-gray-500 block mb-1">
                {t('common.property')}
              </label>
              <p className="text-gray-900 font-medium">{week.Property?.name}</p>
            </div>

            {/* Dates */}
            <div>
              <label className="text-sm font-medium text-gray-500 block mb-1">
                {t('owner.credits.dates')}
              </label>
              <p className="text-gray-900 font-medium">
                {format(parseISO(week.start_date), 'MMM d')} - {format(parseISO(week.end_date), 'MMM d, yyyy')}
              </p>
            </div>

            {/* Nights */}
            <div>
              <label className="text-sm font-medium text-gray-500 block mb-1">
                {t('owner.credits.nights')}
              </label>
              <p className="text-gray-900 font-medium">{nights} {t('common.nights')}</p>
            </div>

            {/* Accommodation Type */}
            <div>
              <label className="text-sm font-medium text-gray-500 block mb-1">
                {t('owner.weeks.accommodationType')}
              </label>
              <span className="inline-flex px-3 py-1 text-xs font-semibold rounded-full border bg-blue-50 text-blue-700 border-blue-200">
                {week.accommodation_type}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Conversion Arrow */}
      <div className="flex justify-center mb-6">
        <div className="flex items-center gap-4 text-gray-400">
          <div className="h-px w-20 bg-gray-300"></div>
          <ArrowRight className="w-8 h-8" />
          <div className="h-px w-20 bg-gray-300"></div>
        </div>
      </div>

      {/* Credits Result Card */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-sm border-2 border-blue-200 overflow-hidden mb-6">
        <div className="bg-blue-100 px-6 py-4 border-b-2 border-blue-200">
          <h2 className="text-lg font-semibold text-blue-900 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            {t('owner.credits.creditsYouWillReceive')}
          </h2>
        </div>
        
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="text-5xl font-bold text-blue-600 mb-2">
              {creditsToReceive}
            </div>
            <div className="text-gray-600 font-medium">
              {t('owner.credits.nightCredits')}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900 mb-1">
                    {t('owner.credits.flexibility')}
                  </p>
                  <p className="text-gray-600 text-xs">
                    {t('owner.credits.useAnyProperty')}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900 mb-1">
                    {t('owner.credits.validity')}
                  </p>
                  <p className="text-gray-600 text-xs">
                    {t('owner.credits.validUntil')} {expiresAt}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Important Information */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-900 mb-2">
              {t('owner.credits.importantInfo')}
            </p>
            <ul className="space-y-1 text-amber-800">
              <li>• {t('owner.credits.conversionPermanent')}</li>
              <li>• {t('owner.credits.creditsNonTransferable')}</li>
              <li>• {t('owner.credits.creditsExpire', { months: 18 })}</li>
              <li>• {t('owner.credits.peakPeriodsRestriction')}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Confirmation Checkbox */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-1 h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">
            {t('owner.credits.confirmConversion')}
          </span>
        </label>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={() => navigate('/owner/credits')}
          className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={handleConvert}
          disabled={!confirmed || convertMutation.isPending}
          className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
        >
          {convertMutation.isPending ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              {t('owner.credits.converting')}
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              {t('owner.credits.confirmConvert')}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
