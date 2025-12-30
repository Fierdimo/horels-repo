import CreditBookingCost from '../models/CreditBookingCost';
import PlatformSetting from '../models/PlatformSetting';
import Week from '../models/Week';
import Property from '../models/Property';

/**
 * Credit Calculation Service - Master Formula Implementation
 * 
 * Implements the comprehensive credit valuation system:
 * - Deposit: Base_Season_Value × Tier_Multiplier × Location_Multiplier × Unit_Size_Multiplier
 * - Booking: Nightly_Cost = Base_Rate × Room_Type_Multiplier × Tier_Multiplier × Location_Multiplier
 */
class CreditCalculationService {
  
  /**
   * Base season values (reference points for credit calculation)
   */
  private static readonly BASE_SEASON_VALUES = {
    RED: 1000,    // High season - peak demand
    WHITE: 600,   // Medium season - moderate demand
    BLUE: 300     // Low season - low demand
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
      include: [{ model: Property, as: 'property' }]
    });

    if (!week) {
      throw new Error(`Week #${weekId} not found`);
    }

    const property = (week as any).property;
    if (!property) {
      throw new Error(`Week #${weekId} has no associated property`);
    }

    // Get season type from week (now stored directly on weeks table)
    const seasonType = week.season_type || 'WHITE';
    const baseValue = CreditCalculationService.BASE_SEASON_VALUES[seasonType as keyof typeof CreditCalculationService.BASE_SEASON_VALUES];

    // Get tier multiplier from property
    const tierMultiplier = CreditCalculationService.TIER_MULTIPLIERS[property.tier as keyof typeof CreditCalculationService.TIER_MULTIPLIERS] || 1.0;

    // Get location multiplier from property
    const locationMultiplier = parseFloat(property.location_multiplier.toString());

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
    
    const roomTypeMultiplier = CreditCalculationService.ROOM_TYPE_MULTIPLIERS[roomType];

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
    let creditsPerNight: number;
    let configUsed = false;

    // Try to get configured cost from CreditBookingCost table
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
    } else {
      // Fallback to Master Formula calculation
      const property = await Property.findByPk(propertyId);
      if (!property) {
        throw new Error(`Property ${propertyId} not found`);
      }

      // Base rate from season
      const baseRate = CreditCalculationService.BASE_SEASON_VALUES[seasonType];

      // Room type multiplier
      const roomMultiplier = CreditCalculationService.ROOM_TYPE_MULTIPLIERS[roomType as keyof typeof CreditCalculationService.ROOM_TYPE_MULTIPLIERS] || 1.0;

      // Tier multiplier
      const tierMultiplier = CreditCalculationService.TIER_MULTIPLIERS[property.tier as keyof typeof CreditCalculationService.TIER_MULTIPLIERS] || 1.0;

      // Location multiplier
      const locationMultiplier = parseFloat(property.location_multiplier.toString());

      // Calculate nightly cost: Base_Rate × Room_Multiplier × Tier_Multiplier × Location_Multiplier
      creditsPerNight = Math.round(baseRate * roomMultiplier * tierMultiplier * locationMultiplier);
    }

    const totalCredits = creditsPerNight * nights;

    // Get property for breakdown
    const property = await Property.findByPk(propertyId);

    return {
      totalCredits,
      creditsPerNight,
      nights,
      breakdown: {
        baseRate: CreditCalculationService.BASE_SEASON_VALUES[seasonType],
        tierMultiplier: property ? CreditCalculationService.TIER_MULTIPLIERS[property.tier as keyof typeof CreditCalculationService.TIER_MULTIPLIERS] : 1.0,
        locationMultiplier: property ? parseFloat(property.location_multiplier.toString()) : 1.0,
        roomTypeMultiplier: CreditCalculationService.ROOM_TYPE_MULTIPLIERS[roomType as keyof typeof CreditCalculationService.ROOM_TYPE_MULTIPLIERS] || 1.0,
        propertyTier: property?.tier || 'STANDARD',
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
      where: { setting_key: 'credit_to_euro_rate' }
    });

    return setting ? parseFloat((setting as any).setting_value) : 1.0;
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
      where: { setting_key: 'credit_expiration_warning_days' }
    });

    const warningDays = setting ? parseInt((setting as any).setting_value) : 30;
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

    // Get tier multiplier
    const tierMultiplier = CreditCalculationService.TIER_MULTIPLIERS[property.tier as keyof typeof CreditCalculationService.TIER_MULTIPLIERS] || 1.0;

    // Get location multiplier
    const locationMultiplier = parseFloat(property.location_multiplier.toString());

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
        propertyTier: property.tier
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
}

export default new CreditCalculationService();
