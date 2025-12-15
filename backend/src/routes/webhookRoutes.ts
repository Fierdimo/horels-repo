import { Router, Request, Response } from 'express';
import { stripeService } from '../services/stripeService';
import Booking from '../models/Booking';

const router = Router();

/**
 * @route   POST /api/webhooks/stripe
 * @desc    Stripe webhook para eventos de pago
 * @access  Public (validado por Stripe signature)
 */
router.post('/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;

  if (!sig) {
    return res.status(400).json({
      success: false,
      error: 'No Stripe signature provided'
    });
  }

  try {
    // Verificar la firma del webhook
    const event = stripeService.verifyWebhookSignature(
      req.body,
      sig
    );

    console.log(`[Stripe Webhook] Event received: ${event.type}`);

    // Manejar diferentes tipos de eventos
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object);
        break;

      case 'payment_intent.canceled':
        await handlePaymentIntentCanceled(event.data.object);
        break;

      case 'charge.refunded':
        await handleChargeRefunded(event.data.object);
        break;

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    // Responder inmediatamente a Stripe
    res.json({ received: true });
  } catch (error: any) {
    console.error('[Stripe Webhook] Error processing webhook:', error);
    res.status(400).json({
      success: false,
      error: 'Webhook processing failed',
      message: error.message
    });
  }
});

/**
 * Manejar pago exitoso
 */
async function handlePaymentIntentSucceeded(paymentIntent: any) {
  console.log(`[Stripe Webhook] Payment succeeded: ${paymentIntent.id}`);

  // Buscar si ya existe un booking con este payment_intent_id
  const existingBooking = await Booking.findOne({
    where: { payment_intent_id: paymentIntent.id }
  });

  if (existingBooking) {
    // Actualizar estado si el booking ya existe
    await existingBooking.update({
      payment_status: 'paid',
      status: 'confirmed'
    });
    console.log(`[Stripe Webhook] Booking ${existingBooking.id} updated to confirmed`);
  } else {
    // Si no existe, puede que el frontend no haya llamado a confirm-payment todavía
    // El booking se creará cuando el frontend llame a /confirm-payment
    console.log(`[Stripe Webhook] No booking found for payment_intent ${paymentIntent.id}, will be created by frontend`);
  }
}

/**
 * Manejar pago fallido
 */
async function handlePaymentIntentFailed(paymentIntent: any) {
  console.log(`[Stripe Webhook] Payment failed: ${paymentIntent.id}`);

  const booking = await Booking.findOne({
    where: { payment_intent_id: paymentIntent.id }
  });

  if (booking) {
    await booking.update({
      payment_status: 'failed',
      status: 'cancelled'
    });
    console.log(`[Stripe Webhook] Booking ${booking.id} marked as failed`);
  }
}

/**
 * Manejar pago cancelado
 */
async function handlePaymentIntentCanceled(paymentIntent: any) {
  console.log(`[Stripe Webhook] Payment canceled: ${paymentIntent.id}`);

  const booking = await Booking.findOne({
    where: { payment_intent_id: paymentIntent.id }
  });

  if (booking) {
    await booking.update({
      payment_status: 'failed',
      status: 'cancelled'
    });
    console.log(`[Stripe Webhook] Booking ${booking.id} marked as cancelled`);
  }
}

/**
 * Manejar reembolso
 */
async function handleChargeRefunded(charge: any) {
  console.log(`[Stripe Webhook] Charge refunded: ${charge.id}`);

  // El charge tiene el payment_intent en charge.payment_intent
  const booking = await Booking.findOne({
    where: { payment_intent_id: charge.payment_intent }
  });

  if (booking) {
    await booking.update({
      payment_status: 'refunded',
      status: 'cancelled'
    });
    console.log(`[Stripe Webhook] Booking ${booking.id} marked as refunded`);
  }
}

export default router;
