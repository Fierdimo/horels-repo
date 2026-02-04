import { Op } from 'sequelize';
import TimeshareAllocation from '../models/TimeshareAllocation';
import InventoryItem from '../models/InventoryItem';
import Property from '../models/Property';
import Room from '../models/room';
import { PMSFactory } from './pms/PMSFactory';

interface SearchFilters {
  location?: string;
  propertyId?: number;
  checkIn: Date;
  checkOut: Date;
  guests?: number;
  roomType?: string;
  minPrice?: number;
  maxPrice?: number;
  showAllOptions?: boolean; // Show both prepaid + PMS or only prepaid
}

interface SearchResult {
  id: string;
  source: 'TIMESHARE_PREPAID' | 'TIMESHARE_RELEASED' | 'HOTEL_PMS';
  priority: number;
  
  // Basic info
  propertyId: number;
  propertyName: string;
  location: string;
  roomType: string;
  roomNumber?: string;
  
  // Dates
  checkIn: Date;
  checkOut: Date;
  nights: number;
  
  // Pricing
  creditPrice?: number;
  cashPrice?: number;
  currency: string;
  
  // Availability
  isAvailable: boolean;
  
  // Internal metadata (for margin calculation, not shown to user)
  _internal: {
    source: 'TIMESHARE_PREPAID' | 'TIMESHARE_RELEASED' | 'HOTEL_PMS';
    priority: number;
    marginPercent: number;
    costToPlattform: number;
    allocationId?: number;
    inventoryItemId?: number;
    pmsResourceId?: string;
  };
}

class UnifiedSearchService {
  
  /**
   * Search available rooms with prepaid inventory prioritization
   */
  async search(filters: SearchFilters): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    
    // PRIORITY 1: Search in prepaid timeshare allocations (100% margin)
    const prepaidResults = await this.searchPrepaidAllocations(filters);
    results.push(...prepaidResults);
    
    // PRIORITY 2: Search in released timeshare inventory (already owned, just reassigned)
    const releasedResults = await this.searchReleasedInventory(filters);
    results.push(...releasedResults);
    
    // PRIORITY 3: Only if requested or insufficient prepaid inventory
    if (filters.showAllOptions || results.length < 5) {
      const pmsResults = await this.searchPMSInventory(filters);
      results.push(...pmsResults);
    }
    
    // Sort by priority (prepaid first, then by price)
    return results.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // Within same priority, sort by price
      const priceA = a.cashPrice || a.creditPrice || 0;
      const priceB = b.cashPrice || b.creditPrice || 0;
      return priceA - priceB;
    });
  }

  /**
   * PRIORITY 1: Search prepaid allocations (not yet released)
   */
  private async searchPrepaidAllocations(
    filters: SearchFilters
  ): Promise<SearchResult[]> {
    const where: any = {
      status: 'ACTIVE',
      is_released: false, // Not yet released to inventory
      current_week_owner_id: null, // Not assigned to any owner
      valid_from: { [Op.lte]: filters.checkIn },
      valid_until: { [Op.gte]: filters.checkOut },
    };

    if (filters.propertyId) {
      where.property_id = filters.propertyId;
    }

    if (filters.roomType) {
      where.room_type = filters.roomType;
    }

    const allocations = await TimeshareAllocation.findAll({
      where,
      include: [
        {
          model: Property,
          as: 'property',
          attributes: ['id', 'name', 'location', 'city', 'country'],
          ...(filters.location && {
            where: {
              [Op.or]: [
                { city: { [Op.like]: `%${filters.location}%` } },
                { country: { [Op.like]: `%${filters.location}%` } },
                { location: { [Op.like]: `%${filters.location}%` } },
              ],
            },
          }),
        },
      ],
    });

    // Verify availability with PMS
    const results: SearchResult[] = [];
    for (const allocation of allocations) {
      const isAvailable = await this.verifyPMSAvailability(
        allocation.property_id,
        allocation.pms_resource_id,
        filters.checkIn,
        filters.checkOut
      );

      if (isAvailable) {
        const nights = this.calculateNights(filters.checkIn, filters.checkOut);
        const property = (allocation as any).property;

        results.push({
          id: `prepaid-${allocation.id}`,
          source: 'TIMESHARE_PREPAID',
          priority: 1,
          
          propertyId: allocation.property_id,
          propertyName: property?.name || 'Unknown',
          location: property?.city || property?.location || '',
          roomType: allocation.room_type,
          roomNumber: allocation.room_number,
          
          checkIn: filters.checkIn,
          checkOut: filters.checkOut,
          nights,
          
          creditPrice: nights, // Simplified: 1 credit per night
          cashPrice: nights * 100, // Estimated cash price
          currency: allocation.currency,
          
          isAvailable: true,
          
          _internal: {
            source: 'TIMESHARE_PREPAID',
            priority: 1,
            marginPercent: 100, // 100% margin on prepaid
            costToPlattform: 0, // Zero marginal cost
            allocationId: allocation.id,
          },
        });
      }
    }

    return results;
  }

  /**
   * PRIORITY 2: Search released timeshare inventory
   */
  private async searchReleasedInventory(
    filters: SearchFilters
  ): Promise<SearchResult[]> {
    const where: any = {
      status: 'available',
      start_date: { [Op.lte]: filters.checkIn },
      end_date: { [Op.gte]: filters.checkOut },
    };

    if (filters.propertyId) {
      where.property_id = filters.propertyId;
    }

    if (filters.roomType) {
      where.accommodation_type = filters.roomType;
    }

    const items = await InventoryItem.findAll({
      where,
      include: [
        {
          model: Property,
          as: 'property',
          attributes: ['id', 'name', 'location', 'city', 'country'],
          ...(filters.location && {
            where: {
              [Op.or]: [
                { city: { [Op.like]: `%${filters.location}%` } },
                { country: { [Op.like]: `%${filters.location}%` } },
                { location: { [Op.like]: `%${filters.location}%` } },
              ],
            },
          }),
        },
      ],
    });

    const results: SearchResult[] = [];
    for (const item of items) {
      // Skip items with null dates
      if (!item.start_date || !item.end_date) {
        continue;
      }
      
      const property = (item as any).property;
      const nights = item.nights || this.calculateNights(item.start_date, item.end_date);

      results.push({
        id: `released-${item.id}`,
        source: 'TIMESHARE_RELEASED',
        priority: 2,
        
        propertyId: item.property_id,
        propertyName: property?.name || 'Unknown',
        location: property?.city || property?.location || '',
        roomType: item.accommodation_type || 'standard',
        
        checkIn: item.start_date,
        checkOut: item.end_date,
        nights,
        
        creditPrice: item.credit_price,
        cashPrice: undefined, // Credits only for now
        currency: 'EUR',
        
        isAvailable: true,
        
        _internal: {
          source: 'TIMESHARE_RELEASED',
          priority: 2,
          marginPercent: 100, // Already owned, just reassigned
          costToPlattform: 0,
          inventoryItemId: item.id,
        },
      });
    }

    return results;
  }

  /**
   * PRIORITY 3: Search PMS inventory (standard hotel rooms)
   */
  private async searchPMSInventory(
    filters: SearchFilters
  ): Promise<SearchResult[]> {
    // This would call the PMS API to get available rooms
    // For now, return empty array (to be implemented with actual PMS integration)
    
    const results: SearchResult[] = [];
    
    // TODO: Implement PMS search
    // const pmsAdapter = await PMSFactory.getAdapter(propertyId);
    // const availability = await pmsAdapter.getAvailability({
    //   checkIn: filters.checkIn,
    //   checkOut: filters.checkOut,
    //   guests: filters.guests,
    // });
    
    return results;
  }

  /**
   * Verify availability with PMS
   */
  private async verifyPMSAvailability(
    propertyId: number,
    resourceId: string,
    checkIn: Date,
    checkOut: Date
  ): Promise<boolean> {
    try {
      // TODO: Implement actual PMS availability check
      // For now, assume available
      return true;
    } catch (error) {
      console.error('Error verifying PMS availability:', error);
      return false;
    }
  }

  /**
   * Calculate number of nights
   */
  private calculateNights(checkIn: Date, checkOut: Date): number {
    const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  /**
   * Get priority label
   */
  getPriorityLabel(priority: number): string {
    switch (priority) {
      case 1:
        return 'Premium (Prepaid)';
      case 2:
        return 'Released Inventory';
      case 3:
        return 'Standard Hotel';
      default:
        return 'Unknown';
    }
  }

  /**
   * Calculate total cost breakdown
   */
  calculateCostBreakdown(result: SearchResult): {
    basePrice: number;
    taxes: number;
    fees: number;
    total: number;
    margin: number;
    marginPercent: number;
  } {
    const basePrice = result.cashPrice || 0;
    const taxes = basePrice * 0.1; // 10% tax estimate
    const fees = 0; // No platform fees for prepaid
    const total = basePrice + taxes + fees;
    
    const costToPlattform = result._internal.costToPlattform;
    const margin = total - costToPlattform;
    const marginPercent = result._internal.marginPercent;

    return {
      basePrice,
      taxes,
      fees,
      total,
      margin,
      marginPercent,
    };
  }
}

export default new UnifiedSearchService();
