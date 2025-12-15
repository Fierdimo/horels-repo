import Stripe from 'stripe';
import Booking from '../models/Booking';
import Property from '../models/Property';
import Room from '../models/room';
import User from '../models/User';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-11-17.clover'
});

interface CreatePaymentIntentParams {
  propertyId: number;
  roomId: number;
  checkIn: Date;
  checkOut: Date;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  totalAmount: number;
  nights: number;
  pricePerNight: number;
}

export class StripeService {
  /**
   * Obtener o crear Stripe Customer para un usuario
   */
  async getOrCreateCustomer(userId: number, email: string, name?: string): Promise<string> {
    const user = await User.findByPk(userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    // Si ya tiene customer ID, devolverlo
    if (user.stripe_customer_id) {
      return user.stripe_customer_id;
    }

    // Crear nuevo customer en Stripe
    const customer = await stripe.customers.create({
      email,
      name: name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || email,
      metadata: {
        user_id: userId.toString()
      }
    });

    // Guardar customer ID en la base de datos
    await user.update({ stripe_customer_id: customer.id });

    return customer.id;
  }

  /**
   * Obtener métodos de pago guardados de un usuario
   */
  async getPaymentMethods(userId: number): Promise<Stripe.PaymentMethod[]> {
    const user = await User.findByPk(userId);
    
    if (!user || !user.stripe_customer_id) {
      return [];
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: user.stripe_customer_id,
      type: 'card'
    });

    return paymentMethods.data;
  }

  /**
   * Crear Payment Intent para booking de marketplace
   */
  async createMarketplacePaymentIntent(params: CreatePaymentIntentParams & { userId?: number; savePaymentMethod?: boolean }) {
    const {
      propertyId,
      roomId,
      checkIn,
      checkOut,
      guestName,
      guestEmail,
      guestPhone,
      totalAmount,
      nights,
      pricePerNight,
      userId,
      savePaymentMethod
    } = params;

    // Obtener información de property y room para metadata
    const property = await Property.findByPk(propertyId);
    const room = await Room.findByPk(roomId);

    if (!property || !room) {
      throw new Error('Property or room not found');
    }

    // Obtener o crear customer si el usuario está autenticado
    let customerId: string | undefined;
    if (userId) {
      try {
        customerId = await this.getOrCreateCustomer(userId, guestEmail, guestName);
      } catch (error) {
        console.error('Error creating customer:', error);
        // Continuar sin customer si falla
      }
    }

    // Configuración del Payment Intent
    const paymentIntentConfig: Stripe.PaymentIntentCreateParams = {
      amount: Math.round(totalAmount * 100), // Stripe usa centavos
      currency: 'eur',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        type: 'marketplace_booking',
        property_id: propertyId.toString(),
        property_name: property.name,
        room_id: roomId.toString(),
        room_name: room.name,
        guest_name: guestName,
        guest_email: guestEmail,
        guest_phone: guestPhone || '',
        check_in: checkIn.toISOString(),
        check_out: checkOut.toISOString(),
        nights: nights.toString(),
        price_per_night: pricePerNight.toString()
      },
      description: `Marketplace Booking - ${property.name} - ${room.name} (${nights} nights)`,
      receipt_email: guestEmail,
    };

    // Agregar customer si existe
    if (customerId) {
      paymentIntentConfig.customer = customerId;
      
      // Si el usuario quiere guardar el método de pago
      if (savePaymentMethod) {
        paymentIntentConfig.setup_future_usage = 'off_session';
      }
    }

    // Crear Payment Intent
    const paymentIntent = await stripe.paymentIntents.create(paymentIntentConfig);

    return paymentIntent;
  }

  /**
   * Confirmar booking después de pago exitoso
   */
  async confirmBookingPayment(paymentIntentId: string) {
    // Obtener Payment Intent de Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      throw new Error('Payment has not succeeded');
    }

    const metadata = paymentIntent.metadata;

    // Crear el booking en la base de datos
    const guestToken = `gt_marketplace_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    const booking = await Booking.create({
      property_id: parseInt(metadata.property_id),
      room_id: parseInt(metadata.room_id),
      guest_name: metadata.guest_name,
      guest_email: metadata.guest_email,
      guest_phone: metadata.guest_phone || null,
      check_in: new Date(metadata.check_in),
      check_out: new Date(metadata.check_out),
      room_type: 'Standard', // Podemos mejorar esto obteniendo el tipo real
      status: 'confirmed', // Estado confirmado porque el pago ya se procesó
      guest_token: guestToken,
      total_amount: paymentIntent.amount / 100, // Convertir de centavos a euros
      currency: paymentIntent.currency.toUpperCase(),
      payment_intent_id: paymentIntentId,
      payment_status: 'paid'
    });

    return booking;
  }

  /**
   * Obtener detalles de un Payment Intent
   */
  async getPaymentIntent(paymentIntentId: string) {
    return await stripe.paymentIntents.retrieve(paymentIntentId);
  }

  /**
   * Confirmar Payment Intent con método de pago guardado
   */
  async confirmPaymentWithSavedMethod(paymentIntentId: string, paymentMethodId: string) {
    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethodId,
      return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/marketplace/booking-success`
    });

    return paymentIntent;
  }

  /**
   * Cancelar Payment Intent
   */
  async cancelPaymentIntent(paymentIntentId: string) {
    return await stripe.paymentIntents.cancel(paymentIntentId);
  }

  /**
   * Crear refund para un booking
   */
  async createRefund(paymentIntentId: string, amount?: number, currency?: string, reason?: string) {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amount ? Math.round(amount * 100) : undefined, // Si no se especifica monto, se reembolsa todo
      reason: reason as Stripe.RefundCreateParams.Reason || undefined
    });

    return refund;
  }

  /**
   * Crear Payment Intent genérico (para compatibilidad con stripeController)
   */
  async createPaymentIntent(
    amount: number, 
    currency: string = 'eur', 
    type: string = 'booking',
    metadata: Record<string, string> = {}
  ) {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: currency.toLowerCase(),
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        type,
        ...metadata
      }
    });

    return paymentIntent;
  }

  /**
   * Confirmar un Payment Intent (para compatibilidad con stripeController)
   */
  async confirmPayment(paymentIntentId: string) {
    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId);
    return paymentIntent;
  }

  /**
   * Cancelar Payment (alias para cancelPaymentIntent)
   */
  async cancelPayment(paymentIntentId: string) {
    return await this.cancelPaymentIntent(paymentIntentId);
  }

  /**
   * Manejar webhook (alias para verifyWebhookSignature)
   */
  async handleWebhook(payload: string | Buffer, signature: string): Promise<Stripe.Event> {
    return this.verifyWebhookSignature(payload, signature);
  }

  /**
   * Verificar webhook signature
   */
  verifyWebhookSignature(payload: string | Buffer, signature: string): Stripe.Event {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      throw new Error('Stripe webhook secret not configured');
    }

    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }
}

export const stripeService = new StripeService();
