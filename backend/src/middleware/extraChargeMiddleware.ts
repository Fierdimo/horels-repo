import { Request, Response, NextFunction } from 'express';

// Extender la interfaz Request para incluir propiedades personalizadas
interface RequestWithChargeInfo extends Request {
  chargeAmountOriginal?: number;
  chargeAmountWithFee?: number;
  chargeExtraFee?: number;
}

/**
 * Middleware para aplicar un sobrecargo configurable (porcentaje extra) al monto de cobro antes de procesar el pago.
 * El porcentaje se define en la variable de entorno EXTRA_CHARGE_PERCENT (ejemplo: 5 para 5%).
 * El monto original y el monto con sobrecargo quedan disponibles en req.chargeAmountOriginal y req.chargeAmountWithFee
 */
export function extraChargeMiddleware(req: RequestWithChargeInfo, res: Response, next: NextFunction) {
  const percent = parseFloat(process.env.EXTRA_CHARGE_PERCENT || '5');
  // Se espera que el monto original esté en req.body.amount
  const original = typeof req.body.amount === 'number' ? req.body.amount : parseFloat(req.body.amount);
  if (isNaN(original)) {
    return res.status(400).json({ error: 'Invalid or missing amount for extra charge calculation.' });
  }
  const extra = Math.round((original * percent) / 100 * 100) / 100;
  const amountWithFee = Math.round((original + extra) * 100) / 100;
  req.body.amountWithFee = amountWithFee;
  
  // Asignar propiedades personalizadas usando cast
  (req as any).chargeAmountOriginal = original;
  (req as any).chargeAmountWithFee = amountWithFee;
  (req as any).chargeExtraFee = extra;
  next();
}
