import PlatformSetting from '../models/PlatformSetting';

/**
 * Servicio para cálculo de precios con comisiones de plataforma
 */
class PricingService {
  /**
   * Obtiene el porcentaje de comisión de la plataforma
   * Default: 10% si no está configurado
   */
  async getPlatformCommissionRate(): Promise<number> {
    try {
      const setting = await PlatformSetting.findOne({
        where: { key: 'marketplace_commission_rate' }
      });

      console.log('🔍 [PricingService] Commission setting found:', setting?.toJSON());

      if (setting) {
        const rate = parseFloat(setting.get('value') as string);
        console.log('💰 [PricingService] Commission rate:', rate);
        return isNaN(rate) ? 10.0 : rate;
      }

      console.log('⚠️ [PricingService] No commission setting found, using default 10%');
      return 10.0; // Default 10%
    } catch (error) {
      console.error('❌ [PricingService] Error fetching commission rate:', error);
      return 10.0; // Fallback
    }
  }

  /**
   * Calcula el precio final para el guest (precio base + comisión)
   * @param basePrice Precio que configuró el hotel
   * @returns Precio con comisión incluida
   */
  async calculateGuestPrice(basePrice: number): Promise<number> {
    // Validar que basePrice sea un número válido
    const validBasePrice = parseFloat(String(basePrice)) || 0;
    
    console.log('💵 [PricingService] Calculating guest price for base:', validBasePrice);
    const commissionRate = await this.getPlatformCommissionRate();
    const commission = validBasePrice * (commissionRate / 100);
    const guestPrice = validBasePrice + commission;
    
    console.log('✅ [PricingService] Result:', {
      basePrice: validBasePrice,
      commissionRate: commissionRate,
      commission: commission,
      guestPrice: guestPrice
    });
    
    return parseFloat(guestPrice.toFixed(2));
  }

  /**
   * Calcula cuánto recibe el hotel después de la comisión
   * @param guestPrice Precio que pagó el guest
   * @returns Precio que recibe el hotel
   */
  async calculateHotelPayout(guestPrice: number): Promise<number> {
    // Validar que guestPrice sea un número válido
    const validGuestPrice = parseFloat(String(guestPrice)) || 0;
    
    const commissionRate = await this.getPlatformCommissionRate();
    const hotelPayout = validGuestPrice / (1 + commissionRate / 100);
    return parseFloat(hotelPayout.toFixed(2));
  }

  /**
   * Obtiene desglose completo de pricing
   */
  async getPriceBreakdown(basePrice: number) {
    // Validar que basePrice sea un número válido
    const validBasePrice = parseFloat(String(basePrice)) || 0;
    
    const commissionRate = await this.getPlatformCommissionRate();
    const guestPrice = await this.calculateGuestPrice(validBasePrice);
    const commission = guestPrice - validBasePrice;

    return {
      basePrice: parseFloat(validBasePrice.toFixed(2)),
      commissionRate,
      commission: parseFloat(commission.toFixed(2)),
      guestPrice: parseFloat(guestPrice.toFixed(2)),
      hotelPayout: parseFloat(validBasePrice.toFixed(2))
    };
  }
}

export default new PricingService();
