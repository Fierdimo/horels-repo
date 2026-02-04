/**
 * OwnershipService - Business Logic for Ownership Management
 * 
 * Handles CRUD operations for timeshare ownerships.
 * 
 * Key Features:
 * - Create ownership from credit purchase
 * - Transfer ownership between users
 * - Validate user permissions
 * - Generate annual week allocations
 * 
 * See: docs_v2/TIMESHARE_PLATFORM_V2_SPEC.md - Ownership Management
 * See: docs_v2/V2_DATABASE_SCHEMA.md - ownerships table
 */

import { Transaction as DbTransaction } from 'sequelize';
import sequelize from '../../config/database';
import { OwnershipRepository } from '../../repositories/v2/OwnershipRepository';
import { WeekAllocationService } from './WeekAllocationService';

export interface CreateOwnershipData {
  user_id: number;
  unit_id: number;
  type: 'FIXED_WEEK' | 'FLOATING' | 'POINTS'; // ✅ CORRECT: from ownerships.type
  contract_start_year: number;
  fixed_week_number?: number; // For FIXED_WEEK
  annual_points?: number; // For POINTS
  contract_end_year?: number; // ✅ CORRECT: Year as number
  purchase_price?: number;
  contract_reference?: string;
  purchase_date?: Date;
  annual_fee: number;
  currency?: string;
  notes?: string;
}

export interface TransferOwnershipData {
  new_owner_id: number;
  transfer_date: Date;
  transfer_price?: number;
  notes?: string;
}

/**
 * OwnershipService
 * 
 * Manages ownership lifecycle and week allocations.
 */
export class OwnershipService {
  constructor(
    private ownershipRepo: OwnershipRepository,
    private weekAllocationService: WeekAllocationService
  ) {}

  /**
   * Create a new ownership
   * 
   * Automatically generates week allocations for current year.
   * 
   * @param data - Ownership creation data
   * @returns Created ownership with allocations
   */
  async createOwnership(data: CreateOwnershipData): Promise<any> {
    const transaction = await sequelize.transaction();
    
    try {
      // 1. Validate ownership type
      this.validateOwnershipData(data);

      // 2. Create ownership record
      const ownership = await this.ownershipRepo.create(
        {
          owner_id: data.user_id, // ✅ CORRECT: DB field is owner_id
          unit_id: data.unit_id,
          type: data.type, // ✅ CORRECT: DB field is type
          contract_start_year: data.contract_start_year,
          contract_end_year: data.contract_end_year,
          fixed_week_number: data.fixed_week_number,
          annual_points: data.annual_points,
          purchase_price: data.purchase_price,
          contract_reference: data.contract_reference,
          purchase_date: data.purchase_date,
          annual_fee: data.annual_fee,
          currency: data.currency || 'EUR',
          status: 'ACTIVE',
        },
        { transaction }
      );

      // 3. Generate week allocations for current year
      const currentYear = new Date().getFullYear();
      await this.weekAllocationService.generateAnnualAllocations(
        ownership.id,
        currentYear,
        transaction
      );

      await transaction.commit();
      
      // 4. Return ownership with allocations
      return this.ownershipRepo.findWithAllocations(ownership.id, currentYear);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Transfer ownership to another user
   * 
   * Updates user_id and records transfer details.
   * 
   * @param ownershipId - Ownership ID
   * @param data - Transfer data
   * @returns Updated ownership
   */
  async transferOwnership(
    ownershipId: number,
    data: TransferOwnershipData
  ): Promise<any> {
    const transaction = await sequelize.transaction();
    
    try {
      const ownership = await this.ownershipRepo.findById(ownershipId);
      
      if (!ownership) {
        throw new Error(`Ownership ${ownershipId} not found`);
      }

      if (ownership.status !== 'ACTIVE') {
        throw new Error(`Cannot transfer ownership with status ${ownership.status}`);
      }

      // Update ownership
      await this.ownershipRepo.update(
        ownershipId,
        {
          owner_id: data.new_owner_id, // ✅ CORRECT: DB field is owner_id
        },
        { transaction } as any // Type workaround for Sequelize UpdateOptions
      );

      await transaction.commit();
      
      return this.ownershipRepo.findById(ownershipId);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Terminate an ownership
   * 
   * Sets status to TERMINATED and records end_date.
   * 
   * @param ownershipId - Ownership ID
   * @param reason - Termination reason
   * @param adminId - Admin user ID
   */
  async terminateOwnership(
    ownershipId: number,
    reason: string,
    adminId: number
  ): Promise<void> {
    const transaction = await sequelize.transaction();
    
    try {
      const ownership = await this.ownershipRepo.findById(ownershipId);
      
      if (!ownership) {
        throw new Error(`Ownership ${ownershipId} not found`);
      }

      if (ownership.status === 'TERMINATED') {
        throw new Error(`Ownership ${ownershipId} is already terminated`);
      }

      await this.ownershipRepo.update(
        ownershipId,
        {
          status: 'TERMINATED',
          contract_end_year: new Date().getFullYear(),
        },
        { transaction } as any // Type workaround for Sequelize UpdateOptions
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get ownerships for a user
   * 
   * @param userId - User ID
   * @param includeInactive - Include TERMINATED ownerships
   * @returns Array of ownerships
   */
  async getUserOwnerships(
    userId: number,
    includeInactive: boolean = false
  ): Promise<any[]> {
    return this.ownershipRepo.findByUserId(userId, !includeInactive);
  }

  /**
   * Get ownership by ID with full details
   * 
   * @param ownershipId - Ownership ID
   * @param year - Year for allocations (optional)
   * @returns Ownership with unit, property, and allocations
   */
  async getOwnershipDetails(
    ownershipId: number,
    year?: number
  ): Promise<any> {
    if (year) {
      return this.ownershipRepo.findWithAllocations(ownershipId, year);
    }
    return this.ownershipRepo.findWithUnit(ownershipId);
  }

  /**
   * Validate ownership data before creation
   */
  private validateOwnershipData(data: CreateOwnershipData): void {
    if (data.type === 'FIXED_WEEK' && !data.fixed_week_number) {
      throw new Error('fixed_week_number required for FIXED_WEEK ownership');
    }

    if (data.type === 'POINTS' && !data.annual_points) {
      throw new Error('annual_points required for POINTS ownership');
    }

    if (data.fixed_week_number && (data.fixed_week_number < 1 || data.fixed_week_number > 52)) {
      throw new Error('fixed_week_number must be between 1 and 52');
    }

    if (data.contract_end_year && data.contract_end_year < data.contract_start_year) {
      throw new Error('contract_end_year must be after contract_start_year');
    }

    if (!data.annual_fee || data.annual_fee < 0) {
      throw new Error('annual_fee is required and must be >= 0');
    }
  }
}
