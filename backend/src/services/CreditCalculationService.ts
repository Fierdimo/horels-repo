import CreditBookingCost from '../models/CreditBookingCost';
import PlatformSetting from '../models/PlatformSetting';
import Week from '../models/Week';
import Property from '../models/Property';
import SeasonalCalendar from '../models/SeasonalCalendar';
import CreditSystemConfig from '../models/v2/CreditSystemConfig';
import TimeshareUnit from '../models/v2/TimeshareUnit';
import TimeshareProperty from '../models/v2/TimeshareProperty';

/**
 * Credit Calculation Service - Master Formula Implementation
 * 
 * Implements the comprehensive credit valuation system:
 * - Deposit: Base_Season_Value × Tier_Multiplier × Location_Multiplier × Unit_Size_Multiplier
 * - Booking: Nightly_Cost = Base_Rate × Room_Type_Multiplier × Tier_Multiplier × Location_Multiplier
 */
class CreditCalculationService {
  
  /**
   * Configuration cache and expiry
   */
  private static configCache: Map<string, number> = new Map();
  private static cacheExpiry: Date | null = null;
  private static readonly CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Check if cache is still valid
   */
  private isCacheValid(): boolean {
    if (!CreditCalculationService.cacheExpiry) return false;
    return new Date() < CreditCalculationService.cacheExpiry;
  }

  /**
   * Get configuration value from DB with cache and fallback
   */
  private async getConfigValue(key: string, fallback: number): Promise<number> {
    // 1. Check cache first
    if (this.isCacheValid()) {
      const cached = CreditCalculationService.configCache.get(key);
      if (cached !== undefined) return cached;
    }

    // 2. Try to fetch from database
    try {
      const value = await CreditSystemConfig.getValue(key, fallback);
      
      // Update cache
      CreditCalculationService.configCache.set(key, value);
      if (!CreditCalculationService.cacheExpiry) {
        CreditCalculationService.cacheExpiry = new Date(Date.now() + CreditCalculationService.CACHE_DURATION_MS);
      }
      
      return value;
    } catch (error) {
      console.warn(`Error fetching config ${key}, using fallback:`, error);
      return fallback;
    }
  }

  /**
   * Clear configuration cache (useful after updates)
   */
  public static clearCache(): void {
    CreditCalculationService.configCache.clear();
    CreditCalculationService.cacheExpiry = null;
  }
  
  /**
   * Credit to EUR conversion rate (hardcoded - to be made configurable by admin)
   * Represents the EUR value of 1 credit for hybrid payment calculations
   */
  public static readonly CREDIT_TO_EUR_RATE = 0.10; // €0.10 per credit
  
  /**
   * Base season values for DEPOSITS (weekly value)
   */
  private static readonly BASE_SEASON_VALUES = {
    RED: 1000,    // High season - peak demand
    WHITE: 600,   // Medium season - moderate demand
    BLUE: 300     // Low season - low demand
  };

  /**
   * Base nightly rates for BOOKINGS (approximately 1/7 of weekly deposit values)
   * These are the base costs per night before multipliers
   */
  private static readonly BASE_NIGHTLY_RATES = {
    RED: 150,     // High season - ~1/7 of 1000
    WHITE: 90,    // Medium season - ~1/7 of 600
    BLUE: 45      // Low season - ~1/7 of 300
  };

  /**
   * Property tier multipliers
   */
  private static readonly TIER_MULTIPLIERS = {
    DIAMOND: 1.5,      // Premium properties
    GOLD: 1.3,         // High-quality properties
    SILVER_PLUS: 1.1,  // Above standard
    STANDARD: 1.0      // Standard properties
  };

  /**
   * Room type multipliers (accommodation size factor)
   */
  private static readonly ROOM_TYPE_MULTIPLIERS = {
    STANDARD: 1.0,      // Studio / Standard room
    SUPERIOR: 1.2,      // 1 bedroom
    DELUXE: 1.5,        // 2 bedroom
    SUITE: 2.0,         // 3 bedroom
    PRESIDENTIAL: 2.5   // Penthouse
  };

  /**
   * Accommodation type to room type mapping
   */
  private static readonly ACCOMMODATION_TO_ROOM_TYPE: Record<string, keyof typeof CreditCalculationService.ROOM_TYPE_MULTIPLIERS> = {
    'studio': 'STANDARD',
    '1bedroom': 'SUPERIOR',
    '2bedroom': 'DELUXE',
    '3bedroom': 'SUITE',
    'penthouse': 'PRESIDENTIAL'
  };

  /**
   * Category patterns for auto-detection of room types
   */
  private static readonly CATEGORY_PATTERNS: Array<{
    pattern: RegExp;
    roomType: keyof typeof CreditCalculationService.ROOM_TYPE_MULTIPLIERS;
  }> = [
    // PRESIDENTIAL (must be checked first)
    { pattern: /penthouse|presidential|ático|atico/i, roomType: 'PRESIDENTIAL' },
    
    // SUITE
    { pattern: /\b3\s*br\b|3\s*bed|three.*bed|suite.*3|3.*habitaciones/i, roomType: 'SUITE' },
    
    // DELUXE
    { pattern: /\b2\s*br\b|2\s*bed|two.*bed|deluxe.*2|2.*habitaciones/i, roomType: 'DELUXE' },
    
    // SUPERIOR
    { pattern: /\b1\s*br\b|1\s*bed|one.*bed|superior|1.*habitación/i, roomType: 'SUPERIOR' },
    
    // STANDARD (default/fallback)
    { pattern: /studio|standard|básico|basico|estándar|estandar/i, roomType: 'STANDARD' }
  ];

  /**
   * Auto-detect room type from unit category
   */
  private detectRoomTypeFromCategory(category: string): keyof typeof CreditCalculationService.ROOM_TYPE_MULTIPLIERS {
    for (const { pattern, roomType } of CreditCalculationService.CATEGORY_PATTERNS) {
      if (pattern.test(category)) {
        return roomType;
      }
    }
    return 'STANDARD'; // Default fallback
  }

  /**
   * Get unit multiplier (with auto-detection if not manually set)
   */
  private async getUnitMultiplier(unit: TimeshareUnit): Promise<number> {
    // 1. If unit has manual override, use it
    if (unit.room_type_multiplier !== null && unit.room_type_multiplier !== undefined) {
      return parseFloat(unit.room_type_multiplier.toString());
    }

    // 2. Auto-detect from category
    const detectedType = this.detectRoomTypeFromCategory(unit.category);

    // 3. Get multiplier from config
    const configKey = `ROOM_${detectedType}`;
    return await this.getConfigValue(
      configKey,
      CreditCalculationService.ROOM_TYPE_MULTIPLIERS[detectedType]
    );
  }

  /**
   * Map accommodation type (from weeks) to room type (for bookings)
   */
  private mapAccommodationToRoomType(accommodationType: string): keyof typeof CreditCalculationService.ROOM_TYPE_MULTIPLIERS {
    const normalized = accommodationType.toLowerCase().replace(/\s+/g, '');
    return CreditCalculationService.ACCOMMODATION_TO_ROOM_TYPE[normalized] || 'STANDARD';
  }

  /**
   * Calculate credits earned from depositing a week
   * Master Formula: BASE_SEASON_VALUE × TIER_MULTIPLIER × LOCATION_MULTIPLIER × ROOM_TYPE_MULTIPLIER
   */
  async calculateDepositCredits(weekId: number): Promise<{
    credits: number;
    breakdown: {
      seasonType: string;
      baseValue: number;
      tierMultiplier: number;
      locationMultiplier: number;
      roomTypeMultiplier: number;
      propertyName: string;
      propertyTier: string;
      roomType: string;
    };
  }> {
    // Get week details with property
    const week = await Week.findByPk(weekId, {
      include: [{ model: Property, as: 'Property' }]
    });

    if (!week) {
      throw new Error(`Week #${weekId} not found`);
    }

    const property = (week as any).Property;
    if (!property) {
      throw new Error(`Week #${weekId} has no associated property`);
    }

    // Determine season type from SeasonalCalendar (property-specific config).
    // If week has a concrete start_date, look it up in seasonal_calendar first.
    // Fall back to week.season_type for floating periods (no fixed date).
    let seasonType: 'RED' | 'WHITE' | 'BLUE';
    if (week.start_date) {
      seasonType = await SeasonalCalendar.getSeasonForDateWithDefault(
        property.id,
        new Date(week.start_date)
      );
    } else {
      seasonType = (week.season_type as 'RED' | 'WHITE' | 'BLUE') || 'WHITE';
    }
    
    // Get base value from config (with fallback to hardcoded)
    const baseValue = await this.getConfigValue(
      `BASE_SEASON_${seasonType}`,
      CreditCalculationService.BASE_SEASON_VALUES[seasonType as keyof typeof CreditCalculationService.BASE_SEASON_VALUES]
    );

    // Get tier multiplier from config (with fallback)
    const tierMultiplier = await this.getConfigValue(
      `TIER_${property.tier}`,
      CreditCalculationService.TIER_MULTIPLIERS[property.tier as keyof typeof CreditCalculationService.TIER_MULTIPLIERS] || 1.0
    );

    // Get location multiplier from property (default 1.0 if not set)
    const locationMultiplier = parseFloat((property.location_multiplier ?? 1.0).toString()) || 1.0;

    // Get room type multiplier - check if it's already a room type (STANDARD, SUPERIOR, etc.) or needs mapping
    let roomType: keyof typeof CreditCalculationService.ROOM_TYPE_MULTIPLIERS;
    const accommodationType = week.accommodation_type || 'STANDARD';
    
    // Check if it's already a valid room type
    if (accommodationType in CreditCalculationService.ROOM_TYPE_MULTIPLIERS) {
      roomType = accommodationType as keyof typeof CreditCalculationService.ROOM_TYPE_MULTIPLIERS;
    } else {
      // Map from legacy format (studio, 1bedroom, etc.)
      roomType = this.mapAccommodationToRoomType(accommodationType);
    }
    
    // Get room type multiplier from config (with fallback)
    const roomTypeMultiplier = await this.getConfigValue(
      `ROOM_${roomType}`,
      CreditCalculationService.ROOM_TYPE_MULTIPLIERS[roomType]
    );

    // Calculate final credits using Master Formula
    const credits = Math.round(baseValue * tierMultiplier * locationMultiplier * roomTypeMultiplier);

    return {
      credits,
      breakdown: {
        seasonType,
        baseValue,
        tierMultiplier,
        locationMultiplier,
        roomTypeMultiplier,
        propertyName: property.name,
        propertyTier: property.tier,
        roomType
      }
    };
  }

  /**
   * Calculate cost in credits for a booking
   * Uses CreditBookingCost configuration or fallback to Master Formula
   */
  async calculateBookingCost(
    propertyId: number,
    roomType: string,
    seasonType: 'RED' | 'WHITE' | 'BLUE',
    nights: number,
    checkInDate?: Date
  ): Promise<{
    totalCredits: number;
    creditsPerNight: number;
    nights: number;
    breakdown: {
      baseRate: number;
      tierMultiplier: number;
      locationMultiplier: number;
      roomTypeMultiplier: number;
      propertyTier: string;
      seasonType: string;
      configUsed: boolean;
    };
  }> {
    let creditsPerNight: number = 0;
    let configUsed = false;

    // Try to get configured cost from CreditBookingCost table (v1 table, may not exist in v2)
    try {
      const costConfig = await CreditBookingCost.getCost(
        propertyId,
        roomType,
        seasonType,
        checkInDate
      );

      if (costConfig && costConfig.credits_per_night) {
        // Use configured value
        creditsPerNight = costConfig.credits_per_night;
        configUsed = true;
      }
    } catch (error: any) {
      // Table doesn't exist or query failed - this is expected in v2 system
      // Continue to use Master Formula fallback
      console.log('📝 CreditBookingCost table not available, using Master Formula');
    }

    // Resolve property (tier + location_multiplier needed for Master Formula)
    // Try V2 model first (same table, same columns), fallback to V1
    let resolvedTier: string = 'STANDARD';
    let resolvedLocationMultiplier: number = 1.0;

    const propertyV2 = await TimeshareProperty.findByPk(propertyId);
    if (propertyV2) {
      resolvedTier = (propertyV2 as any).tier || 'STANDARD';
      resolvedLocationMultiplier = parseFloat(((propertyV2 as any).location_multiplier || 1.0).toString());
    } else {
      const propertyV1 = await Property.findByPk(propertyId);
      if (!propertyV1) throw new Error(`Property ${propertyId} not found`);
      resolvedTier = (propertyV1 as any).tier || 'STANDARD';
      resolvedLocationMultiplier = parseFloat(((propertyV1 as any).location_multiplier || 1.0).toString());
    }

    if (!configUsed) {
      // Master Formula: BASE_NIGHTLY × ROOM_MULTIPLIER × TIER_MULTIPLIER × LOCATION_MULTIPLIER
      const baseRate = await this.getConfigValue(
        `BASE_NIGHTLY_${seasonType}`,
        CreditCalculationService.BASE_NIGHTLY_RATES[seasonType]
      );

      const roomMultiplier = await this.getConfigValue(
        `ROOM_${roomType}`,
        CreditCalculationService.ROOM_TYPE_MULTIPLIERS[roomType as keyof typeof CreditCalculationService.ROOM_TYPE_MULTIPLIERS] || 1.0
      );

      const tierMultiplier = await this.getConfigValue(
        `TIER_${resolvedTier}`,
        CreditCalculationService.TIER_MULTIPLIERS[resolvedTier as keyof typeof CreditCalculationService.TIER_MULTIPLIERS] || 1.0
      );

      creditsPerNight = Math.round(baseRate * roomMultiplier * tierMultiplier * resolvedLocationMultiplier);
    }

    const totalCredits = creditsPerNight * nights;

    return {
      totalCredits,
      creditsPerNight,
      nights,
      breakdown: {
        baseRate: CreditCalculationService.BASE_NIGHTLY_RATES[seasonType],
        tierMultiplier: CreditCalculationService.TIER_MULTIPLIERS[resolvedTier as keyof typeof CreditCalculationService.TIER_MULTIPLIERS] || 1.0,
        locationMultiplier: resolvedLocationMultiplier,
        roomTypeMultiplier: CreditCalculationService.ROOM_TYPE_MULTIPLIERS[roomType as keyof typeof CreditCalculationService.ROOM_TYPE_MULTIPLIERS] || 1.0,
        propertyTier: resolvedTier,
        seasonType,
        configUsed
      }
    };
  }

  /**
   * Get credit to euro conversion rate
   */
  async getCreditToEuroRate(): Promise<number> {
    const setting = await PlatformSetting.findOne({
      where: { key: 'credit_to_euro_rate' }
    });

    return setting ? parseFloat((setting as any).value) : 1.0;
  }

  /**
   * Convert credits to euros
   */
  async convertCreditsToEuros(credits: number): Promise<number> {
    const rate = await this.getCreditToEuroRate();
    return Math.round(credits * rate * 100) / 100; // Round to 2 decimals
  }

  /**
   * Convert euros to credits
   */
  async convertEurosToCredits(euros: number): Promise<number> {
    const rate = await this.getCreditToEuroRate();
    return Math.round(euros / rate);
  }

  /**
   * Calculate expiration date (6 months from deposit)
   */
  calculateExpirationDate(depositDate: Date = new Date()): Date {
    const expirationDate = new Date(depositDate);
    expirationDate.setMonth(expirationDate.getMonth() + 6);
    return expirationDate;
  }

  /**
   * Calculate how many days until credits expire
   */
  calculateDaysUntilExpiration(expiresAt: Date): number {
    const now = new Date();
    const diffTime = expiresAt.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }

  /**
   * Check if credits are expiring soon (within warning threshold)
   */
  async isExpiringSoon(expiresAt: Date): Promise<boolean> {
    const setting = await PlatformSetting.findOne({
      where: { key: 'credit_expiration_warning_days' }
    });

    const warningDays = setting ? parseInt((setting as any).value) : 30;
    const daysUntilExpiration = this.calculateDaysUntilExpiration(expiresAt);

    return daysUntilExpiration <= warningDays && daysUntilExpiration > 0;
  }

  /**
   * Validate if user has enough credits for booking
   */
  validateSufficientCredits(availableCredits: number, requiredCredits: number): {
    sufficient: boolean;
    shortfall: number;
  } {
    const sufficient = availableCredits >= requiredCredits;
    const shortfall = sufficient ? 0 : requiredCredits - availableCredits;

    return { sufficient, shortfall };
  }

  /**
   * Calculate hybrid payment (credits + cash)
   */
  async calculateHybridPayment(
    availableCredits: number,
    requiredCredits: number
  ): Promise<{
    creditsUsed: number;
    cashRequired: number;
    creditShortfall: number;
  }> {
    const creditsUsed = Math.min(availableCredits, requiredCredits);
    const creditShortfall = Math.max(0, requiredCredits - availableCredits);
    const cashRequired = await this.convertCreditsToEuros(creditShortfall);

    return {
      creditsUsed,
      cashRequired,
      creditShortfall
    };
  }

  /**
   * Calculate credit difference for swap scenarios
   * When swapping a RED/RIMINI for WHITE/MADONNA, calculate if additional payment needed
   */
  async calculateSwapDifference(
    depositedWeekId: number,
    requestedPropertyId: number,
    requestedRoomType: string,
    requestedSeasonType: 'RED' | 'WHITE' | 'BLUE',
    requestedNights: number
  ): Promise<{
    deposited_credits: number;
    required_credits: number;
    credit_difference: number;
    requires_payment: boolean;
    payment_amount_credits: number;
  }> {
    // Calculate credits from deposited week
    const depositResult = await this.calculateDepositCredits(depositedWeekId);

    // Calculate credits required for booking
    const bookingResult = await this.calculateBookingCost(
      requestedPropertyId,
      requestedRoomType,
      requestedSeasonType,
      requestedNights
    );

    const creditDifference = depositResult.credits - bookingResult.totalCredits;

    return {
      deposited_credits: depositResult.credits,
      required_credits: bookingResult.totalCredits,
      credit_difference: creditDifference,
      requires_payment: creditDifference < 0,
      payment_amount_credits: creditDifference < 0 ? Math.abs(creditDifference) : 0
    };
  }

  /**
   * Estimate credits for a week without creating it
   * (Useful for showing users potential earnings before depositing)
   */
  async estimateCreditsForWeek(
    propertyId: number,
    accommodationType: string,
    seasonType: 'RED' | 'WHITE' | 'BLUE'
  ): Promise<{
    estimatedCredits: number;
    seasonType: string;
    breakdown: {
      baseValue: number;
      tierMultiplier: number;
      locationMultiplier: number;
      roomTypeMultiplier: number;
      propertyTier: string;
    };
  }> {
    // Get property details
    const property = await Property.findByPk(propertyId);
    if (!property) {
      throw new Error(`Property ${propertyId} not found`);
    }

    // Get base season value
    const baseValue = CreditCalculationService.BASE_SEASON_VALUES[seasonType];

    // Get tier multiplier - use default STANDARD (1.0)
    const tierMultiplier = 1.0;

    // Get location multiplier - use default 1.0
    const locationMultiplier = 1.0;

    // Get room type multiplier
    const roomType = this.mapAccommodationToRoomType(accommodationType);
    const roomTypeMultiplier = CreditCalculationService.ROOM_TYPE_MULTIPLIERS[roomType];

    // Calculate estimated credits
    const estimatedCredits = Math.round(baseValue * tierMultiplier * locationMultiplier * roomTypeMultiplier);

    return {
      estimatedCredits,
      seasonType,
      breakdown: {
        baseValue,
        tierMultiplier,
        locationMultiplier,
        roomTypeMultiplier,
        propertyTier: 'STANDARD'
      }
    };
  }

  /**
   * Get system constants (for admin reference and calculations)
   */
  getSystemConstants() {
    return {
      season_base_values: CreditCalculationService.BASE_SEASON_VALUES,
      tier_multipliers: CreditCalculationService.TIER_MULTIPLIERS,
      room_type_multipliers: CreditCalculationService.ROOM_TYPE_MULTIPLIERS,
      accommodation_mapping: CreditCalculationService.ACCOMMODATION_TO_ROOM_TYPE
    };
  }

  /**
   * Get all season values (for admin configuration)
   */
  getBaseSeasonValues(): Record<string, number> {
    return { ...CreditCalculationService.BASE_SEASON_VALUES };
  }

  /**
   * Get credit to EUR conversion rate from database or fallback to hardcoded value
   */
  static async getCreditToEurRate(): Promise<number> {
    try {
      const PlatformSetting = (await import('../models/PlatformSetting')).default;
      const setting = await PlatformSetting.findOne({
        where: { key: 'credit_to_eur_rate' }
      });

      console.log('🔍 getCreditToEurRate - setting from DB:', setting ? (setting as any).value : 'NOT FOUND');

      if (setting) {
        const value = (setting as any).value;
        if (value) {
          const rate = parseFloat(value);
          console.log('🔍 getCreditToEurRate - parsed rate:', rate);
          return isNaN(rate) ? CreditCalculationService.CREDIT_TO_EUR_RATE : rate;
        }
      }
      
      console.log('🔍 getCreditToEurRate - returning fallback:', CreditCalculationService.CREDIT_TO_EUR_RATE);
      return CreditCalculationService.CREDIT_TO_EUR_RATE;
    } catch (error) {
      console.error('Error fetching credit to EUR rate from DB:', error);
      return CreditCalculationService.CREDIT_TO_EUR_RATE;
    }
  }

  /**
   * Update credit to EUR conversion rate in database
   */
  static async updateCreditToEurRate(rate: number): Promise<void> {
    console.log('🔍 updateCreditToEurRate called with:', rate, typeof rate);
    const PlatformSetting = (await import('../models/PlatformSetting')).default;
    const [setting, created] = await PlatformSetting.findOrCreate({
      where: { key: 'credit_to_eur_rate' },
      defaults: { 
        key: 'credit_to_eur_rate',
        value: String(rate)
      }
    });

    console.log('🔍 updateCreditToEurRate - created:', created, 'current value:', (setting as any).value);

    // Si ya existía, actualizarlo
    if (!created) {
      (setting as any).value = String(rate);
      await (setting as any).save();
      console.log('🔍 updateCreditToEurRate - UPDATED to:', rate);
    }
  }
}

// Export both the class and a singleton instance
export { CreditCalculationService };
export default new CreditCalculationService();
