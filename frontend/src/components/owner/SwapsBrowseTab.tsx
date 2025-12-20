import { useState } from 'react';
import type { SwapRequest, Week } from '@/types/models';

interface BrowseFilter {
  country: string;
  roomType: string;
}

interface SwapsBrowseTabProps {
  availableSwaps: SwapRequest[];
  weeks: Week[];
  userWeekColors: string[];
  onSelectSwap: (swap: SwapRequest) => void;
  onCreateRequest: () => void;
  getColorName: (color: string) => string;
  getColorEmoji: (color: string) => string;
  getStatusColor: (status: string) => string;
  getStatusIcon: (status: string) => string;
}

// Extract country from location string (assuming format like "Country" or "City, Country")
const extractCountry = (location: string): string => {
  if (!location) return 'Unknown';
  const parts = location.split(',');
  return parts.length > 1 ? parts[parts.length - 1].trim() : location.trim();
};

// Get unique countries from available swaps
const getAvailableCountries = (swaps: SwapRequest[]): string[] => {
  const countries = swaps
    .map(swap => extractCountry(swap.RequesterWeek?.Property?.location || ''))
    .filter((c, i, arr) => arr.indexOf(c) === i)
    .sort();
  return countries;
};

// Get unique room types from user's weeks (what they can offer)
const getUserRoomTypes = (weeks: Week[]): string[] => {
  return [...new Set(weeks.map(w => w.Property?.name || 'Standard'))].sort();
};

export function SwapsBrowseTab({
  availableSwaps,
  weeks,
  userWeekColors,
  onSelectSwap,
  onCreateRequest,
  getColorName,
  getColorEmoji,
  getStatusColor,
  getStatusIcon
}: SwapsBrowseTabProps) {
  const [browseFilters, setBrowseFilters] = useState<BrowseFilter>({
    country: 'all',
    roomType: 'all'
  });

  const availableCountries = getAvailableCountries(availableSwaps);
  const userRoomTypes = getUserRoomTypes(weeks);

  // Filter swaps based on browse filters
  const filteredSwaps = availableSwaps.filter((swap) => {
    // Filter by country if selected
    if (browseFilters.country !== 'all') {
      const swapCountry = extractCountry(swap.RequesterWeek?.Property?.location || '');
      if (swapCountry !== browseFilters.country) {
        return false;
      }
    }

    // Filter by room type if selected (based on property name as proxy for room type)
    if (browseFilters.roomType !== 'all') {
      const swapProperty = swap.RequesterWeek?.Property?.name;
      if (swapProperty !== browseFilters.roomType) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Browse Filters - Filter by DESTINATION (what you're looking for) */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">🔍 Filter Swap Opportunities</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Country Filter - Where do you want to go? */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              🌍 Destination Country
            </label>
            <select
              value={browseFilters.country}
              onChange={(e) =>
                setBrowseFilters({
                  ...browseFilters,
                  country: e.target.value
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All destinations ({availableCountries.length})</option>
              {availableCountries.map((country) => {
                const count = availableSwaps.filter(
                  s => extractCountry(s.RequesterWeek?.Property?.location || '') === country
                ).length;
                return (
                  <option key={country} value={country}>
                    {country} ({count})
                  </option>
                );
              })}
            </select>
            <p className="text-xs text-gray-600 mt-2">Select a country to see available swaps there</p>
          </div>

          {/* Room Type Filter - What kind of accommodation do you prefer? */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              🏠 Accommodation Type
            </label>
            <select
              value={browseFilters.roomType}
              onChange={(e) =>
                setBrowseFilters({
                  ...browseFilters,
                  roomType: e.target.value
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All types ({userRoomTypes.length} you can offer)</option>
              {userRoomTypes.map((roomType) => {
                const count = availableSwaps.filter(
                  s => s.RequesterWeek?.Property?.name === roomType
                ).length;
                return (
                  <option key={roomType} value={roomType}>
                    {roomType} ({count})
                  </option>
                );
              })}
            </select>
            <p className="text-xs text-gray-600 mt-2">Only showing types you can offer in exchange</p>
          </div>
        </div>

        {/* Clear Filters Button */}
        <div className="flex justify-end mt-4">
          <button
            onClick={() =>
              setBrowseFilters({ country: 'all', roomType: 'all' })
            }
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg font-semibold transition"
          >
            ✕ Clear Filters
          </button>
        </div>
      </div>

      {/* Info Box - Auto-filtered by week types */}
      <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-lg">
        <p className="text-sm text-gray-700 mb-2">
          <strong>✓ Auto-filtered by your available week types:</strong>
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          {userWeekColors.map(color => (
            <span key={color} className="inline-flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-blue-200">
              {getColorEmoji(color)}
              <span className="text-sm font-semibold text-gray-900">{getColorName(color)}</span>
            </span>
          ))}
        </div>
        <p className="text-xs text-gray-600 mt-3">
          💡 You can only swap for the same week types you own. To expand your options, check our <button className="text-blue-600 hover:text-blue-700 underline font-semibold">marketplace</button>.
        </p>
      </div>

      {/* Browse Results */}
      {filteredSwaps.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <p className="text-gray-600 mb-4 text-lg">😴 No matching swaps available</p>
          
          {userWeekColors.length === 0 ? (
            // No weeks at all
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                You don't have any weeks yet to swap.
              </p>
              <a 
                href="/marketplace" 
                className="inline-block bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition"
              >
                🛒 Browse Marketplace
              </a>
            </div>
          ) : (
            // Has weeks but no matching swaps
            <div className="space-y-6">
              <p className="text-sm text-gray-600">
                No one is currently looking to swap for your week types ({userWeekColors.map(c => getColorName(c)).join(', ')}).
              </p>

              {/* Try different filters suggestion */}
              {browseFilters.country !== 'all' || browseFilters.roomType !== 'all' ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-gray-700 mb-3">
                    💡 Try clearing your filters to see more options:
                  </p>
                  <button
                    onClick={() =>
                      setBrowseFilters({ country: 'all', roomType: 'all' })
                    }
                    className="inline-block bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg font-semibold transition"
                  >
                    Clear Filters
                  </button>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                  <p className="text-sm text-gray-700">
                    Be the first to create a swap request! Other owners might be looking for what you have.
                  </p>
                  <button
                    onClick={onCreateRequest}
                    className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition"
                  >
                    ➕ Create Your First Request
                  </button>
                </div>
              )}

              {/* Marketplace CTA */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-sm text-gray-700 mb-3">
                  Looking for something you don't have?
                </p>
                <a 
                  href="/marketplace" 
                  className="inline-block bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-semibold transition"
                >
                  🛒 Explore Marketplace
                </a>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredSwaps.map((swap) => (
            <div
              key={swap.id}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition border-l-4 border-blue-500"
            >
              {/* Quick View */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                {/* Their Offering */}
                <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                  <p className="text-xs font-bold text-blue-700 mb-2">🏨 THEY OFFER</p>
                  <p className="font-bold text-lg text-blue-900">
                    {swap.RequesterWeek?.Property?.name}
                  </p>
                  
                  {/* Country Badge */}
                  <div className="mt-2 inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full">
                    🌍 {extractCountry(swap.RequesterWeek?.Property?.location || 'Unknown')}
                  </div>
                  
                  <p className="text-sm text-gray-700 mt-3 mb-2">
                    📅 {new Date(swap.RequesterWeek?.start_date || '').toLocaleDateString('es-ES')} – {' '}
                    {new Date(swap.RequesterWeek?.end_date || '').toLocaleDateString('es-ES')}
                  </p>
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <p className="text-xs text-gray-600 mb-1">Week Type:</p>
                    <p className="text-sm font-bold text-blue-800">
                      {getColorEmoji(swap.RequesterWeek?.color)} {getColorName(swap.RequesterWeek?.color)} Week
                    </p>
                  </div>
                </div>

                {/* What They Want & What You Can Offer */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-lg border-2 border-green-200">
                  <p className="text-xs font-bold text-green-700 mb-2">✓ COMPATIBLE!</p>
                  <p className="font-semibold text-gray-900 mb-3">
                    {getColorEmoji(swap.RequesterWeek?.color)} {getColorName(swap.RequesterWeek?.color)} Week
                  </p>
                  
                  <p className="text-xs text-gray-600 font-semibold mb-2">📍 Your matches:</p>
                  <div className="space-y-2 mb-3">
                    {weeks
                      .filter(w => w.color === swap.RequesterWeek?.color && w.status === 'available')
                      .map((week) => (
                        <div key={week.id} className="bg-white rounded px-3 py-2 border border-green-200 flex items-start gap-2">
                          <span className="text-green-600 mt-1">✓</span>
                          <div>
                            <p className="text-xs font-semibold text-gray-800">{week.Property?.name}</p>
                            <p className="text-xs text-gray-600">
                              {new Date(week.start_date).toLocaleDateString('es-ES')} – {new Date(week.end_date).toLocaleDateString('es-ES')}
                            </p>
                          </div>
                        </div>
                      ))}
                    {weeks.filter(w => w.color === swap.RequesterWeek?.color && w.status === 'available').length === 0 && (
                      <p className="text-xs text-gray-600 italic px-3 py-2 bg-white rounded border border-gray-200">
                        No available weeks of this type currently
                      </p>
                    )}
                  </div>

                  {/* Room Type Compatibility */}
                  <div className="border-t border-green-200 pt-2">
                    <p className="text-xs text-gray-600 mb-1">🏠 Room type offered:</p>
                    <span className="inline-block bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded">
                      {swap.RequesterWeek?.Property?.name}
                    </span>
                  </div>
                </div>

                {/* Fee */}
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">PLATFORM FEE</p>
                  <p className="font-bold text-2xl text-yellow-700">€{swap.swap_fee}</p>
                  <p className="text-xs text-gray-600 mt-1">If you accept</p>
                </div>

                {/* Action */}
                <div className="flex flex-col justify-center">
                  <button
                    onClick={() => onSelectSwap(swap)}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg font-semibold transition mb-2"
                  >
                    ✓ CHECK IT
                  </button>
                  <button
                    onClick={onCreateRequest}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg text-sm transition"
                  >
                    Pass
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
