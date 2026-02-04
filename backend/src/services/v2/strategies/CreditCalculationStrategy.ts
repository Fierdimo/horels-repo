/**
 * CreditCalculationStrategy - Strategy Pattern for Credit Calculations
 * 
 * Defines interfaces for different credit calculation strategies.
 * Used when releasing weeks to calculate how many credits to award.
 * 
 * Strategies:
 * - SeasonalCreditStrategy: Uses seasonal_factors from unit + timing decay
 * - FixedCreditStrategy: Fixed value per week (no decay)
 * - PromoStrategy: Special promotions with bonus multipliers
 * 
 * See: docs_v2/TIMESHARE_PLATFORM_V2_SPEC.md - Week Release Credits
 */

import { CreditService } from '../CreditService';

/**
 * Credit calculation result with breakdown
 */
export interface CreditCalculation {
  baseValue: number;
  seasonalMultiplier: number;
  timingMultiplier: number;
  bonusMultiplier?: number;
  daysInAdvance: number;
  finalCredits: number;
  breakdown: string; // Human-readable explanation
}

/**
 * Data needed for credit calculation
 */
export interface WeekReleaseData {
  weekNumber: number;
  startDate: Date;
  releaseDate: Date;
  unitId: number;
  seasonalFactors: Record<string, number>; // From timeshare_units.seasonal_factors JSON
  baseValue?: number; // Optional override
}

/**
 * Base strategy interface
 */
export interface CreditCalculationStrategy {
  /**
   * Calculate credits for a week release
   * @param data - Week release data
   * @returns Credit calculation with breakdown
   */
  calculate(data: WeekReleaseData): CreditCalculation;
}

/**
 * Seasonal Strategy (Default)
 * 
 * Uses seasonal_factors from timeshare_units + timing decay.
 * 
 * Formula:
 * credits = baseValue * seasonal_factor * timing_factor
 * 
 * Timing Decay:
 * - >180 days: 100%
 * - 90-180 days: 90%
 * - 30-90 days: 70%
 * - <30 days: 50%
 */
export class SeasonalCreditStrategy implements CreditCalculationStrategy {
  constructor(
    private creditService: CreditService,
    private defaultBaseValue: number = 1000
  ) {}

  calculate(data: WeekReleaseData): CreditCalculation {
    const baseValue = data.baseValue || this.defaultBaseValue;
    
    // Delegate to CreditService for actual calculation
    // (This keeps the calculation logic centralized)
    const calcResult = this.creditService.calculateWeekReleaseCredits(
      baseValue,
      data.weekNumber,
      data.seasonalFactors,
      data.releaseDate,
      data.startDate
    );

    const breakdown = this.buildBreakdown(calcResult);

    return {
      ...calcResult,
      breakdown,
    };
  }

  private buildBreakdown(result: {
    baseValue: number;
    seasonalMultiplier: number;
    timingMultiplier: number;
    daysInAdvance: number;
    finalCredits: number;
    bonusMultiplier?: number;
  }): string {
    const parts = [
      `Base: ${result.baseValue} credits`,
      `Season: ${result.seasonalMultiplier}x`,
      `Timing: ${result.timingMultiplier}x (${result.daysInAdvance} days advance)`,
    ];

    if (result.bonusMultiplier && result.bonusMultiplier !== 1.0) {
      parts.push(`Bonus: ${result.bonusMultiplier}x`);
    }

    parts.push(`= ${result.finalCredits} credits`);
    
    return parts.join(' → ');
  }
}

/**
 * Fixed Credit Strategy
 * 
 * Returns a fixed number of credits regardless of timing or season.
 * Used for special agreements or promotional weeks.
 */
export class FixedCreditStrategy implements CreditCalculationStrategy {
  constructor(private fixedAmount: number) {}

  calculate(data: WeekReleaseData): CreditCalculation {
    return {
      baseValue: this.fixedAmount,
      seasonalMultiplier: 1.0,
      timingMultiplier: 1.0,
      daysInAdvance: 0,
      finalCredits: this.fixedAmount,
      breakdown: `Fixed: ${this.fixedAmount} credits`,
    };
  }
}

/**
 * Promo Strategy
 * 
 * Applies a bonus multiplier on top of seasonal calculation.
 * Used for limited-time promotions (e.g., "Release early, get 20% bonus").
 */
export class PromoStrategy implements CreditCalculationStrategy {
  constructor(
    private baseStrategy: CreditCalculationStrategy,
    private bonusMultiplier: number,
    private promoName: string
  ) {}

  calculate(data: WeekReleaseData): CreditCalculation {
    const baseResult = this.baseStrategy.calculate(data);
    
    const finalCredits = Math.round(baseResult.finalCredits * this.bonusMultiplier);
    
    return {
      ...baseResult,
      bonusMultiplier: this.bonusMultiplier,
      finalCredits,
      breakdown: `${baseResult.breakdown} → ${this.promoName}: ${this.bonusMultiplier}x = ${finalCredits} credits`,
    };
  }
}

/**
 * Strategy Factory
 * 
 * Creates strategy instances based on configuration.
 */
export class CreditStrategyFactory {
  constructor(private creditService: CreditService) {}

  /**
   * Create strategy based on type
   */
  createStrategy(
    type: 'seasonal' | 'fixed' | 'promo',
    options?: {
      baseValue?: number;
      fixedAmount?: number;
      bonusMultiplier?: number;
      promoName?: string;
    }
  ): CreditCalculationStrategy {
    switch (type) {
      case 'seasonal':
        return new SeasonalCreditStrategy(
          this.creditService,
          options?.baseValue
        );
      
      case 'fixed':
        if (!options?.fixedAmount) {
          throw new Error('fixedAmount required for fixed strategy');
        }
        return new FixedCreditStrategy(options.fixedAmount);
      
      case 'promo':
        if (!options?.bonusMultiplier || !options?.promoName) {
          throw new Error('bonusMultiplier and promoName required for promo strategy');
        }
        const baseStrategy = new SeasonalCreditStrategy(
          this.creditService,
          options.baseValue
        );
        return new PromoStrategy(
          baseStrategy,
          options.bonusMultiplier,
          options.promoName
        );
      
      default:
        throw new Error(`Unknown strategy type: ${type}`);
    }
  }
}
