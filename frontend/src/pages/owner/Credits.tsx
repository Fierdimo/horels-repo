import { useTranslation } from 'react-i18next';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { useQuery } from '@tanstack/react-query';
import { timeshareApi } from '@/api/timeshare';
import { Link } from 'react-router-dom';
import { CreditCard, Calendar, Plus, ArrowRight } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';

export default function Credits() {
  const { t } = useTranslation();

  // Get night credits
  const { data: credits, isLoading: creditsLoading, error: creditsError } = useQuery({
    queryKey: ['credits'],
    queryFn: timeshareApi.getCredits
  });

  // Get weeks for conversion
  const { data: weeks, isLoading: weeksLoading, error: weeksError } = useQuery({
    queryKey: ['weeks'],
    queryFn: timeshareApi.getWeeks
  });

  if (creditsLoading || weeksLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (creditsError || weeksError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <ErrorMessage message={t('common.error')} />
      </div>
    );
  }

  const availableCredits = credits?.filter(c => c.nights_available > c.nights_used) || [];
  const totalAvailableNights = availableCredits.reduce(
    (sum, credit) => sum + (credit.nights_available - credit.nights_used), 
    0
  );

  const convertibleWeeks = weeks?.filter(w => w.status === 'available') || [];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t('owner.credits.title')}
          </h1>
          <p className="text-gray-600">
            {t('owner.credits.subtitle')}
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Available Nights</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{totalAvailableNights}</p>
              </div>
              <CreditCard className="h-12 w-12 text-blue-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Credits</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{availableCredits.length}</p>
              </div>
              <Calendar className="h-12 w-12 text-green-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Weeks to Convert</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{convertibleWeeks.length}</p>
              </div>
              <ArrowRight className="h-12 w-12 text-purple-500 opacity-20" />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 mb-8">
          <Link
            to="/owner/night-credit-requests/new"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="h-5 w-5 mr-2" />
            Create Night Credit Request
          </Link>

          <Link
            to="/owner/night-credit-requests"
            className="inline-flex items-center px-6 py-3 bg-white text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors shadow-sm border border-gray-300"
          >
            View My Requests
          </Link>
        </div>

        {/* Available Credits */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              My Night Credits
            </h2>
          </div>

          {availableCredits.length === 0 ? (
            <div className="p-8 text-center">
              <CreditCard className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-600 mb-4">No night credits available</p>
              <p className="text-sm text-gray-500">
                Convert your available weeks to night credits below
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Credit ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Available Nights
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Used Nights
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Expires
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {availableCredits.map((credit) => {
                    const remaining = credit.nights_available - credit.nights_used;
                    return (
                      <tr key={credit.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          #{credit.id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {remaining} nights
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {credit.nights_used} / {credit.nights_available}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {format(parseISO(credit.expires_at), 'MMM d, yyyy')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {remaining > 0 ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              Active
                            </span>
                          ) : (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                              Depleted
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Convertible Weeks */}
        {convertibleWeeks.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Available Weeks for Conversion
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Convert your weeks to night credits to use at any property
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Property
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dates
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nights
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Color
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {convertibleWeeks.map((week) => {
                    const nights = differenceInDays(
                      parseISO(week.end_date),
                      parseISO(week.start_date)
                    );
                    
                    return (
                      <tr key={week.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {week.Property?.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {format(parseISO(week.start_date), 'MMM d')} - {format(parseISO(week.end_date), 'MMM d, yyyy')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {nights} nights
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                            ${week.color === 'red' ? 'bg-red-100 text-red-800' : ''}
                            ${week.color === 'blue' ? 'bg-blue-100 text-blue-800' : ''}
                            ${week.color === 'white' ? 'bg-gray-100 text-gray-800' : ''}
                          `}>
                            {week.color}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <Link
                            to={`/owner/weeks/${week.id}/convert`}
                            className="text-blue-600 hover:text-blue-900 font-medium"
                          >
                            Convert to Credits →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

