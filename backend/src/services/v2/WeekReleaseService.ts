/**
 * WeekReleaseService - Business Logic for Week Release
 * 
 * Handles the process when an owner releases a week back to the marketplace.
 * 
 * Process:
 * 1. Validate ownership
 * 2. Calculate credits using strategy
 * 3. Update week status to RELEASED
 * 4. Store calculation in release_credit_calc (JSON)
 * 5. Credit account via CreditService
 * 6. Return result with new balance
 * 
 * See: docs_v2/TIMESHARE_PLATFORM_V2_SPEC.md - Week Release Flow
 * See: docs_v2/V2_DATABASE_SCHEMA.md - week_allocations.release_credit_calc
 */

import { Transaction as DbTransaction } from 'sequelize';
import sequelize from '../../config/database';
import { WeekAllocationRepository } from '../../repositories/v2/WeekAllocationRepository';
import { CreditService } from './CreditService';
import {
  CreditCalculationStrategy,
  CreditCalculation,
  SeasonalCreditStrategy,
} from './strategies/CreditCalculationStrategy';

export interface WeekReleaseResult {
  weekAllocationId: number;
  creditsAwarded: number;
  newBalance: number;
  calculation: CreditCalculation;
  status: 'RELEASED';
}

export interface WeekReleaseOptions {
  strategy?: CreditCalculationStrategy;
  notes?: string;
}

/**
 * WeekReleaseService
 * 
 * Coordinates week release process with credit calculation.
 */
export class WeekReleaseService {
  constructor(
    private weekRepo: WeekAllocationRepository,
    private creditService: CreditService,
    private defaultStrategy?: CreditCalculationStrategy
  ) {
    // Default to seasonal strategy if none provided
    if (!this.defaultStrategy) {
      this.defaultStrategy = new SeasonalCreditStrategy(creditService);
    }
  }

  /**
   * Release a week and award credits to owner
   * 
   * @param allocationId - Week allocation ID
   * @param ownerId - User ID of owner (for validation)
   * @param options - Release options (strategy, notes)
   * @returns Release result with credits awarded
   * 
   * @throws Error if week not found
   * @throws Error if ownership mismatch
   * @throws Error if week already released
   */
  async releaseWeek(
    allocationId: number,
    ownerId: number,
    options: WeekReleaseOptions = {}
  ): Promise<WeekReleaseResult> {
    const transaction = await sequelize.transaction();
    
    try {
      // 1. Fetch week with ownership and unit data
      const week = await this.weekRepo.findByIdWithOwnership(allocationId);
      
      if (!week) {
        throw new Error(`Week allocation ${allocationId} not found`);
      }

      // 2. Validate ownership
      if (!week.ownership) {
        throw new Error(`Week ${allocationId} has no ownership`);
      }
      
      if (week.ownership.owner_id !== ownerId) {
        throw new Error(
          `Week ${allocationId} does not belong to user ${ownerId}`
        );
      }

      // 3. Validate status (can't release if already released/booked)
      if (week.status === 'RELEASED') {
        throw new Error(`Week ${allocationId} is already released`);
      }

      if (week.status === 'BOOKED') {
        throw new Error(
          `Week ${allocationId} is currently booked and cannot be released`
        );
      }

      // 4. Calculate credits using strategy
      const strategy = options.strategy || this.defaultStrategy!;
      
      // Get base credit value and seasonal factors from unit
      const unit = (week.ownership as any).unit;
      const baseValue = unit?.base_credit_value 
        ? parseFloat(String(unit.base_credit_value))
        : undefined;
      
      // Parse seasonal factors if it's a JSON string
      let seasonalFactors: Record<string, number> = {};
      if (unit?.seasonal_factors) {
        try {
          seasonalFactors = typeof unit.seasonal_factors === 'string'
            ? JSON.parse(unit.seasonal_factors)
            : unit.seasonal_factors;
        } catch (e) {
          console.error('Failed to parse seasonal_factors:', e);
          seasonalFactors = {};
        }
      }
      
      const calculation = strategy.calculate({
        weekNumber: week.week_number || 0,
        startDate: new Date(week.start_date),
        releaseDate: new Date(),
        unitId: week.ownership.unit_id,
        seasonalFactors: seasonalFactors,
        baseValue: baseValue, // Pass the unit's base credit value
      });

      // 5. Update week status to RELEASED
      await this.weekRepo.update(
        allocationId,
        {
          status: 'RELEASED',
          release_credit_calc: calculation as any, // ✅ CORRECT: JSON field
        },
        { transaction } as any // Type workaround
      );

      // 6. Credit owner's account
      const creditResult = await this.creditService.addCredits(
        ownerId,
        {
          type: 'WEEK_RELEASE',
          amount: calculation.finalCredits,
          description: `Released week ${week.week_number} (${week.year})`,
          reference_type: 'week_allocation',
          reference_id: allocationId,
          metadata: {
            calculation,
            week_number: week.week_number,
            year: week.year,
            unit_id: week.ownership.unit_id,
            property_id: (week.ownership as any).unit?.property_id,
          },
        },
        transaction
      );

      await transaction.commit();

      // 7. Return result
      return {
        weekAllocationId: allocationId,
        creditsAwarded: calculation.finalCredits,
        newBalance: creditResult.balance_after,
        calculation,
        status: 'RELEASED',
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Cancel a week release (admin only)
   * 
   * Reverts the week to AVAILABLE and deducts the credits.
   * 
   * @param allocationId - Week allocation ID
   * @param adminId - Admin user ID
   * @param reason - Cancellation reason
   */
  async cancelRelease(
    allocationId: number,
    adminId: number,
    reason: string
  ): Promise<void> {
    const transaction = await sequelize.transaction();
    
    try {
      const week = await this.weekRepo.findByIdWithOwnership(allocationId);
      
      if (!week) {
        throw new Error(`Week allocation ${allocationId} not found`);
      }

      if (week.status !== 'RELEASED') {
        throw new Error(`Week ${allocationId} is not released`);
      }

      if (!week.release_credit_calc) {
        throw new Error(
          `Week ${allocationId} has no credit calculation to reverse`
        );
      }

      // Deduct the credits that were awarded
      const calc = week.release_credit_calc as any;
      const creditsToDeduct = calc.finalCredits;
      
      await this.creditService.deductCredits(
        week.ownership!.owner_id,
        {
          type: 'WEEK_BOOKING', // Use WEEK_BOOKING as deduction type
          amount: creditsToDeduct,
          description: `Release cancelled for week ${week.week_number} (${week.year}): ${reason}`,
          reference_type: 'week_allocation',
          reference_id: allocationId,
          metadata: {
            cancelled_by: adminId,
            reason,
            original_calculation: week.release_credit_calc,
          },
        },
        transaction
      );

      // Revert week to AVAILABLE
      await this.weekRepo.update(
        allocationId,
        {
          status: 'ASSIGNED',
          release_credit_calc: null,
        },
        { transaction } as any // Type workaround
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get release history for an owner
   * 
   * @param ownerId - User ID
   * @param limit - Max results
   * @param offset - Pagination offset
   * @returns Array of released weeks
   */
  async getReleaseHistory(
    ownerId: number,
    limit: number = 50,
    offset: number = 0
  ) {
    return this.weekRepo.findReleasedByOwner(ownerId, { limit, offset });
  }
}
