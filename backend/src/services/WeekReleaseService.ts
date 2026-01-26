import { Transaction } from 'sequelize';
import sequelize from '../config/database';
import Week from '../models/Week';
import InventoryService from './InventoryService';
import CreditCalculationService from './CreditCalculationService';
import CreditWalletService from './CreditWalletService';

interface ReleaseEstimate {
  weekId: number;
  estimatedCredits: number;
  breakdown: {
    seasonType: string;
    baseValue: number;
    tierMultiplier: number;
    locationMultiplier: number;
    roomTypeMultiplier: number;
    propertyName?: string;
    propertyTier?: string;
    roomType?: string;
  };
  propertyName: string;
  accommodationType: string;
  seasonType: string;
}

interface ReleaseResult {
  inventoryItemId: number;
  creditsEarned: number;
  walletBalance: number;
  breakdown: any;
  releasedAt: Date;
}

/**
 * WeekReleaseService
 * Handles the process of releasing weeks to the unified inventory pool
 * This is a wrapper that coordinates between existing CreditCalculationService,
 * CreditWalletService, and the new InventoryService
 */
class WeekReleaseService {

  /**
   * Estimate how many credits a week would earn if released
   * Does NOT actually release the week
   */
  async estimateReleaseValue(weekId: number): Promise<ReleaseEstimate> {
    const week = await Week.findByPk(weekId, {
      include: ['property']
    });

    if (!week) {
      throw new Error(`Week ${weekId} not found`);
    }

    // Use existing CreditCalculationService
    const calculation = await CreditCalculationService.calculateDepositCredits(weekId);

    return {
      weekId: week.id,
      estimatedCredits: calculation.credits,
      breakdown: calculation.breakdown,
      propertyName: (week as any).property?.name || 'Unknown Property',
      accommodationType: week.accommodation_type,
      seasonType: week.season_type
    };
  }

  /**
   * Release a week to inventory and earn credits
   * 
   * Process:
   * 1. Validate week is available
   * 2. Calculate credit value (using existing service)
   * 3. Add to inventory pool (new service)
   * 4. Credit owner's wallet (using existing service)
   * 5. Update week status
   */
  async releaseWeek(
    weekId: number,
    ownerId: number
  ): Promise<ReleaseResult> {
    return await sequelize.transaction(async (tx: Transaction) => {
      
      // 1. Get and validate week
      const week = await Week.findByPk(weekId, {
        lock: true,
        transaction: tx
      });

      if (!week) {
        throw new Error(`Week ${weekId} not found`);
      }

      if (week.owner_id !== ownerId) {
        throw new Error(`Not authorized to release week ${weekId}`);
      }

      if (week.status !== 'available') {
        throw new Error(`Week ${weekId} is not available for release (status: ${week.status})`);
      }

      // Check if week dates are in the future (if fixed week)
      if (week.start_date) {
        const now = new Date();
        if (week.start_date <= now) {
          throw new Error(`Cannot release week with past dates`);
        }
      }

      // Check if week is already deposited or in inventory
      const existingInventory = await InventoryService.getById(weekId);
      if (existingInventory) {
        throw new Error(`Week ${weekId} is already in inventory`);
      }

      // 2. Calculate credits (using existing CreditCalculationService)
      const calculation = await CreditCalculationService.calculateDepositCredits(weekId);
      const credits = calculation.credits;

      // 3. Add to inventory (new InventoryService)
      const inventoryItem = await InventoryService.addToInventory(
        weekId,
        credits,
        calculation.breakdown,
        tx
      );

      // 4. Credit owner's wallet (using existing CreditWalletService)
      // Note: We use a custom deposit since the week is now in inventory, not "consumed"
      const wallet = await CreditWalletService.deposit(
        ownerId,
        credits,
        'WEEK_RELEASE',
        `Released week #${weekId} to inventory`,
        tx,
        {
          weekId: weekId,
          inventoryItemId: inventoryItem.id,
          breakdown: calculation.breakdown
        }
      );

      // 5. Week status is already updated to 'converted' by InventoryService.addToInventory()

      return {
        inventoryItemId: inventoryItem.id,
        creditsEarned: credits,
        walletBalance: wallet.total_balance,
        breakdown: calculation.breakdown,
        releasedAt: inventoryItem.released_at
      };
    });
  }

  /**
   * Batch estimate for multiple weeks
   * Useful for UI displaying multiple weeks
   */
  async estimateMultipleWeeks(weekIds: number[]): Promise<ReleaseEstimate[]> {
    const estimates: ReleaseEstimate[] = [];

    for (const weekId of weekIds) {
      try {
        const estimate = await this.estimateReleaseValue(weekId);
        estimates.push(estimate);
      } catch (error) {
        // Skip weeks that fail validation
        console.error(`Failed to estimate week ${weekId}:`, error);
      }
    }

    return estimates;
  }

  /**
   * Get user's weeks that are eligible for release
   */
  async getEligibleWeeks(ownerId: number): Promise<Week[]> {
    const now = new Date();

    // Get weeks that:
    // - Belong to owner
    // - Status is 'available'
    // - Start date is in the future (for fixed weeks)
    // - Not already in inventory

    const weeks = await Week.findAll({
      where: {
        owner_id: ownerId,
        status: 'available'
      },
      include: ['property'],
      order: [['start_date', 'ASC']]
    });

    // Filter out:
    // - Weeks with past dates
    // - Weeks already in inventory
    const eligible: Week[] = [];

    for (const week of weeks) {
      // Check date validity
      if (week.start_date && week.start_date <= now) {
        continue; // Skip past weeks
      }

      // Check if already in inventory
      const inInventory = await InventoryService.getById(week.id);
      if (inInventory) {
        continue; // Skip weeks already in inventory
      }

      eligible.push(week);
    }

    return eligible;
  }

  /**
   * Validate if a week can be released
   */
  async canRelease(weekId: number, ownerId: number): Promise<{
    canRelease: boolean;
    reason?: string;
  }> {
    try {
      const week = await Week.findByPk(weekId);

      if (!week) {
        return { canRelease: false, reason: 'Week not found' };
      }

      if (week.owner_id !== ownerId) {
        return { canRelease: false, reason: 'Not authorized' };
      }

      if (week.status !== 'available') {
        return { canRelease: false, reason: `Week status is ${week.status}` };
      }

      if (week.start_date) {
        const now = new Date();
        if (week.start_date <= now) {
          return { canRelease: false, reason: 'Week dates are in the past' };
        }
      }

      // Check if already in inventory
      const inInventory = await InventoryService.getById(weekId);
      if (inInventory) {
        return { canRelease: false, reason: 'Week already in inventory' };
      }

      return { canRelease: true };

    } catch (error) {
      return { canRelease: false, reason: 'Validation error' };
    }
  }

  /**
   * Withdraw a week from inventory
   * Owner can take their week back if not sold/reserved
   */
  async withdrawFromInventory(
    inventoryItemId: number,
    ownerId: number
  ): Promise<{
    success: boolean;
    creditsRefunded?: number;
    message: string;
  }> {
    return await sequelize.transaction(async (tx: Transaction) => {
      
      // Withdraw from inventory
      const item = await InventoryService.withdraw(inventoryItemId, ownerId, tx);

      // Deduct credits from wallet (reverse the deposit)
      await CreditWalletService.deduct(
        ownerId,
        item.credit_price,
        'WEEK_WITHDRAWAL',
        `Withdrew week #${item.week_id} from inventory`,
        tx,
        {
          weekId: item.week_id,
          inventoryItemId: item.id
        }
      );

      return {
        success: true,
        creditsRefunded: item.credit_price,
        message: `Week withdrawn from inventory. ${item.credit_price} credits deducted.`
      };
    });
  }
}

export default new WeekReleaseService();
