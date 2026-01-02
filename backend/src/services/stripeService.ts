import Stripe from 'stripe';
import Booking from '../models/Booking';
import Property from '../models/Property';
import Room from '../models/room';
import User from '../models/User';
import Role from '../models/Role';
import RoomEnrichmentService from './roomEnrichmentService';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

interface CreatePaymentIntentParams {
  propertyId: number;
  roomId: number;
  roomName?: string;
  checkIn: Date;
  checkOut: Date;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  totalAmount: number;
  nights: number;
  pricePerNight: number;
  platformFeePercentage?: number;
  platformFeeAmount?: number;
  subtotal?: number;
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
      roomName,
      checkIn,
      checkOut,
      guestName,
      guestEmail,
      guestPhone,
      totalAmount,
      nights,
      pricePerNight,
      platformFeePercentage,
      platformFeeAmount,
      subtotal,
      userId,
      savePaymentMethod
    } = params;

    // Obtener información de property y room para metadata
    const property = await Property.findByPk(propertyId);

    if (!property) {
      throw new Error('Property not found');
    }

    // Obtener información de la habitación para el room_type
    const { Room } = await import('../models');
    const room = await Room.findByPk(roomId);
    let roomType = 'Standard'; // Default fallback
    
    if (room) {
      // Intentar obtener el room_type desde RoomEnrichmentService
      try {
        const enrichedRoom = await RoomEnrichmentService.enrichRoom(room);
        roomType = enrichedRoom.type || enrichedRoom.name || 'Standard';
      } catch (error) {
        console.warn('Could not enrich room for room_type, using default:', error);
      }
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
        room_name: roomName || `Room ${roomId}`,
        room_type: roomType,
        guest_name: guestName,
        guest_email: guestEmail,
        guest_phone: guestPhone || '',
        check_in: checkIn.toISOString(),
        check_out: checkOut.toISOString(),
        nights: nights.toString(),
        price_per_night: pricePerNight.toString(),
        platform_fee_percentage: platformFeePercentage?.toString() || '0',
        platform_fee_amount: platformFeeAmount?.toString() || '0',
        subtotal: subtotal?.toString() || totalAmount.toString()
      },
      description: `Marketplace Booking - ${property.name} - ${roomName || `Room ${roomId}`} (${nights} nights)`,
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
   * Nota: Guest permanece como guest. Solo se convierte a owner mediante compra de propiedad/timeshare.
   * Retorna: { booking, user } - user puede ser null si no está registrado
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
      room_type: metadata.room_type || 'Standard',
      status: 'confirmed',
      guest_token: guestToken,
      total_amount: paymentIntent.amount / 100, // Convertir de centavos a euros
      currency: paymentIntent.currency.toUpperCase(),
      payment_intent_id: paymentIntentId,
      payment_status: 'paid',
      platform_fee_percentage: parseFloat(metadata.platform_fee_percentage || '0'),
      platform_fee_amount: parseFloat(metadata.platform_fee_amount || '0')
    });

    let userRecord = null;

    // Buscar o crear usuario guest (NO convertir a owner)
    try {
      console.log(`[StripeService] Looking for user with email: ${metadata.guest_email}`);
      
      let guestUser = await User.findOne({
        where: { email: metadata.guest_email },
        include: [{ model: Role }]
      });

      if (!guestUser) {
        // Si el usuario no existe, crear un usuario guest
        console.log(`[StripeService] Creating new guest user for email: ${metadata.guest_email}`);
        
        const guestRole = await Role.findOne({ where: { name: 'guest' } });
          
        if (!guestRole) {
          throw new Error('Guest role not found in database');
        }

        guestUser = await User.create({
          email: metadata.guest_email,
          password: `temp_${Date.now()}`, // Contraseña temporal
          role_id: guestRole.id,
          status: 'approved',
          firstName: metadata.guest_name?.split(' ')[0] || 'Guest',
          lastName: metadata.guest_name?.split(' ').slice(1).join(' ') || ''
        });

        await guestUser.reload({ include: [{ model: Role }] });
        console.log(`[StripeService] New guest user ${guestUser.id} (${guestUser.email}) created from booking`);
      } else {
        console.log(`[StripeService] User ${guestUser.id} found with role: ${(guestUser as any).Role?.name}`);
      }

      userRecord = guestUser;
    } catch (error) {
      console.error('[StripeService] Error managing user record:', error);
      // No fallar la operación de booking por este error
    }

    console.log(`[StripeService] Booking created. User:`, userRecord ? { id: userRecord.id, email: userRecord.email, role: (userRecord as any).Role?.name } : 'NULL');

    return { booking, user: userRecord };
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
    // 1. Obtener el payment method para extraer el customer
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    
    if (!paymentMethod.customer) {
      throw new Error('Payment method does not have an associated customer');
    }

    const customerId = typeof paymentMethod.customer === 'string' 
      ? paymentMethod.customer 
      : paymentMethod.customer.id;

    // 2. Actualizar el PaymentIntent para incluir el customer
    await stripe.paymentIntents.update(paymentIntentId, {
      customer: customerId
    });

    // 3. Confirmar el PaymentIntent con el payment method
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
   * Crear Payment Intent para swap fee
   */
  async createSwapFeePaymentIntent(
    userId: number,
    swapId: number,
    requesterWeekId: number,
    amount: number = 10.00, // €10 swap fee
    email?: string
  ) {
    const user = await User.findByPk(userId);

    if (!user) {
      throw new Error('User not found');
    }

    // Get or create customer
    const customerId = await this.getOrCreateCustomer(userId, email || user.email);

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      customer: customerId,
      amount: Math.round(amount * 100), // Convert to cents (€10 = 1000 cents)
      currency: 'eur',
      description: `Swap fee for week ${requesterWeekId}`,
      metadata: {
        type: 'swap_fee',
        swap_id: swapId.toString(),
        week_id: requesterWeekId.toString(),
        user_id: userId.toString()
      },
      automatic_payment_methods: {
        enabled: true
      }
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: amount,
      currency: 'EUR',
      status: paymentIntent.status
    };
  }

  /**
   * Confirmar swap fee payment
   */
  async confirmSwapFeePayment(paymentIntentId: string, swapId: number) {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      throw new Error(`Payment not succeeded. Status: ${paymentIntent.status}`);
    }

    if (paymentIntent.metadata.swap_id !== swapId.toString()) {
      throw new Error('Payment intent does not match swap ID');
    }

    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency.toUpperCase()
    };
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
