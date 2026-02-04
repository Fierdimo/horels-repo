/**
 * WeekAllocationService - Business Logic for Week Allocation Management
 * 
 * Handles week allocation generation and management.
 * 
 * Key Features:
 * - Generate annual week allocations for ownerships
 * - Assign specific weeks to owners
 * - Handle week expiration
 * - Calculate week dates from week numbers
 * 
 * See: docs_v2/TIMESHARE_PLATFORM_V2_SPEC.md - Week Allocation
 * See: docs_v2/V2_DATABASE_SCHEMA.md - week_allocations table
 */

import { Transaction as DbTransaction } from 'sequelize';
import { WeekAllocationRepository } from '../../repositories/v2/WeekAllocationRepository';
import { OwnershipRepository } from '../../repositories/v2/OwnershipRepository';

export interface GenerateAllocationsOptions {
  specificWeeks?: number[]; // If provided, only generate these week numbers
  startWeek?: number; // Start from this week number (default: 1)
  endWeek?: number; // End at this week number (default: 52)
}

/**
 * WeekAllocationService
 * 
 * Manages week allocation lifecycle.
 */
export class WeekAllocationService {
  constructor(
    private weekRepo: WeekAllocationRepository,
    private ownershipRepo: OwnershipRepository
  ) {}

  /**
   * Generate annual week allocations for an ownership
   * 
   * Creates week_allocations records for each week the owner is entitled to.
   * 
   * For FIXED_WEEK: Uses fixed_week_number field (single week)
   * For FLOATING: No automatic allocations (owner selects from available weeks)
   * For POINTS: No automatic allocations (points-based booking)
   * 
   * @param ownershipId - Ownership ID
   * @param year - Year to generate allocations for
   * @param transaction - Optional database transaction
   * @returns Array of created allocations
   */
  async generateAnnualAllocations(
    ownershipId: number,
    year: number,
    transaction?: DbTransaction
  ): Promise<any[]> {
    // 1. Fetch ownership with unit data
    const ownership = await this.ownershipRepo.findWithUnit(ownershipId, transaction);
    
    if (!ownership) {
      throw new Error(`Ownership ${ownershipId} not found`);
    }

    if (ownership.status !== 'ACTIVE') {
      throw new Error(`Cannot generate allocations for ${ownership.status} ownership`);
    }

    // 2. Determine weeks to allocate
    let weeksToAllocate: number[] = [];

    switch (ownership.type) {
      case 'FIXED_WEEK':
        // Fixed week: only allocate the specified week
        if (!ownership.fixed_week_number) {
          throw new Error('fixed_week_number not set for FIXED_WEEK ownership');
        }
        weeksToAllocate = [ownership.fixed_week_number];
        break;

      case 'FLOATING':
        // Floating: owner can choose any available week (no automatic allocation)
        // This requires manual selection by owner
        return [];

      case 'POINTS':
        // Points-based: no automatic allocations (book using points)
        return [];

      default:
        throw new Error(`Unknown ownership type: ${ownership.type}`);
    }

    // 3. Create week allocations
    const allocations = [];
    
    for (const weekNumber of weeksToAllocate) {
      const { start_date, end_date } = this.calculateWeekDates(year, weekNumber);
      
      const allocation = await this.weekRepo.create(
        {
          ownership_id: ownershipId,
          year,
          week_number: weekNumber,
          start_date,
          end_date,
          status: 'ASSIGNED', // ✅ CORRECT: Initial status for new allocations
        },
        { transaction } // ✅ CORRECT: Pass transaction in options
      );
      
      allocations.push(allocation);
    }

    return allocations;
  }

  /**
   * Generate allocations for specific weeks only
   * 
   * Used when owner purchases additional weeks or for custom allocations.
   * 
   * @param ownershipId - Ownership ID
   * @param year - Year
   * @param weekNumbers - Array of week numbers to allocate
   * @param transaction - Optional database transaction
   */
  async generateSpecificWeeks(
    ownershipId: number,
    year: number,
    weekNumbers: number[],
    transaction?: DbTransaction
  ): Promise<any[]> {
    const ownership = await this.ownershipRepo.findById(ownershipId);
    
    if (!ownership) {
      throw new Error(`Ownership ${ownershipId} not found`);
    }

    const allocations = [];
    
    for (const weekNumber of weekNumbers) {
      if (weekNumber < 1 || weekNumber > 52) {
        throw new Error(`Invalid week number: ${weekNumber} (must be 1-52)`);
      }

      // Check if week already allocated
      const existing = await this.weekRepo.findOne({
        where: { ownership_id: ownershipId, year, week_number: weekNumber },
      });

      if (existing) {
        throw new Error(
          `Week ${weekNumber} already allocated for ownership ${ownershipId} in ${year}`
        );
      }

      const { start_date, end_date } = this.calculateWeekDates(year, weekNumber);
      
      const allocation = await this.weekRepo.create(
        {
          ownership_id: ownershipId,
          year,
          week_number: weekNumber,
          start_date,
          end_date,
          status: 'ASSIGNED',
        },
        { transaction } // ✅ CORRECT: Pass transaction in options
      );
      
      allocations.push(allocation);
    }

    return allocations;
  }

  /**
   * Expire allocations that are past their week dates
   * 
   * Should be run as a scheduled job (cron).
   * 
   * @param cutoffDate - Weeks before this date will be expired
   * @returns Number of weeks expired
   */
  async expireOldAllocations(cutoffDate: Date = new Date()): Promise<number> {
    // Find all ASSIGNED or RELEASED weeks where end_date < cutoffDate
    const oldWeeks = await this.weekRepo.findAll({
      where: {
        status: ['ASSIGNED', 'RELEASED'],
        end_date: { $lt: cutoffDate },
      },
    });

    let expiredCount = 0;

    for (const week of oldWeeks) {
      await this.weekRepo.updateStatus(week.id, 'EXPIRED');
      expiredCount++;
    }

    return expiredCount;
  }

  /**
   * Calculate start and end dates for a week number in a year
   * 
   * Uses ISO 8601 week numbering:
   * - Week 1 is the first week with a Thursday
   * - Weeks start on Monday
   * 
   * @param year - Year
   * @param weekNumber - Week number (1-52)
   * @returns Object with start_date and end_date
   */
  private calculateWeekDates(
    year: number,
    weekNumber: number
  ): { start_date: Date; end_date: Date } {
    if (weekNumber < 1 || weekNumber > 52) {
      throw new Error(`Invalid week number: ${weekNumber} (must be 1-52)`);
    }

    // Find the first Monday of the year
    const jan1 = new Date(year, 0, 1);
    const dayOfWeek = jan1.getDay(); // 0 = Sunday, 1 = Monday, ...
    
    // Calculate days to add to get to first Monday
    const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7;
    const firstMonday = new Date(year, 0, 1 + daysToMonday);

    // Calculate start date (Monday of the specified week)
    const start_date = new Date(firstMonday);
    start_date.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);

    // Calculate end date (Sunday, 6 days later)
    const end_date = new Date(start_date);
    end_date.setDate(start_date.getDate() + 6);

    return { start_date, end_date };
  }

  /**
   * Get allocations for an ownership in a specific year
   * 
   * @param ownershipId - Ownership ID
   * @param year - Year
   * @returns Array of allocations
   */
  async getOwnershipAllocations(
    ownershipId: number,
    year: number
  ): Promise<any[]> {
    return this.weekRepo.findAll({
      where: { ownership_id: ownershipId, year },
      order: [['week_number', 'ASC']],
    });
  }

  /**
   * Get available weeks for booking
   * 
   * @param year - Year
   * @param propertyId - Optional property filter
   * @returns Array of available weeks
   */
  async getAvailableWeeks(
    year: number,
    propertyId?: number
  ): Promise<any[]> {
    // Calculate date range for the year
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    
    return this.weekRepo.findAvailableWeeks({ start, end });
  }
}
