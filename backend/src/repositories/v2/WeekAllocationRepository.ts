/**
 * WeekAllocation Repository (V2)
 * 
 * ⚠️ CRITICAL: This is the HOT TABLE repository
 * 
 * Most queried table in the system. All queries must use proper indexes.
 * Main use cases:
 * 1. Owner dashboard (show my weeks)
 * 2. Unified search (find released weeks)
 * 3. Booking creation (update week status)
 * 
 * See: docs_v2/DATABASE_DESIGN.md - Hot Table Optimization
 */

import { FindOptions, Op, Transaction } from 'sequelize';
import { BaseRepository } from './BaseRepository';
import WeekAllocation from '../../models/v2/WeekAllocation';
import Ownership from '../../models/v2/Ownership';
import TimeshareUnit from '../../models/v2/TimeshareUnit';
import TimeshareProperty from '../../models/v2/TimeshareProperty';

export interface WeekSearchFilters {
  propertyId?: number;
  checkIn?: Date;
  checkOut?: Date;
  status?: WeekAllocation['status'];
  year?: number;
  ownerId?: number;
}

export class WeekAllocationRepository extends BaseRepository<WeekAllocation> {
  constructor() {
    super(WeekAllocation);
  }
  
  /**
   * CRITICAL QUERY: Find released weeks for unified search
   * Uses idx_search_released (status, start_date, end_date)
   */
  async findReleasedWeeks(filters: WeekSearchFilters): Promise<WeekAllocation[]> {
    const where: any = {
      status: 'RELEASED', // INDEX: First field in idx_search_released
    };
    
    // Date range filtering (INDEX: Uses start_date, end_date from idx_search_released)
    if (filters.checkIn && filters.checkOut) {
      where.start_date = { [Op.lte]: filters.checkOut };
      where.end_date = { [Op.gte]: filters.checkIn };
    }
    
    return this.findAll({
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
              where: filters.propertyId ? { property_id: filters.propertyId } : undefined,
              include: [
                {
                  model: TimeshareProperty,
                  as: 'property',
                  required: true,
                  where: { is_active: true },
                },
              ],
            },
          ],
        },
      ],
      order: [['start_date', 'ASC']],
    });
  }
  
  /**
   * Find owner's weeks for specific year
   * Uses idx_owner_year (ownership_id, year)
   */
  async findOwnerWeeks(ownerId: number, year: number): Promise<WeekAllocation[]> {
    return this.findAll({
      include: [
        {
          model: Ownership,
          as: 'ownership',
          required: true,
          where: { owner_id: ownerId }, // FK to users
          include: [
            {
              model: TimeshareUnit,
              as: 'unit',
              include: [
                {
                  model: TimeshareProperty,
                  as: 'property',
                },
              ],
            },
          ],
        },
      ],
      where: { year },
      order: [['week_number', 'ASC']],
    });
  }
  
  /**
   * Release week: ASSIGNED → RELEASED
   * Must be called within transaction
   */
  async releaseWeek(
    allocationId: number,
    creditsIssued: number,
    creditCalc: object,
    transaction?: Transaction
  ): Promise<WeekAllocation | null> {
    const allocation = await this.findById(allocationId, { transaction });
    
    if (!allocation) {
      throw new Error('Week allocation not found');
    }
    
    if (allocation.status !== 'ASSIGNED' && allocation.status !== 'RESERVED') {
      throw new Error(`Cannot release week with status ${allocation.status}`);
    }
    
    await allocation.update(
      {
        status: 'RELEASED',
        released_at: new Date(),
        credits_issued: creditsIssued,
        release_credit_calc: creditCalc,
      },
      { transaction }
    );
    
    return allocation;
  }
  
  /**
   * Book week: RELEASED → BOOKED
   * Must be called within transaction
   */
  async bookWeek(
    allocationId: number,
    bookingId: number,
    bookedBy: number,
    transaction?: Transaction
  ): Promise<WeekAllocation | null> {
    const allocation = await this.findById(allocationId, { transaction });
    
    if (!allocation) {
      throw new Error('Week allocation not found');
    }
    
    if (allocation.status !== 'RELEASED') {
      throw new Error(`Cannot book week with status ${allocation.status}`);
    }
    
    await allocation.update(
      {
        status: 'BOOKED',
        booking_id: bookingId,
        booked_by: bookedBy,
        booked_at: new Date(),
      },
      { transaction }
    );
    
    return allocation;
  }
  
  /**
   * Mark week as USED after checkout
   */
  async markAsUsed(allocationId: number): Promise<WeekAllocation | null> {
    const allocation = await this.findById(allocationId);
    
    if (!allocation || allocation.status !== 'BOOKED') {
      return null;
    }
    
    await allocation.update({ status: 'USED' });
    return allocation;
  }
  
  /**
   * Generate annual week allocations for ownership
   * Bulk insert for performance
   */
  async generateAnnualAllocations(
    ownershipId: number,
    year: number,
    weeks: Array<{ weekNumber: number; startDate: Date; endDate: Date }>
  ): Promise<WeekAllocation[]> {
    const allocations = weeks.map(week => ({
      ownership_id: ownershipId,
      year,
      week_number: week.weekNumber,
      start_date: week.startDate,
      end_date: week.endDate,
      status: 'ASSIGNED' as const,
    }));
    
    return this.bulkCreate(allocations as any);
  }
  
  /**
   * Find expired weeks (past end_date, status still ASSIGNED/RELEASED)
   */
  async findExpired(): Promise<WeekAllocation[]> {
    return this.findAll({
      where: {
        end_date: { [Op.lt]: new Date() },
        status: {
          [Op.in]: ['ASSIGNED', 'RELEASED'],
        },
      },
    });
  }
  
  /**
   * Update PMS booking reference
   */
  async updatePMSReference(
    allocationId: number,
    pmsBookingId: string,
    pmsStatus?: string,
    physicalRoom?: string
  ): Promise<WeekAllocation | null> {
    return this.update(allocationId, {
      pms_booking_id: pmsBookingId,
      pms_booking_status: pmsStatus,
      physical_room_assigned: physicalRoom,
      pms_last_sync: new Date(),
    } as any);
  }
  
  /**
   * Count available weeks by property
   */
  async countAvailableByProperty(propertyId: number): Promise<number> {
    return this.count({
      where: { status: 'RELEASED' },
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
              where: { property_id: propertyId },
            },
          ],
        },
      ],
    });
  }

  /**
   * Find available weeks for search (with pagination)
   * Uses idx_released_available index
   */
  async findAvailableWeeks(filters: {
    start: Date;
    end: Date;
    limit?: number;
    offset?: number;
  }): Promise<WeekAllocation[]> {
    return this.findAll({
      where: {
        status: 'RELEASED',
        start_date: { [Op.gte]: filters.start },
        end_date: { [Op.lte]: filters.end },
      },
      order: [['start_date', 'ASC']],
      limit: filters.limit,
      offset: filters.offset,
    });
  }

  /**
   * Find weeks by ownership and year
   * Uses idx_ownership_year index
   */
  async findByOwnershipAndYear(ownershipId: number, year: number): Promise<WeekAllocation[]> {
    return this.findAll({
      where: {
        ownership_id: ownershipId,
        year,
      },
      order: [['week_number', 'ASC']],
    });
  }

  /**
   * Find conflicting weeks (overlapping date ranges)
   */
  async findConflictingWeeks(
    ownershipId: number,
    startDate: Date,
    endDate: Date,
    excludeId?: number
  ): Promise<WeekAllocation[]> {
    const where: any = {
      ownership_id: ownershipId,
      [Op.or]: [
        {
          // New range starts during existing range
          start_date: { [Op.lte]: startDate },
          end_date: { [Op.gt]: startDate },
        },
        {
          // New range ends during existing range
          start_date: { [Op.lt]: endDate },
          end_date: { [Op.gte]: endDate },
        },
        {
          // New range completely contains existing range
          start_date: { [Op.gte]: startDate },
          end_date: { [Op.lte]: endDate },
        },
      ],
    };

    if (excludeId) {
      where.id = { [Op.ne]: excludeId };
    }

    return this.findAll({ where });
  }

  /**
   * Update week status
   * Validates status transitions
   */
  async updateStatus(id: number, status: WeekAllocation['status']): Promise<WeekAllocation | null> {
    const allocation = await this.findById(id);
    
    if (!allocation) {
      return null;
    }

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      ASSIGNED: ['RESERVED', 'RELEASED', 'EXPIRED'],
      RESERVED: ['ASSIGNED', 'BOOKED', 'EXPIRED'],
      RELEASED: ['BOOKED', 'EXPIRED'],
      BOOKED: ['USED', 'RELEASED'], // Can cancel back to RELEASED
      USED: [],
      EXPIRED: [],
    };

    const currentStatus = allocation.status;
    if (!validTransitions[currentStatus]?.includes(status)) {
      throw new Error(`Invalid status transition: ${currentStatus} → ${status}`);
    }

    await allocation.update({ status });
    return allocation;
  }

  /**
   * Find week allocation by ID with ownership and unit data
   * Used by WeekReleaseService
   */
  async findByIdWithOwnership(allocationId: number): Promise<WeekAllocation | null> {
    return WeekAllocation.findByPk(allocationId, {
      include: [
        {
          model: Ownership,
          as: 'ownership',
          required: true,
          include: [
            {
              model: TimeshareUnit,
              as: 'unit',
              include: [
                {
                  model: TimeshareProperty,
                  as: 'property',
                },
              ],
            },
          ],
        },
      ],
    });
  }

  /**
   * Find released weeks by owner
   * Used for release history
   */
  async findReleasedByOwner(
    ownerId: number,
    options: { limit?: number; offset?: number } = {}
  ): Promise<WeekAllocation[]> {
    return WeekAllocation.findAll({
      where: { status: 'RELEASED' },
      include: [
        {
          model: Ownership,
          as: 'ownership',
          required: true,
          where: { user_id: ownerId },
          include: [
            {
              model: TimeshareUnit,
              as: 'unit',
              include: [
                {
                  model: TimeshareProperty,
                  as: 'property',
                },
              ],
            },
          ],
        },
      ],
      order: [['created_at', 'DESC']],
      limit: options.limit || 50,
      offset: options.offset || 0,
    });
  }
}

export default WeekAllocationRepository;
