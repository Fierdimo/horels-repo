import { Request, Response } from 'express';
import { StripeService } from '../services/stripeService';
import LoggingService from '../services/loggingService';
import { nightCreditService } from '../services/nightCreditService';

// Extender la interfaz Request para incluir propiedades personalizadas del middleware
interface RequestWithChargeInfo extends Request {
  chargeAmountOriginal?: number;
  chargeAmountWithFee?: number;
  chargeExtraFee?: number;
}

class StripeController {
  private stripeService: StripeService;

  constructor() {
    this.stripeService = new StripeService();
  }

  /**
   * Create a payment intent
   */
  async createPaymentIntent(req: RequestWithChargeInfo, res: Response): Promise<void> {
    try {
      // Usar el monto con fee si está disponible, si no el original
      const { amount, currency, type, metadata } = req.body;
      const amountToCharge = req.body.amountWithFee || amount;

      // Validaciones
      if (!amountToCharge || !currency || !type) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: amount, currency, type'
        });
        return;
      }
      if (typeof amountToCharge !== 'number' || amountToCharge <= 0) {
        res.status(400).json({
          success: false,
          error: 'Amount must be a positive number'
        });
        return;
      }
      if (currency !== 'eur') {
        res.status(400).json({
          success: false,
          error: 'Only EUR currency is supported'
        });
        return;
      }
      if (!['swap_fee', 'hotel_payment'].includes(type)) {
        res.status(400).json({
          success: false,
          error: 'Invalid payment type. Must be swap_fee or hotel_payment'
        });
        return;
      }

      // El monto original y el fee quedan disponibles para logging o transferencias posteriores
      const extraFee = req.chargeExtraFee || 0;
      const originalAmount = req.chargeAmountOriginal || amount;

      const result = await this.stripeService.createPaymentIntent(amountToCharge, currency, type, {
        ...metadata,
        originalAmount,
        extraFee
      });

      res.status(200).json({
        success: true,
        data: {
          ...result,
          originalAmount,
          extraFee
        }
      });

    } catch (error: any) {
      console.error('Create payment intent error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Confirm a payment
   */
  async confirmPayment(req: Request, res: Response): Promise<void> {
    try {
      const { paymentIntentId } = req.params;

      if (!paymentIntentId) {
        res.status(400).json({
          success: false,
          error: 'Payment intent ID is required'
        });
        return;
      }

      const result = await this.stripeService.confirmPayment(paymentIntentId);

      res.status(200).json({
        success: true,
        data: result
      });

    } catch (error: any) {
      console.error('Confirm payment error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Handle Stripe webhooks
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['stripe-signature'] as string;
      const payload = req.body;

      if (!signature) {
        res.status(400).json({
          success: false,
          error: 'Missing Stripe signature'
        });
        return;
      }

      const event = await this.stripeService.handleWebhook(payload, signature);

      // Handle specific event types
      const paymentIntent = event.data.object as any;

      switch (event.type) {
        case 'payment_intent.succeeded':
          console.log('[Webhook] payment_intent.succeeded received:', paymentIntent.id);
          
          // Check if it's a night credit extension payment
          const metadata = paymentIntent.metadata || {};
          if (metadata.type === 'night_credit_extension' && metadata.request_id) {
            try {
              await nightCreditService.handlePaymentSuccess(paymentIntent.id);
              console.log('[Webhook] Night credit request completed:', metadata.request_id);
            } catch (err: any) {
              console.error('[Webhook] Error completing night credit request:', err.message);
            }
          }
          
          // Log the event
          await LoggingService.logAction({
            action: 'payment_intent_succeeded',
            details: { paymentIntentId: paymentIntent.id }
          });
          break;

        case 'payment_intent.payment_failed':
          console.log('[Webhook] payment_intent.payment_failed received:', paymentIntent.id);
          await LoggingService.logAction({
            action: 'payment_intent_failed',
            details: { paymentIntentId: paymentIntent.id }
          });
          break;

        default:
          console.log(`[Webhook] Unhandled event type: ${event.type}`);
      }

      res.status(200).json({ received: true });

    } catch (error: any) {
      console.error('Webhook error:', error.message);

      // Log webhook errors
      await LoggingService.logAction({
        action: 'stripe_webhook_error',
        details: { error: error.message }
      });

      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Create a refund
   */
  async createRefund(req: Request, res: Response): Promise<void> {
    try {
      const { paymentIntentId, amount, currency, reason } = req.body;

      // Validate required fields
      if (!paymentIntentId || !amount || !currency) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: paymentIntentId, amount, currency'
        });
        return;
      }

      // Validate amount
      if (typeof amount !== 'number' || amount <= 0) {
        res.status(400).json({
          success: false,
          error: 'Amount must be a positive number'
        });
        return;
      }

      const result = await this.stripeService.createRefund(paymentIntentId, amount, currency, reason);

      res.status(200).json({
        success: true,
        data: result
      });

    } catch (error: any) {
      console.error('Create refund error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Cancel a payment
   */
  async cancelPayment(req: Request, res: Response): Promise<void> {
    try {
      const { paymentIntentId } = req.params;

      if (!paymentIntentId) {
        res.status(400).json({
          success: false,
          error: 'Payment intent ID is required'
        });
        return;
      }

      await this.stripeService.cancelPayment(paymentIntentId);

      res.status(200).json({
        success: true,
        message: 'Payment cancelled successfully'
      });

    } catch (error: any) {
      console.error('Cancel payment error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

export default new StripeController();