/**
 * OwnershipRepository - Data Access Layer for Ownerships
 * 
 * Handles database operations for timeshare ownerships.
 * 
 * See: docs_v2/V2_DATABASE_SCHEMA.md - ownerships table
 * See: src/models/v2/Ownership.ts
 */

import { Transaction } from 'sequelize';
import Ownership from '../../models/v2/Ownership';
import TimeshareUnit from '../../models/v2/TimeshareUnit';
import TimeshareProperty from '../../models/v2/TimeshareProperty';
import WeekAllocation from '../../models/v2/WeekAllocation';
import BaseRepository from './BaseRepository';

/**
 * OwnershipRepository
 * 
 * CRUD operations for ownerships with common queries.
 */
export class OwnershipRepository extends BaseRepository<Ownership> {
  constructor() {
    super(Ownership);
  }

  /**
   * Find ownership by ID with unit details
   */
  async findWithUnit(ownershipId: number, transaction?: any): Promise<Ownership | null> {
    return Ownership.findByPk(ownershipId, {
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
      transaction
    });
  }

  /**
   * Find ownership with week allocations for a year
   */
  async findWithAllocations(
    ownershipId: number,
    year: number
  ): Promise<Ownership | null> {
    return Ownership.findByPk(ownershipId, {
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
        {
          model: WeekAllocation,
          as: 'weekAllocations',
          where: { year },
          required: false,
        },
      ],
    });
  }

  /**
   * Find all ownerships for a user
   * 
   * @param userId - User ID (owner_id)
   * @param activeOnly - Only return ACTIVE ownerships
   */
  async findByUserId(
    userId: number,
    activeOnly: boolean = true
  ): Promise<Ownership[]> {
    const where: any = { owner_id: userId };
    
    if (activeOnly) {
      where.status = 'ACTIVE';
    }

    return Ownership.findAll({
      where,
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
      order: [['created_at', 'DESC']],
    });
  }

  /**
   * Find all ownerships for a unit
   * 
   * @param unitId - Unit ID
   * @param activeOnly - Only return ACTIVE ownerships
   */
  async findByUnitId(
    unitId: number,
    activeOnly: boolean = true
  ): Promise<Ownership[]> {
    const where: any = { unit_id: unitId };
    
    if (activeOnly) {
      where.status = 'ACTIVE';
    }

    return Ownership.findAll({
      where,
      order: [['created_at', 'DESC']],
    });
  }

  /**
   * Check if a user owns a specific unit
   */
  async userOwnsUnit(userId: number, unitId: number): Promise<boolean> {
    const ownership = await Ownership.findOne({
      where: {
        owner_id: userId,
        unit_id: unitId,
        status: 'ACTIVE',
      },
    });

    return !!ownership;
  }

  /**
   * Get total number of ownerships for a user
   */
  async countByUserId(userId: number, activeOnly: boolean = true): Promise<number> {
    const where: any = { owner_id: userId };
    
    if (activeOnly) {
      where.status = 'ACTIVE';
    }

    return Ownership.count({ where });
  }
}

export default OwnershipRepository;
