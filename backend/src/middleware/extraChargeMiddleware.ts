import { Request, Response, NextFunction } from 'express';
import PlatformSetting from '../models/PlatformSetting';

// Extender la interfaz Request para incluir propiedades personalizadas
interface RequestWithChargeInfo extends Request {
  chargeAmountOriginal?: number;
  chargeAmountWithFee?: number;
  chargeExtraFee?: number;
}

/**
 * Middleware para aplicar un sobrecargo configurable (porcentaje extra) al monto de cobro antes de procesar el pago.
 * El porcentaje se obtiene de la tabla platform_settings (PLATFORM_FEE_PERCENTAGE).
 * El monto original y el monto con sobrecargo quedan disponibles en req.chargeAmountOriginal y req.chargeAmountWithFee
 * 
 * Flujo:
 * 1. Usuario paga: costo normal + porcentaje de comisión
 * 2. PMS recibe: solo costo normal
 * 3. Plataforma retiene: porcentaje de comisión
 */
export async function extraChargeMiddleware(req: RequestWithChargeInfo, res: Response, next: NextFunction) {
  try {
    // Get commission percentage from platform settings
    // Frontend saves this as 'commissionRate' in admin settings page
    const setting = await PlatformSetting.findOne({
      where: { setting_key: 'commissionRate' }
    });
    
    const percent = setting 
      ? parseFloat((setting as any).setting_value) 
      : parseFloat(process.env.EXTRA_CHARGE_PERCENT || '10'); // Fallback to env or default 10%
    
    // Se espera que el monto original esté en req.body.amount
    const original = typeof req.body.amount === 'number' ? req.body.amount : parseFloat(req.body.amount);
    
    if (isNaN(original)) {
      return res.status(400).json({ error: 'Invalid or missing amount for extra charge calculation.' });
    }
    
    // Calculate fee and total
    const extra = Math.round((original * percent) / 100 * 100) / 100;
    const amountWithFee = Math.round((original + extra) * 100) / 100;
    
    // Add calculated amounts to request body
    req.body.amountWithFee = amountWithFee;
    req.body.platformFeePercentage = percent;
    
    // Asignar propiedades personalizadas usando cast
    (req as any).chargeAmountOriginal = original;      // Amount to send to PMS
    (req as any).chargeAmountWithFee = amountWithFee;  // Amount to charge user
    (req as any).chargeExtraFee = extra;               // Platform commission
    
    next();
  } catch (error) {
    console.error('Error in extraChargeMiddleware:', error);
    // Fallback to env variable if database query fails
    const percent = parseFloat(process.env.EXTRA_CHARGE_PERCENT || '10');
    const original = typeof req.body.amount === 'number' ? req.body.amount : parseFloat(req.body.amount);
    
    if (isNaN(original)) {
      return res.status(400).json({ error: 'Invalid or missing amount for extra charge calculation.' });
    }
    
    const extra = Math.round((original * percent) / 100 * 100) / 100;
    const amountWithFee = Math.round((original + extra) * 100) / 100;
    
    req.body.amountWithFee = amountWithFee;
    req.body.platformFeePercentage = percent;
    (req as any).chargeAmountOriginal = original;
    (req as any).chargeAmountWithFee = amountWithFee;
    (req as any).chargeExtraFee = extra;
    
    next();
  }
}
