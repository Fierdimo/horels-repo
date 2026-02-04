/**
 * Week Release Controller (V2)
 * 
 * Handles week release operations for owners:
 * - Release week to marketplace
 * - View my weeks
 * - Get release preview (calculate credits before releasing)
 * 
 * See: docs_v2/TIMESHARE_PLATFORM_V2_SPEC.md - API Specification
 */

import { Request, Response } from 'express';
import { WeekReleaseService } from '../../services/v2/WeekReleaseService';
import { WeekAllocationRepository } from '../../repositories/v2/WeekAllocationRepository';
import { OwnershipRepository } from '../../repositories/v2/OwnershipRepository';
import { CreditService } from '../../services/v2/CreditService';
import { CreditAccountRepository } from '../../repositories/v2/CreditAccountRepository';
import { CreditTransactionRepository } from '../../repositories/v2/CreditTransactionRepository';
import { SeasonalCreditStrategy } from '../../services/v2/strategies/CreditCalculationStrategy';
import WeekAllocation from '../../models/v2/WeekAllocation';
import Ownership from '../../models/v2/Ownership';
import TimeshareUnit from '../../models/v2/TimeshareUnit';
import TimeshareProperty from '../../models/v2/TimeshareProperty';

// Auth middleware adds user to request
type AuthRequest = Request & {
  user?: {
    id: number;
    email: string;
    role?: string;
  };
};

export class WeekReleaseController {
  /**
   * POST /api/v2/weeks/release
   * Release a week to the marketplace and earn credits
   */
  static async releaseWeek(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const { allocationId, confirmDecay } = req.body;

      // Validation
      if (!allocationId) {
        res.status(400).json({ success: false, error: 'allocationId is required' });
        return;
      }

      if (confirmDecay !== true) {
        res.status(400).json({ 
          success: false, 
          error: 'You must confirm credit decay by setting confirmDecay=true' 
        });
        return;
      }

      // Initialize services
      const weekRepo = new WeekAllocationRepository();
      const accountRepo = new CreditAccountRepository();
      const transactionRepo = new CreditTransactionRepository();

      const creditService = new CreditService(accountRepo, transactionRepo);
      const creditStrategy = new SeasonalCreditStrategy(creditService);
      const releaseService = new WeekReleaseService(
        weekRepo,
        creditService,
        creditStrategy
      );

      // Release week
      const result = await releaseService.releaseWeek(allocationId, userId);

      res.status(200).json({
        success: true,
        data: {
          allocationId: result.weekAllocationId,
          previousStatus: 'ASSIGNED', // We know this from validation
          newStatus: result.status,
          credits: {
            baseValue: result.calculation.baseValue,
            seasonalMultiplier: result.calculation.seasonalMultiplier,
            timingMultiplier: result.calculation.timingMultiplier,
            finalCredits: result.calculation.finalCredits,
            creditsIssued: result.creditsAwarded,
            breakdown: result.calculation.breakdown,
          },
          newBalance: result.newBalance,
          pmsBookingCancelled: false, // TODO: Implement PMS cancellation in Phase 6
        },
      });
    } catch (error: any) {
      console.error('Error releasing week:', error);
      
      // Handle specific errors
      if (error.message.includes('not found')) {
        res.status(404).json({ success: false, error: error.message });
        return;
      }
      
      if (error.message.includes('does not own') || error.message.includes('Cannot release')) {
        res.status(403).json({ success: false, error: error.message });
        return;
      }

      res.status(500).json({ 
        success: false, 
        error: 'Failed to release week',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * GET /api/v2/weeks/my-weeks
   * Get all weeks for the authenticated owner
   */
  static async getMyWeeks(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const year = parseInt(req.query.year as string) || new Date().getFullYear();

      // Get user's ownerships
      const ownershipRepo = new OwnershipRepository();
      const ownerships = await ownershipRepo.findByUserId(userId, true); // activeOnly

      if (ownerships.length === 0) {
        res.status(200).json({ success: true, data: [] });
        return;
      }

      // Get allocations for each ownership
      const weekRepo = new WeekAllocationRepository();
      const allWeeks = [];

      for (const ownership of ownerships) {
        const weeks = await weekRepo.findAll({
          where: { ownership_id: ownership.id, year },
          include: [
            {
              model: Ownership,
              as: 'ownership',
              include: [
                {
                  model: TimeshareUnit,
                  as: 'unit',
                },
              ],
            },
          ],
          order: [['start_date', 'ASC']],
        });

        allWeeks.push(...weeks);
      }

      // Format response
      const formattedWeeks = allWeeks.map((week: any) => ({
        allocationId: week.id,
        ownershipId: week.ownership_id,
        year: week.year,
        weekNumber: week.week_number,
        startDate: week.start_date,
        endDate: week.end_date,
        status: week.status,
        unit: {
          id: week.ownership?.unit?.id,
          category: week.ownership?.unit?.category,
          capacity: week.ownership?.unit?.capacity,
          property: week.ownership?.unit?.property_id,
        },
        releasedAt: week.released_at,
        creditsIssued: week.credits_issued,
        actions: WeekReleaseController.getAvailableActions(week.status),
      }));

      res.status(200).json({
        success: true,
        data: formattedWeeks,
        meta: {
          year,
          totalWeeks: formattedWeeks.length,
          byStatus: WeekReleaseController.countByStatus(formattedWeeks),
        },
      });
    } catch (error: any) {
      console.error('Error fetching my weeks:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch weeks',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * POST /api/v2/weeks/:id/preview-release
   * Preview credit calculation before releasing
   */
  static async previewRelease(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const allocationId = parseInt(req.params.id);

      // Get week with ownership
      const weekRepo = new WeekAllocationRepository();
      const week = await weekRepo.findByIdWithOwnership(allocationId);

      if (!week) {
        res.status(404).json({ success: false, error: 'Week allocation not found' });
        return;
      }

      // Verify ownership
      if ((week.ownership as any).owner_id !== userId) {
        res.status(403).json({ success: false, error: 'You do not own this week' });
        return;
      }

      // Verify status
      if (week.status !== 'ASSIGNED') {
        res.status(400).json({ 
          success: false, 
          error: `Cannot release week with status ${week.status}` 
        });
        return;
      }

      // Calculate credits (preview only)
      const accountRepo = new CreditAccountRepository();
      const transactionRepo = new CreditTransactionRepository();
      const creditService = new CreditService(accountRepo, transactionRepo);
      const creditStrategy = new SeasonalCreditStrategy(creditService);
      
      // Get unit for seasonal factors
      const unit = await TimeshareUnit.findByPk((week.ownership as any).unit_id);
      if (!unit) {
        res.status(404).json({ success: false, error: 'Unit not found' });
        return;
      }

      if (!week.week_number) {
        res.status(400).json({ success: false, error: 'Week number not set' });
        return;
      }

      // Parse seasonal factors from JSON string
      let seasonalFactors: Record<string, number> = {};
      if (unit.seasonal_factors) {
        try {
          console.log('Raw seasonal_factors:', unit.seasonal_factors);
          seasonalFactors = typeof unit.seasonal_factors === 'string' 
            ? JSON.parse(unit.seasonal_factors)
            : unit.seasonal_factors;
          console.log('Parsed seasonal_factors:', seasonalFactors);
        } catch (error) {
          console.error('Failed to parse seasonal_factors:', error);
        }
      }
      
      console.log('Using seasonalFactors:', seasonalFactors);
      console.log('Week number:', week.week_number);
      console.log('Base credit value:', unit.base_credit_value);

      const calculation = creditStrategy.calculate({
        weekNumber: week.week_number,
        startDate: new Date(week.start_date),
        releaseDate: new Date(),
        unitId: unit.id as number,
        seasonalFactors,
        baseValue: (unit.base_credit_value as number | undefined) ?? undefined,
      });

      console.log('Calculation result:', calculation);

      // Calculate expiration date (6 months from now)
      const expirationDate = new Date();
      expirationDate.setMonth(expirationDate.getMonth() + 6);

      // Get property info
      const property = await TimeshareProperty.findByPk(unit.property_id);

      const responseData = {
        estimatedCredits: Math.round(calculation.finalCredits),
        expirationDate: expirationDate.toISOString(),
        breakdown: {
          baseSeason: Number(calculation.baseValue),
          tierMultiplier: Number(calculation.seasonalMultiplier),
          roomMultiplier: 1.0,
          locationMultiplier: Number(calculation.timingMultiplier),
        },
        weekInfo: {
          year: week.year,
          weekNumber: week.week_number,
          startDate: week.start_date,
          endDate: week.end_date,
          propertyName: property?.name || 'Unknown Property',
          unitName: unit.category || 'Unknown Unit',
        },
      };

      console.log('Response data:', JSON.stringify(responseData, null, 2));

      res.status(200).json({
        success: true,
        data: responseData,
      });
    } catch (error: any) {
      console.error('Error previewing release:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to preview release',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Helper: Get available actions for a week based on status
   */
  private static getAvailableActions(status: string): string[] {
    switch (status) {
      case 'ASSIGNED':
        return ['release', 'reserve'];
      case 'RELEASED':
        return []; // Owner can't do anything once released
      case 'RESERVED':
        return ['cancel-reservation'];
      case 'BOOKED':
        return []; // Booked by someone else
      case 'USED':
      case 'EXPIRED':
        return [];
      default:
        return [];
    }
  }

  /**
   * Helper: Count weeks by status
   */
  private static countByStatus(weeks: any[]): Record<string, number> {
    return weeks.reduce((acc, week) => {
      acc[week.status] = (acc[week.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}
