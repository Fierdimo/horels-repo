/**
 * UnifiedSearchService (V2)
 * 
 * Combines timeshare inventory (released weeks) with hotel inventory (PMS)
 * into a unified search result.
 * 
 * Architecture:
 * 1. Query week_allocations (timeshare source)
 * 2. Query hotel_inventory (hotel PMS source)
 * 3. Merge results with unified pricing
 * 4. Sort by relevance/price
 * 
 * See: docs_v2/TIMESHARE_PLATFORM_V2_SPEC.md - Phase 4
 */

import { Op } from 'sequelize';
import WeekAllocation from '../../models/v2/WeekAllocation';
import Ownership from '../../models/v2/Ownership';
import TimeshareUnit from '../../models/v2/TimeshareUnit';
import TimeshareProperty from '../../models/v2/TimeshareProperty';
import HotelInventory from '../../models/v2/HotelInventory';

/**
 * Search filters
 */
export interface UnifiedSearchFilters {
  // Location
  location?: string; // City/country search
  propertyId?: number; // Specific property

  // Dates
  checkIn: Date;
  checkOut: Date;

  // Capacity
  guests: number;

  // Source filtering
  includeTimeshare?: boolean; // Default: true
  includeHotels?: boolean; // Default: true

  // Price/Credits
  minCredits?: number;
  maxCredits?: number;

  // Pagination
  page?: number;
  limit?: number;
  sortBy?: 'credits' | 'date' | 'relevance';
}

/**
 * Unified search result item
 */
export interface UnifiedSearchResult {
  // Unique ID (prefixed with source)
  id: string; // Format: "ts_123" or "hotel_456"
  source: 'TIMESHARE' | 'HOTEL_PMS';

  // Property information
  property: {
    id: number;
    name: string;
    location: string;
    images: string[];
    rating?: number;
  };

  // Unit/Room information
  unit: {
    category: string;
    capacity: number;
    bedrooms?: number;
    amenities: string[];
  };

  // Dates
  dates: {
    checkIn: Date;
    checkOut: Date;
    nights: number;
  };

  // Pricing
  price: {
    credits: number; // Credit cost
    cash?: number; // Cash equivalent (for hotels)
    currency: string;
  };

  // Availability
  availability: {
    available: boolean;
    quantity: number; // How many available
  };

  // Metadata
  meta?: {
    weekAllocationId?: number; // If timeshare
    inventoryId?: number; // If hotel
  };
}

/**
 * Search response
 */
export interface UnifiedSearchResponse {
  results: UnifiedSearchResult[];
  meta: {
    totalResults: number;
    timeshareResults: number;
    hotelResults: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * UnifiedSearchService
 * 
 * Searches across both timeshare and hotel inventory.
 */
export class UnifiedSearchService {
  /**
   * Search unified inventory
   * 
   * @param filters - Search criteria
   * @returns Unified search results
   */
  async search(filters: UnifiedSearchFilters): Promise<UnifiedSearchResponse> {
    const {
      checkIn,
      checkOut,
      guests,
      includeTimeshare = true,
      includeHotels = true,
      page = 1,
      limit = 20,
      sortBy = 'credits',
    } = filters;

    // Calculate nights
    const nights = Math.ceil(
      (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Parallel search
    const [timeshareResults, hotelResults] = await Promise.all([
      includeTimeshare ? this.searchTimeshare(filters, nights) : [],
      includeHotels ? this.searchHotels(filters, nights) : [],
    ]);

    // Merge and sort
    let allResults = [...timeshareResults, ...hotelResults];

    // Apply credit filters
    if (filters.minCredits !== undefined) {
      allResults = allResults.filter((r) => r.price.credits >= filters.minCredits!);
    }
    if (filters.maxCredits !== undefined) {
      allResults = allResults.filter((r) => r.price.credits <= filters.maxCredits!);
    }

    // Sort
    allResults = this.sortResults(allResults, sortBy);

    // Paginate
    const totalResults = allResults.length;
    const totalPages = Math.ceil(totalResults / limit);
    const offset = (page - 1) * limit;
    const paginatedResults = allResults.slice(offset, offset + limit);

    return {
      results: paginatedResults,
      meta: {
        totalResults,
        timeshareResults: timeshareResults.length,
        hotelResults: hotelResults.length,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Search timeshare inventory (released weeks)
   * 
   * @param filters - Search criteria
   * @param nights - Number of nights
   * @returns Timeshare results
   */
  private async searchTimeshare(
    filters: UnifiedSearchFilters,
    nights: number
  ): Promise<UnifiedSearchResult[]> {
    const { checkIn, checkOut, guests, location, propertyId } = filters;

    // Build query for released weeks
    const where: any = {
      status: 'RELEASED',
      start_date: { [Op.gte]: checkIn },
      end_date: { [Op.lte]: checkOut },
    };

    // Find matching week allocations
    const weeks = await WeekAllocation.findAll({
      where,
      include: [
        {
          model: Ownership,
          as: 'ownership',
          required: true,
          include: [
            {
              model: TimeshareUnit,
              as: 'unit',
              required: true,
              where: {
                capacity: { [Op.gte]: guests }, // Unit can accommodate guests
                is_active: true,
              },
              include: [
                {
                  model: TimeshareProperty,
                  as: 'property',
                  required: true,
                  where: {
                    is_active: true,
                    ...(propertyId && { id: propertyId }),
                    ...(location && {
                      [Op.or]: [
                        { city: { [Op.like]: `%${location}%` } },
                        { region: { [Op.like]: `%${location}%` } },
                        { country: { [Op.like]: `%${location}%` } },
                      ],
                    }),
                  },
                },
              ],
            },
          ],
        },
      ],
      order: [['start_date', 'ASC']],
    });

    // Transform to unified format
    return weeks.map((week) => {
      const ownership = week.ownership as any;
      const unit = ownership.unit;
      const property = unit.property;

      return {
        id: `ts_${week.id}`,
        source: 'TIMESHARE' as const,
        property: {
          id: property.id,
          name: property.name,
          location: `${property.city}, ${property.region}, ${property.country}`,
          images: this.parseJSON(property.images) || [],
          rating: undefined, // Timeshare properties don't have ratings
        },
        unit: {
          category: unit.category || unit.name,
          capacity: unit.capacity,
          bedrooms: unit.bedrooms,
          amenities: this.parseJSON(unit.amenities) || [],
        },
        dates: {
          checkIn: week.start_date,
          checkOut: week.end_date,
          nights: this.calculateNights(week.start_date, week.end_date),
        },
        price: {
          credits: week.credits_issued || 0,
          currency: unit.currency || 'EUR',
        },
        availability: {
          available: true,
          quantity: 1, // Released weeks are unique
        },
        meta: {
          weekAllocationId: week.id,
        },
      };
    });
  }

  /**
   * Search hotel inventory (PMS cache)
   * 
   * @param filters - Search criteria
   * @param nights - Number of nights
   * @returns Hotel results
   */
  private async searchHotels(
    filters: UnifiedSearchFilters,
    nights: number
  ): Promise<UnifiedSearchResult[]> {
    const { checkIn, checkOut, guests, location, propertyId } = filters;

    // Find available hotel inventory
    // Note: hotel_inventory is a daily cache, we need to check all dates
    const inventory = await HotelInventory.findAll({
      where: {
        date: {
          [Op.between]: [checkIn, checkOut],
        },
        available_rooms: { [Op.gt]: 0 },
      },
      include: [
        {
          model: TimeshareProperty,
          as: 'property',
          required: true,
          where: {
            is_active: true,
            pms_provider: { [Op.not]: null }, // Only properties with PMS
            ...(propertyId && { id: propertyId }),
            ...(location && {
              [Op.or]: [
                { city: { [Op.like]: `%${location}%` } },
                { region: { [Op.like]: `%${location}%` } },
                { country: { [Op.like]: `%${location}%` } },
              ],
            }),
          },
        },
      ],
      order: [['date', 'ASC'], ['rate', 'ASC']],
    });

    // Group by property + room_category
    const grouped = this.groupHotelInventory(inventory, checkIn, checkOut, nights);

    // Filter by capacity (we need to check if room category can fit guests)
    // For now, we'll assume capacity mapping from category name
    const filtered = grouped.filter((item) => {
      const capacity = this.estimateCapacityFromCategory(item.roomCategory);
      return capacity >= guests;
    });

    // Transform to unified format
    return filtered.map((item) => {
      const property = item.property;
      const creditsNeeded = this.calculateHotelCredits(item.averageRate, nights);

      return {
        id: `hotel_${item.propertyId}_${item.roomCategory.replace(/\s/g, '_')}`,
        source: 'HOTEL_PMS' as const,
        property: {
          id: property.id,
          name: property.name,
          location: `${property.city}, ${property.region}, ${property.country}`,
          images: this.parseJSON(property.images) || [],
          rating: undefined, // Could add property rating later
        },
        unit: {
          category: item.roomCategory,
          capacity: this.estimateCapacityFromCategory(item.roomCategory),
          amenities: this.parseJSON(property.amenities) || [],
        },
        dates: {
          checkIn,
          checkOut,
          nights,
        },
        price: {
          credits: creditsNeeded,
          cash: item.averageRate * nights,
          currency: item.currency || 'EUR',
        },
        availability: {
          available: item.minAvailable > 0,
          quantity: item.minAvailable, // Minimum available across all dates
        },
        meta: {
          inventoryId: item.inventoryIds[0], // First inventory record ID
        },
      };
    });
  }

  /**
   * Group hotel inventory by property + room category
   * 
   * Ensures all nights are available
   */
  private groupHotelInventory(
    inventory: HotelInventory[],
    checkIn: Date,
    checkOut: Date,
    nights: number
  ): Array<{
    propertyId: number;
    property: TimeshareProperty;
    roomCategory: string;
    averageRate: number;
    minAvailable: number;
    currency: string;
    inventoryIds: number[];
  }> {
    const grouped = new Map<string, any>();

    for (const inv of inventory) {
      const key = `${inv.property_id}_${inv.room_category}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          propertyId: inv.property_id,
          property: inv.property,
          roomCategory: inv.room_category,
          totalRate: 0,
          minAvailable: inv.available_rooms,
          count: 0,
          currency: inv.currency,
          inventoryIds: [],
        });
      }

      const group = grouped.get(key);
      group.totalRate += inv.rate;
      group.minAvailable = Math.min(group.minAvailable, inv.available_rooms);
      group.count++;
      group.inventoryIds.push(inv.id);
    }

    // Filter: must have availability for ALL nights
    const results = [];
    for (const [key, group] of grouped.entries()) {
      if (group.count === nights && group.minAvailable > 0) {
        results.push({
          ...group,
          averageRate: group.totalRate / group.count,
        });
      }
    }

    return results;
  }

  /**
   * Sort unified results
   */
  private sortResults(
    results: UnifiedSearchResult[],
    sortBy: 'credits' | 'date' | 'relevance'
  ): UnifiedSearchResult[] {
    switch (sortBy) {
      case 'credits':
        return results.sort((a, b) => a.price.credits - b.price.credits);
      case 'date':
        return results.sort(
          (a, b) => a.dates.checkIn.getTime() - b.dates.checkIn.getTime()
        );
      case 'relevance':
        // Prioritize timeshare > hotels, then by credits
        return results.sort((a, b) => {
          if (a.source !== b.source) {
            return a.source === 'TIMESHARE' ? -1 : 1;
          }
          return a.price.credits - b.price.credits;
        });
      default:
        return results;
    }
  }

  /**
   * Calculate hotel credits needed
   * 
   * Formula: (cash_rate * nights) / credit_value_ratio
   * Default: 1 credit = 1 EUR
   */
  private calculateHotelCredits(dailyRate: number, nights: number): number {
    const CREDIT_TO_EUR_RATIO = 1; // 1:1 ratio
    return Math.ceil((dailyRate * nights) / CREDIT_TO_EUR_RATIO);
  }

  /**
   * Estimate room capacity from category name
   * 
   * TODO: Should be stored in database
   */
  private estimateCapacityFromCategory(category: string): number {
    const lower = category.toLowerCase();
    if (lower.includes('studio')) return 2;
    if (lower.includes('1br') || lower.includes('1 bed')) return 2;
    if (lower.includes('2br') || lower.includes('2 bed')) return 4;
    if (lower.includes('3br') || lower.includes('3 bed')) return 6;
    if (lower.includes('suite')) return 2;
    return 2; // Default
  }

  /**
   * Calculate nights between two dates
   */
  private calculateNights(startDate: Date, endDate: Date): number {
    return Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  /**
   * Parse JSON field (handles string or object)
   */
  private parseJSON(value: any): any {
    if (!value) return null;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    }
    return value;
  }
}
