import PropertyTier from '../models/PropertyTier';
import RoomTypeMultiplier from '../models/RoomTypeMultiplier';
import SeasonalCalendar from '../models/SeasonalCalendar';
import CreditBookingCost from '../models/CreditBookingCost';
import PlatformSetting from '../models/PlatformSetting';
import Week from '../models/Week';
import Property from '../models/Property';

/**
 * Service for calculating credit values for deposits and bookings
 */
class CreditCalculationService {
  
  /**
   * Base season values (standard multipliers)
   */
  private static readonly BASE_SEASON_VALUES = {
    RED: 1000,
    WHITE: 600,
    BLUE: 300
  };

  /**
   * Calculate credits earned from depositing a week
   * Formula: Credits = BASE_SEASON_VALUE × LOCATION_MULTIPLIER × ROOM_TYPE_MULTIPLIER
   */
  async calculateDepositCredits(weekId: number): Promise<{
    credits: number;
    breakdown: {
      seasonType: string;
      baseValue: number;
      locationMultiplier: number;
      roomTypeMultiplier: number;
      propertyName: string;
      roomType: string;
    };
  }> {
    // Get week details
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

    if (!week.start_date) {
      throw new Error(`Week #${weekId} has no start_date (floating week not supported for credit calculation)`);
    }

    // Get season type for the week
    const season = await SeasonalCalendar.getSeasonForDate(
      week.property_id,
      new Date(week.start_date)
    );

    if (!season) {
      throw new Error(`No season defined for property #${week.property_id} on ${week.start_date}`);
    }

    // season is the season type string ('RED' | 'WHITE' | 'BLUE')
    const seasonType = season as 'RED' | 'WHITE' | 'BLUE';
    const baseValue = CreditCalculationService.BASE_SEASON_VALUES[seasonType];

    // Get property tier multiplier
    let locationMultiplier = 1.0;

    const tierIdProp = (property as any).tier_id;
    if (tierIdProp) {
      const tier = await PropertyTier.findByPk(tierIdProp);
      if (tier) {
        locationMultiplier = Number((tier as any).location_multiplier);
      }
    }

    // Get room type multiplier (accommodation_type in Week model)
    const roomType = week.accommodation_type || 'STANDARD';
    const roomTypeMultiplierResult = await RoomTypeMultiplier.getByRoomType(roomType);
    const roomMultiplier = roomTypeMultiplierResult ? Number((roomTypeMultiplierResult as any).multiplier) : 1.0;

    // Calculate final credits
    const credits = Math.round(baseValue * locationMultiplier * roomMultiplier);

    return {
      credits,
      breakdown: {
        seasonType,
        baseValue,
        locationMultiplier,
        roomTypeMultiplier: roomMultiplier,
        propertyName: (property as any).name,
        roomType
      }
    };
  }

  /**
   * Calculate cost in credits for a booking
   */
  async calculateBookingCost(
    propertyId: number,
    roomType: string,
    checkInDate: Date,
    checkOutDate: Date
  ): Promise<{
    totalCredits: number;
    nights: number;
    breakdown: Array<{
      date: string;
      seasonType: string;
      creditsPerNight: number;
    }>;
  }> {
    const nights: Array<{ date: string; seasonType: string; creditsPerNight: number }> = [];
    let totalCredits = 0;

    // Iterate through each night
    const currentDate = new Date(checkInDate);
    const endDate = new Date(checkOutDate);

    while (currentDate < endDate) {
      // Get season for this date
      const season = await SeasonalCalendar.getSeasonForDate(propertyId, currentDate);
      
      if (!season) {
        throw new Error(`No season defined for property #${propertyId} on ${currentDate.toISOString()}`);
      }

      // season is the season type string
      const seasonType = season as 'RED' | 'WHITE' | 'BLUE';

      // Get cost for this combination
      const cost = await CreditBookingCost.getCost(propertyId, roomType, seasonType, currentDate);

      if (!cost) {
        throw new Error(`No booking cost defined for property #${propertyId}, room type ${roomType}, season ${seasonType}`);
      }

      const creditsPerNight = Number((cost as any).credits_per_night);
      totalCredits += creditsPerNight;

      nights.push({
        date: currentDate.toISOString().split('T')[0],
        seasonType,
        creditsPerNight
      });

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return {
      totalCredits,
      nights: nights.length,
      breakdown: nights
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
   * Get all season values (for admin configuration)
   */
  getBaseSeasonValues(): Record<string, number> {
    return { ...CreditCalculationService.BASE_SEASON_VALUES };
  }

  /**
   * Estimate credits for a week without saving
   * (Useful for showing users potential earnings before depositing)
   */
  async estimateCreditsForWeek(
    propertyId: number,
    roomType: string,
    weekStartDate: Date
  ): Promise<{
    estimatedCredits: number;
    seasonType: string;
    breakdown: {
      baseValue: number;
      locationMultiplier: number;
      roomTypeMultiplier: number;
    };
  }> {
    // Get season
    const season = await SeasonalCalendar.getSeasonForDate(propertyId, weekStartDate);
    if (!season) {
      throw new Error(`No season defined for property #${propertyId} on ${weekStartDate.toISOString()}`);
    }

    // season is the season type string
    const seasonType = season as 'RED' | 'WHITE' | 'BLUE';
    const baseValue = CreditCalculationService.BASE_SEASON_VALUES[seasonType];

    // Get property tier
    const property = await Property.findByPk(propertyId);
    let locationMultiplier = 1.0;

    const tierIdProp = property ? (property as any).tier_id : null;
    if (tierIdProp) {
      const tier = await PropertyTier.findByPk(tierIdProp);
      if (tier) {
        locationMultiplier = Number((tier as any).location_multiplier);
      }
    }

    // Get room multiplier
    const roomTypeMultiplierResult = await RoomTypeMultiplier.getByRoomType(roomType);
    const roomMultiplier = roomTypeMultiplierResult ? Number((roomTypeMultiplierResult as any).multiplier) : 1.0;

    // Calculate
    const estimatedCredits = Math.round(baseValue * locationMultiplier * roomMultiplier);

    return {
      estimatedCredits,
      seasonType,
      breakdown: {
        baseValue,
        locationMultiplier,
        roomTypeMultiplier: roomMultiplier
      }
    };
  }
}

export default new CreditCalculationService();
