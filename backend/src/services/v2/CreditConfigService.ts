import CreditSystemConfig from '../../models/v2/CreditSystemConfig';
import TimeshareUnit from '../../models/v2/TimeshareUnit';
import { Op } from 'sequelize';

/**
 * Credit Configuration Service
 * Handles admin configuration of credit system values
 */
class CreditConfigService {
  
  /**
   * Category patterns for auto-detection (same as CreditCalculationService)
   */
  private static readonly CATEGORY_PATTERNS: Array<{
    pattern: RegExp;
    roomType: string;
  }> = [
    { pattern: /penthouse|presidential|ático|atico/i, roomType: 'PRESIDENTIAL' },
    { pattern: /\b3\s*br\b|3\s*bed|three.*bed|suite.*3|3.*habitaciones/i, roomType: 'SUITE' },
    { pattern: /\b2\s*br\b|2\s*bed|two.*bed|deluxe.*2|2.*habitaciones/i, roomType: 'DELUXE' },
    { pattern: /\b1\s*br\b|1\s*bed|one.*bed|superior|1.*habitación/i, roomType: 'SUPERIOR' },
    { pattern: /studio|standard|básico|basico|estándar|estandar/i, roomType: 'STANDARD' }
  ];

  /**
   * Room type multipliers (defaults)
   */
  private static readonly ROOM_TYPE_MULTIPLIERS: Record<string, number> = {
    STANDARD: 1.0,
    SUPERIOR: 1.2,
    DELUXE: 1.5,
    SUITE: 2.0,
    PRESIDENTIAL: 2.5
  };

  /**
   * Auto-detect room type from unit category
   */
  private detectRoomTypeFromCategory(category: string): string {
    for (const { pattern, roomType } of CreditConfigService.CATEGORY_PATTERNS) {
      if (pattern.test(category)) {
        return roomType;
      }
    }
    return 'STANDARD';
  }

  /**
   * Get current configuration grouped by type
   */
  async getConfiguration(): Promise<{
    base_seasons: Record<string, number>;
    base_nightly: Record<string, number>;
    tier_multipliers: Record<string, number>;
    room_multipliers: Record<string, number>;
    other: Record<string, number>;
  }> {
    return await CreditSystemConfig.getAllGrouped();
  }

  /**
   * Update multiple configuration values
   */
  async updateConfiguration(
    updates: Record<string, number>,
    updatedBy: number
  ): Promise<{ updated: string[]; errors: string[] }> {
    return await CreditSystemConfig.bulkUpdate(updates, updatedBy);
  }

  /**
   * Auto-configure room type multipliers for units
   */
  async autoConfigureUnits(options: {
    propertyId?: number;
    dryRun?: boolean;
    overwriteManual?: boolean;
  }): Promise<{
    preview: Array<{
      unit_id: number;
      category: string;
      current_multiplier: number | null;
      detected_room_type: string;
      new_multiplier: number;
      action: 'SET' | 'SKIP' | 'OVERWRITE';
    }>;
    summary: {
      total_units: number;
      will_configure?: number;
      configured?: number;
      will_skip?: number;
      skipped?: number;
      errors: number;
    };
  }> {
    const { propertyId, dryRun = true, overwriteManual = false } = options;

    // Build query
    const where: any = { is_active: true };
    if (propertyId) {
      where.property_id = propertyId;
    }

    // Get all units
    const units = await TimeshareUnit.findAll({ where });

    const preview: Array<{
      unit_id: number;
      category: string;
      current_multiplier: number | null;
      detected_room_type: string;
      new_multiplier: number;
      action: 'SET' | 'SKIP' | 'OVERWRITE';
    }> = [];

    let configuredCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const unit of units) {
      try {
        const detectedType = this.detectRoomTypeFromCategory(unit.category);
        
        // Get multiplier from config or use default
        const newMultiplier = await CreditSystemConfig.getValue(
          `ROOM_${detectedType}`,
          CreditConfigService.ROOM_TYPE_MULTIPLIERS[detectedType]
        );

        const currentMultiplier = unit.room_type_multiplier;
        let action: 'SET' | 'SKIP' | 'OVERWRITE' = 'SET';

        // Determine action
        if (currentMultiplier !== null && currentMultiplier !== undefined) {
          if (overwriteManual) {
            action = 'OVERWRITE';
          } else {
            action = 'SKIP';
            skippedCount++;
          }
        } else {
          configuredCount++;
        }

        preview.push({
          unit_id: unit.id,
          category: unit.category,
          current_multiplier: currentMultiplier,
          detected_room_type: detectedType,
          new_multiplier: newMultiplier,
          action
        });

        // If not dry run and action is not SKIP, update the unit
        if (!dryRun && action !== 'SKIP') {
          await unit.update({ room_type_multiplier: newMultiplier });
        }
      } catch (error) {
        console.error(`Error processing unit ${unit.id}:`, error);
        errorCount++;
      }
    }

    const summary = {
      total_units: units.length,
      ...(dryRun ? {
        will_configure: configuredCount,
        will_skip: skippedCount
      } : {
        configured: configuredCount,
        skipped: skippedCount
      }),
      errors: errorCount
    };

    return { preview, summary };
  }

  /**
   * Get unit configuration preview (for individual unit edit)
   */
  async getUnitPreview(unitId: number): Promise<{
    unit_id: number;
    category: string;
    current_multiplier: number | null;
    detected_room_type: string;
    suggested_multiplier: number;
  }> {
    const unit = await TimeshareUnit.findByPk(unitId);
    if (!unit) {
      throw new Error(`Unit ${unitId} not found`);
    }

    const detectedType = this.detectRoomTypeFromCategory(unit.category);
    const suggestedMultiplier = await CreditSystemConfig.getValue(
      `ROOM_${detectedType}`,
      CreditConfigService.ROOM_TYPE_MULTIPLIERS[detectedType]
    );

    return {
      unit_id: unit.id,
      category: unit.category,
      current_multiplier: unit.room_type_multiplier,
      detected_room_type: detectedType,
      suggested_multiplier: suggestedMultiplier
    };
  }

  /**
   * Update individual unit multiplier
   */
  async updateUnitMultiplier(
    unitId: number,
    multiplier: number | null
  ): Promise<void> {
    const unit = await TimeshareUnit.findByPk(unitId);
    if (!unit) {
      throw new Error(`Unit ${unitId} not found`);
    }

    await unit.update({ room_type_multiplier: multiplier });
  }

  /**
   * Reset configuration to defaults
   */
  async resetToDefaults(updatedBy: number): Promise<void> {
    const defaults: Record<string, number> = {
      // Base seasons
      BASE_SEASON_RED: 1000,
      BASE_SEASON_WHITE: 600,
      BASE_SEASON_BLUE: 300,
      
      // Base nightly
      BASE_NIGHTLY_RED: 150,
      BASE_NIGHTLY_WHITE: 90,
      BASE_NIGHTLY_BLUE: 45,
      
      // Tiers
      TIER_DIAMOND: 1.5,
      TIER_GOLD: 1.3,
      TIER_SILVER_PLUS: 1.1,
      TIER_STANDARD: 1.0,
      
      // Room types
      ROOM_STANDARD: 1.0,
      ROOM_SUPERIOR: 1.2,
      ROOM_DELUXE: 1.5,
      ROOM_SUITE: 2.0,
      ROOM_PRESIDENTIAL: 2.5,
      
      // Other
      CREDIT_TO_EUR_RATE: 0.10
    };

    await CreditSystemConfig.bulkUpdate(defaults, updatedBy);
  }
}

export default new CreditConfigService();
