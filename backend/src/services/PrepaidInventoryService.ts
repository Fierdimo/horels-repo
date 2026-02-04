import { Transaction, Op } from 'sequelize';
import sequelize from '../config/database';
import TimeshareAllocation from '../models/TimeshareAllocation';
import Property from '../models/Property';
import User from '../models/User';
import Booking from '../models/Booking';
import { PMSFactory } from './pms/PMSFactory';

interface AllocationInput {
  property_id: number;
  pms_resource_id: string;
  pms_provider?: 'mews' | 'cloudbeds' | 'opera' | 'resnexus' | 'other' | 'none';
  room_number?: string;
  room_type: string;
  floor_number?: string;
  valid_from: Date;
  valid_until: Date;
  allocation_type: 'ANNUAL_CONTRACT' | 'PERPETUAL' | 'SEASONAL';
  prepaid_amount?: number;
  condominium_fee?: number;
  currency?: string;
  notes?: string;
  contract_reference?: string;
}

interface BulkImportResult {
  success: boolean;
  created: number;
  updated: number;
  errors: string[];
  allocations: TimeshareAllocation[];
}

interface AllocationStats {
  total: number;
  active: number;
  expired: number;
  suspended: number;
  expiring_soon: number;
  assigned: number;
  available: number;
  total_prepaid_amount: number;
  by_property: {
    property_id: number;
    property_name: string;
    count: number;
    occupied: number;
    available: number;
  }[];
}

class PrepaidInventoryService {
  
  /**
   * Create a new prepaid allocation
   */
  async createAllocation(
    data: AllocationInput,
    transaction?: Transaction
  ): Promise<TimeshareAllocation> {
    const tx = transaction || await sequelize.transaction();
    
    try {
      // 1. Validate property exists
      const property = await Property.findByPk(data.property_id, { transaction: tx });
      if (!property) {
        throw new Error(`Property ${data.property_id} not found`);
      }

      // 2. Set PMS provider from property if not specified
      const rawPmsProvider = data.pms_provider || property.pms_provider;
      // Convert 'none' to 'other' since TimeshareAllocation doesn't accept 'none'
      const pmsProvider: 'mews' | 'cloudbeds' | 'opera' | 'resnexus' | 'other' = 
        rawPmsProvider === 'none' ? 'other' : rawPmsProvider;

      // 3. Validate with PMS (verify resource exists)
      await this.validateWithPMS(
        data.property_id,
        data.pms_resource_id,
        pmsProvider,
        tx
      );

      // 4. Check for duplicates
      const existing = await TimeshareAllocation.findOne({
        where: {
          property_id: data.property_id,
          pms_resource_id: data.pms_resource_id,
          status: 'ACTIVE',
        },
        transaction: tx,
      });

      if (existing) {
        throw new Error(
          `Room ${data.pms_resource_id} is already in prepaid inventory`
        );
      }

      // 5. Validate dates
      if (data.valid_until <= data.valid_from) {
        throw new Error('valid_until must be after valid_from');
      }

      // 6. Check for PMS conflicts (existing bookings)
      const conflicts = await this.checkPMSConflicts(
        data.property_id,
        data.pms_resource_id,
        data.valid_from,
        data.valid_until,
        tx
      );

      if (conflicts > 0) {
        console.warn(
          `⚠️ Warning: Room has ${conflicts} existing bookings in the date range`
        );
      }

      // 7. Create allocation
      const allocationData: any = {
        ...data,
        pms_provider: pmsProvider,
        currency: data.currency || 'EUR',
        is_released: false,
        status: 'ACTIVE',
        last_sync_at: new Date(),
      };
      
      const allocation = await TimeshareAllocation.create(
        allocationData,
        { transaction: tx }
      );

      if (!transaction) {
        await tx.commit();
      }

      return allocation;
    } catch (error) {
      if (!transaction) {
        await tx.rollback();
      }
      throw error;
    }
  }

  /**
   * Update an existing allocation
   */
  async updateAllocation(
    id: number,
    data: Partial<AllocationInput>,
    transaction?: Transaction
  ): Promise<TimeshareAllocation> {
    const tx = transaction || await sequelize.transaction();
    
    try {
      const allocation = await TimeshareAllocation.findByPk(id, {
        transaction: tx,
        lock: true,
      });

      if (!allocation) {
        throw new Error(`Allocation ${id} not found`);
      }

      // Validate dates if changed
      const validFrom = data.valid_from || allocation.valid_from;
      const validUntil = data.valid_until || allocation.valid_until;

      if (validUntil <= validFrom) {
        throw new Error('valid_until must be after valid_from');
      }

      // Normalize pms_provider if provided
      const updateData: any = { ...data };
      if (updateData.pms_provider === 'none') {
        updateData.pms_provider = 'other';
      }

      await allocation.update(updateData, { transaction: tx });

      if (!transaction) {
        await tx.commit();
      }

      return allocation;
    } catch (error) {
      if (!transaction) {
        await tx.rollback();
      }
      throw error;
    }
  }

  /**
   * Soft delete an allocation
   */
  async deleteAllocation(
    id: number,
    transaction?: Transaction
  ): Promise<void> {
    const tx = transaction || await sequelize.transaction();
    
    try {
      const allocation = await TimeshareAllocation.findByPk(id, {
        transaction: tx,
        lock: true,
      });

      if (!allocation) {
        throw new Error(`Allocation ${id} not found`);
      }

      // Check if assigned to owner
      if (allocation.current_week_owner_id) {
        throw new Error(
          'Cannot delete: allocation is assigned to an owner. ' +
          'Release the assignment first.'
        );
      }

      // Check for active bookings
      const activeBookings = await this.getActiveBookingsCount(
        allocation.property_id,
        allocation.pms_resource_id,
        tx
      );

      if (activeBookings > 0) {
        throw new Error(
          `Cannot delete: ${activeBookings} active bookings exist for this room`
        );
      }

      // Soft delete
      await allocation.update({ status: 'DELETED' }, { transaction: tx });

      if (!transaction) {
        await tx.commit();
      }
    } catch (error) {
      if (!transaction) {
        await tx.rollback();
      }
      throw error;
    }
  }

  /**
   * Bulk import allocations from PMS
   */
  async bulkImportFromPMS(
    propertyId: number,
    resourceIds: string[],
    config: {
      valid_from: Date;
      valid_until: Date;
      allocation_type: 'ANNUAL_CONTRACT' | 'PERPETUAL' | 'SEASONAL';
      prepaid_amount?: number;
      condominium_fee?: number;
    }
  ): Promise<BulkImportResult> {
    const result: BulkImportResult = {
      success: false,
      created: 0,
      updated: 0,
      errors: [],
      allocations: [],
    };

    const property = await Property.findByPk(propertyId);
    if (!property) {
      result.errors.push(`Property ${propertyId} not found`);
      return result;
    }

    // Get PMS adapter
    const pmsAdapter = await PMSFactory.getAdapter(propertyId);

    for (const resourceId of resourceIds) {
      try {
        // Get resource details from PMS
        const resourceInfo = await this.getResourceInfoFromPMS(
          pmsAdapter,
          resourceId
        );

        // Check if already exists
        const existing = await TimeshareAllocation.findOne({
          where: {
            property_id: propertyId,
            pms_resource_id: resourceId,
            status: 'ACTIVE',
          },
        });

        if (existing) {
          // Update dates if different
          if (
            existing.valid_from.getTime() !== config.valid_from.getTime() ||
            existing.valid_until.getTime() !== config.valid_until.getTime()
          ) {
            await existing.update({
              valid_from: config.valid_from,
              valid_until: config.valid_until,
              last_sync_at: new Date(),
            });
            result.updated++;
          }
        } else {
          // Create new
          const normalizedProvider: 'mews' | 'cloudbeds' | 'opera' | 'resnexus' | 'other' = 
            property.pms_provider || 'other';
          
          const allocation = await this.createAllocation({
            property_id: propertyId,
            pms_resource_id: resourceId,
            pms_provider: normalizedProvider,
            room_number: resourceInfo.room_number,
            room_type: resourceInfo.room_type,
            floor_number: resourceInfo.floor_number,
            ...config,
          });
          result.allocations.push(allocation);
          result.created++;
        }
      } catch (error: any) {
        result.errors.push(`Resource ${resourceId}: ${error.message}`);
      }
    }

    result.success = result.errors.length === 0 || result.created + result.updated > 0;
    return result;
  }

  /**
   * Get allocation statistics
   */
  async getStats(propertyId?: number): Promise<AllocationStats> {
    const where: any = {};
    if (propertyId) {
      where.property_id = propertyId;
    }

    const allocations = await TimeshareAllocation.findAll({
      where,
      include: [
        {
          model: Property,
          as: 'property',
          attributes: ['id', 'name'],
        },
      ],
    });

    const now = new Date();
    const stats: AllocationStats = {
      total: allocations.length,
      active: 0,
      expired: 0,
      suspended: 0,
      expiring_soon: 0,
      assigned: 0,
      available: 0,
      total_prepaid_amount: 0,
      by_property: [],
    };

    const propertyMap = new Map();

    for (const allocation of allocations) {
      // Status counts
      if (allocation.status === 'ACTIVE') {
        stats.active++;
        if (allocation.valid_until < now) {
          stats.expired++;
        } else if (allocation.isExpiringSoon(30)) {
          stats.expiring_soon++;
        }
      } else if (allocation.status === 'EXPIRED') {
        stats.expired++;
      } else if (allocation.status === 'SUSPENDED') {
        stats.suspended++;
      }

      // Assignment counts
      if (allocation.current_week_owner_id) {
        stats.assigned++;
      } else if (allocation.is_released) {
        stats.available++;
      }

      // Financial
      if (allocation.prepaid_amount) {
        stats.total_prepaid_amount += Number(allocation.prepaid_amount);
      }

      // By property
      const propId = allocation.property_id;
      if (!propertyMap.has(propId)) {
        propertyMap.set(propId, {
          property_id: propId,
          property_name: (allocation as any).property?.name || 'Unknown',
          count: 0,
          occupied: 0,
          available: 0,
        });
      }
      const propStats = propertyMap.get(propId);
      propStats.count++;
      if (allocation.current_week_owner_id) {
        propStats.occupied++;
      } else if (allocation.is_released) {
        propStats.available++;
      }
    }

    stats.by_property = Array.from(propertyMap.values());

    return stats;
  }

  /**
   * Find available prepaid rooms for date range
   */
  async findAvailable(
    propertyId: number,
    checkIn: Date,
    checkOut: Date,
    roomType?: string
  ): Promise<TimeshareAllocation[]> {
    const where: any = {
      property_id: propertyId,
      status: 'ACTIVE',
      is_released: true,
      current_week_owner_id: null,
      valid_from: { [Op.lte]: checkIn },
      valid_until: { [Op.gte]: checkOut },
    };

    if (roomType) {
      where.room_type = roomType;
    }

    return await TimeshareAllocation.findAll({
      where,
      include: [
        {
          model: Property,
          as: 'property',
          attributes: ['id', 'name', 'location', 'city', 'country'],
        },
      ],
    });
  }

  /**
   * Validate allocation with PMS
   */
  private async validateWithPMS(
    propertyId: number,
    resourceId: string,
    pmsProvider: string,
    transaction?: Transaction
  ): Promise<boolean> {
    try {
      const pmsAdapter = await PMSFactory.getAdapter(propertyId);
      
      // Try to get resource info - if it fails, resource doesn't exist
      const resourceInfo = await this.getResourceInfoFromPMS(pmsAdapter, resourceId);
      
      return !!resourceInfo;
    } catch (error: any) {
      throw new Error(`PMS validation failed: ${error.message}`);
    }
  }

  /**
   * Get resource information from PMS
   */
  private async getResourceInfoFromPMS(
    pmsAdapter: any,
    resourceId: string
  ): Promise<{
    room_number?: string;
    room_type: string;
    floor_number?: string;
  }> {
    // This is adapter-specific - will need implementation per PMS
    // For now, return minimal data
    return {
      room_type: 'standard',
    };
  }

  /**
   * Check for PMS booking conflicts
   */
  private async checkPMSConflicts(
    propertyId: number,
    resourceId: string,
    validFrom: Date,
    validUntil: Date,
    transaction?: Transaction
  ): Promise<number> {
    // Check existing bookings in our system
    const bookings = await Booking.findAll({
      where: {
        property_id: propertyId,
        status: ['confirmed', 'checked_in'],
        check_in: { [Op.lt]: validUntil },
        check_out: { [Op.gt]: validFrom },
      },
      transaction,
    });

    return bookings.length;
  }

  /**
   * Get count of active bookings for a resource
   */
  private async getActiveBookingsCount(
    propertyId: number,
    resourceId: string,
    transaction?: Transaction
  ): Promise<number> {
    const now = new Date();
    const bookings = await Booking.findAll({
      where: {
        property_id: propertyId,
        status: ['confirmed', 'checked_in'],
        check_out: { [Op.gte]: now },
      },
      transaction,
    });

    return bookings.length;
  }
}

export default new PrepaidInventoryService();
