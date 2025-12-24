import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { useQuery } from '@tanstack/react-query';
import { timeshareApi } from '@/api/timeshare';
import { Link } from 'react-router-dom';
import { CreditCard, Calendar, Plus, ArrowRight, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import { format, parseISO, differenceInDays, isAfter, isBefore, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

export default function Credits() {
  const { t } = useTranslation();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Get night credits
  const { data: credits, isLoading: creditsLoading, error: creditsError } = useQuery({
    queryKey: ['credits'],
    queryFn: timeshareApi.getCredits
  });

  // Get weeks for conversion
  const { data: weeks, isLoading: weeksLoading, error: weeksError } = useQuery({
    queryKey: ['weeks'],
    queryFn: () => timeshareApi.getWeeks()
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

  // Ensure data is array before filtering - handle undefined/null safely
  const allCredits = credits && Array.isArray(credits) ? credits : [];
  
  const activeCredits = allCredits.filter(c => {
    if (!c || !c.nights_available || c.nights_used === undefined || !c.expires_at) return false;
    try {
      const expiryDate = parseISO(c.expires_at);
      return isBefore(new Date(), expiryDate) && (c.nights_available > c.nights_used);
    } catch (e) {
      return false;
    }
  });
  
  const expiredCredits = allCredits.filter(c => {
    if (!c || !c.expires_at) return false;
    try {
      return isAfter(new Date(), parseISO(c.expires_at));
    } catch (e) {
      return false;
    }
  });
  
  const usedUpCredits = allCredits.filter(c => {
    if (!c || !c.nights_available || c.nights_used === undefined || !c.expires_at) return false;
    try {
      const expiryDate = parseISO(c.expires_at);
      return isBefore(new Date(), expiryDate) && (c.nights_available <= c.nights_used);
    } catch (e) {
      return false;
    }
  });
  
  const expiringCredits = allCredits.filter(c => {
    if (!c || !c.expires_at) return false;
    try {
      const expiryDate = parseISO(c.expires_at);
      return isBefore(new Date(), expiryDate) && differenceInDays(expiryDate, new Date()) <= 30;
    } catch (e) {
      return false;
    }
  });

  const totalAvailableNights = activeCredits.reduce(
    (sum, credit) => sum + (credit && credit.nights_available && credit.nights_used !== undefined ? (credit.nights_available - credit.nights_used) : 0), 
    0
  );

  const totalUsedNights = allCredits.reduce((sum, credit) => sum + (credit && credit.nights_used ? credit.nights_used : 0), 0);
  const totalNights = allCredits.reduce((sum, credit) => sum + (credit && credit.nights_available ? credit.nights_available : 0), 0);

  // Filter weeks that can be converted to credits
  // ONLY timeshare weeks with status='available' (any duration >= 1 night)
  const convertibleWeeks = Array.isArray(weeks) ? weeks.filter(w => {
    if (!w || w.status !== 'available') return false;
    
    // Verify it has at least 1 night
    try {
      // Handle floating periods (nights field) vs fixed periods (dates)
      if (w.nights) {
        return w.nights >= 1;
      } else if (w.start_date && w.end_date) {
        const nights = differenceInDays(parseISO(w.end_date), parseISO(w.start_date));
        return nights >= 1;
      }
      return false;
    } catch (e) {
      return false;
    }
  }) : [];

  // Calendar logic
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const creditsByDate: { [key: string]: any[] } = {};
  allCredits.forEach(credit => {
    if (credit && credit.expires_at) {
      try {
        const expiryDate = format(parseISO(credit.expires_at), 'yyyy-MM-dd');
        if (!creditsByDate[expiryDate]) creditsByDate[expiryDate] = [];
        creditsByDate[expiryDate].push(credit);
      } catch (err) {
        console.error('Error parsing credit expiry date:', err);
      }
    }
  });

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

        {/* Empty State */}
        {allCredits.length === 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 mb-8 text-center">
            <Calendar className="h-12 w-12 text-blue-400 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('owner.credits.noCredits')}</h3>
            <p className="text-gray-600 mb-4">{t('owner.credits.noCreditsDesc')}</p>
          </div>
        )}
        {allCredits.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* Available Nights */}
          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('owner.credits.available')}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{totalAvailableNights}</p>
                <p className="text-xs text-gray-500 mt-1">{activeCredits.length} {t('common.all')}</p>
              </div>
              <CreditCard className="h-12 w-12 text-blue-500 opacity-20" />
            </div>
          </div>

          {/* Total Nights */}
          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('owner.credits.total')}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{totalNights}</p>
                <p className="text-xs text-gray-500 mt-1">{allCredits.length} {t('owner.credits.credits')}</p>
              </div>
              <TrendingUp className="h-12 w-12 text-green-500 opacity-20" />
            </div>
          </div>

          {/* Used Nights */}
          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('owner.credits.used')}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{totalUsedNights}</p>
                <p className="text-xs text-gray-500 mt-1">{Math.round((totalUsedNights / totalNights) * 100) || 0}% {t('common.completed')}</p>
              </div>
              <CheckCircle className="h-12 w-12 text-orange-500 opacity-20" />
            </div>
          </div>

          {/* Active Conversions */}
          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('owner.credits.convertible')}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{convertibleWeeks.length}</p>
                <p className="text-xs text-gray-500 mt-1">{t('owner.credits.available')}</p>
              </div>
              <ArrowRight className="h-12 w-12 text-purple-500 opacity-20" />
            </div>
          </div>
        </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4 mb-8 flex-wrap">
          <Link
            to="/owner/night-credit-requests/new"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="h-5 w-5 mr-2" />
            {t('owner.credits.newRequest')}
          </Link>

          <Link
            to="/owner/night-credit-requests"
            className="inline-flex items-center px-6 py-3 bg-white text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors shadow-sm border border-gray-300"
          >
            {t('owner.credits.viewRequests')}
          </Link>
        </div>

        {allCredits.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            {/* Calendar */}
            <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  {format(currentMonth, 'MMMM yyyy')}
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                    className="p-2 hover:bg-gray-100 rounded-lg transition"
                  >
                    ←
                  </button>
                  <button
                    onClick={() => setCurrentMonth(new Date())}
                    className="px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-lg transition"
                  >
                    {t('common.today')}
                  </button>
                  <button
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                    className="p-2 hover:bg-gray-100 rounded-lg transition"
                  >
                    →
                  </button>
                </div>
              </div>

              {/* Day names */}
              <div className="grid grid-cols-7 gap-2 mb-2">
                {dayNames.map(day => (
                  <div key={day} className="text-center text-xs font-semibold text-gray-600 py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Days */}
              <div className="grid grid-cols-7 gap-2">
                {daysInMonth.map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const hasCredits = creditsByDate[dateStr]?.length > 0;
                  const isCurrentMonth = day.getMonth() === currentMonth.getMonth();

                  return (
                    <div
                      key={dateStr}
                      className={`aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition ${
                        hasCredits
                          ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                          : isCurrentMonth
                          ? 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                      title={hasCredits ? `${creditsByDate[dateStr].length} ${t('owner.credits.credits')} ${t('owner.credits.expiresAt').toLowerCase()}` : ''}
                    >
                      {day.getDate()}
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 pt-6 border-t">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-4 h-4 bg-blue-100 border-2 border-blue-500 rounded"></div>
                  <span>{t('owner.credits.expirationDates')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Credits by Status */}
          <div className="lg:col-span-2 space-y-6">
            {/* Active Credits */}
            {activeCredits.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-green-50">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    {t('owner.credits.activeCredits')} ({activeCredits.length})
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('owner.credits.remaining')}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('owner.credits.progress')}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.expired')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {activeCredits.map((credit) => {
                        const remaining = credit.nights_available - credit.nights_used;
                        const percentage = Math.round((credit.nights_used / credit.nights_available) * 100);
                        return (
                          <tr key={credit.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">#{credit.id}</td>
                            <td className="px-6 py-4 text-sm font-semibold text-green-600">{remaining} / {credit.nights_available}</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-xs">
                                  <div
                                    className="bg-green-500 h-2 rounded-full transition"
                                    style={{ width: `${percentage}%` }}
                                  ></div>
                                </div>
                                <span className="text-xs text-gray-600">{percentage}%</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {format(parseISO(credit.expires_at), 'MMM d, yyyy')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Expiring Soon */}
            {activeCredits.some(c => {
              const daysUntilExpiry = differenceInDays(parseISO(c.expires_at), new Date());
              return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
            }) && (
              <div className="bg-orange-50 border-l-4 border-orange-500 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-orange-900">{t('owner.credits.expiringWarning')}</h4>
                    <p className="text-sm text-orange-800 mt-1">
                      {t('owner.credits.creditsExpiringSoon')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Used Up Credits */}
            {usedUpCredits.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {t('owner.credits.usedUp')} ({usedUpCredits.length})
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('owner.credits.nights')}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.expired')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {usedUpCredits.map((credit) => (
                        <tr key={credit.id} className="opacity-60">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">#{credit.id}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{credit.nights_available} ({t('owner.credits.used').toLowerCase()}: {credit.nights_used})</td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {format(parseISO(credit.expires_at), 'MMM d, yyyy')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Expired Credits */}
            {expiredCredits.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-red-50">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {t('owner.credits.expired')} ({expiredCredits.length})
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('owner.credits.nights')}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.expired')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {expiredCredits.map((credit) => (
                        <tr key={credit.id} className="opacity-50">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">#{credit.id}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{credit.nights_available}</td>
                          <td className="px-6 py-4 text-sm text-red-600 font-medium">
                            {format(parseISO(credit.expires_at), 'MMM d, yyyy')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Convertible Weeks */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              {t('owner.credits.convertibleWeeks')}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {t('owner.credits.convertDescription')}
            </p>
          </div>

          {convertibleWeeks.length === 0 ? (
            <div className="p-8 text-center">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {t('owner.credits.noWeeksAvailable')}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {t('owner.credits.noWeeksAvailableDesc')}
              </p>
              <div className="max-w-md mx-auto text-left bg-blue-50 rounded-lg p-4 mt-4">
                <p className="text-sm text-gray-700 font-medium mb-2">
                  {t('owner.credits.requirementsTitle')}:
                </p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• {t('owner.credits.requirement1')}</li>
                  <li>• {t('owner.credits.requirement2')}</li>
                  <li>• {t('owner.credits.requirement3')}</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('common.property')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('owner.credits.dates')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('owner.credits.nights')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('owner.weeks.accommodationType')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('common.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {convertibleWeeks.map((week) => {
                    // Handle floating periods (nights field) vs fixed periods (dates)
                    const nights = week.nights 
                      ? week.nights 
                      : differenceInDays(parseISO(week.end_date), parseISO(week.start_date));
                    
                    const isFloating = !!week.nights && !week.start_date;
                    
                    return (
                      <tr key={week.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {week.Property?.name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {isFloating ? (
                            <div>
                              <span className="font-medium text-blue-600">{t('owner.credits.floatingPeriod')}</span>
                              {week.valid_until && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {t('owner.credits.validUntil')}: {format(parseISO(week.valid_until), 'MMM d, yyyy')}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="whitespace-nowrap">
                              {format(parseISO(week.start_date), 'MMM d')} - {format(parseISO(week.end_date), 'MMM d, yyyy')}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                          {nights} {t('common.nights')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            {week.accommodation_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <Link
                            to={`/owner/weeks/${week.id}/convert`}
                            className="text-blue-600 hover:text-blue-900 font-medium transition"
                          >
                            {t('owner.credits.convert')} →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

