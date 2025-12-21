import Stripe from 'stripe';
import Booking from '../models/Booking';
import Property from '../models/Property';
import Room from '../models/room';
import User from '../models/User';
import Role from '../models/Role';

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
      userId,
      savePaymentMethod
    } = params;

    // Obtener información de property y room para metadata
    const property = await Property.findByPk(propertyId);

    if (!property) {
      throw new Error('Property not found');
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
        guest_name: guestName,
        guest_email: guestEmail,
        guest_phone: guestPhone || '',
        check_in: checkIn.toISOString(),
        check_out: checkOut.toISOString(),
        nights: nights.toString(),
        price_per_night: pricePerNight.toString()
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
   * Nota: Automáticamente convierte el usuario guest a owner después de la compra
   * Retorna: { booking, user } para que se pueda generar un nuevo token JWT
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

    let updatedUser = null;

    // Convertir guest a owner después de la compra exitosa
    try {
      console.log(`[StripeService] Looking for user with email: ${metadata.guest_email}`);
      
      let guestUser = await User.findOne({
        where: { email: metadata.guest_email },
        include: [{ model: Role }]
      });

      console.log(`[StripeService] User found:`, guestUser ? { id: guestUser.id, email: guestUser.email, roleId: guestUser.role_id } : 'NOT FOUND');

      if (!guestUser) {
        // Si el usuario no existe, crear un usuario guest
        console.log(`[StripeService] Creating new guest user for email: ${metadata.guest_email}`);
        
        try {
          const guestRole = await Role.findOne({ where: { name: 'guest' } });
          console.log(`[StripeService] Guest role:`, guestRole ? { id: guestRole.id, name: guestRole.name } : 'NOT FOUND');
          
          if (!guestRole) {
            throw new Error('Guest role not found in database');
          }

          guestUser = await User.create({
            email: metadata.guest_email,
            password: `temp_${Date.now()}`, // Contraseña temporal
            role_id: guestRole.id,
            status: 'approved', // Aprobar automáticamente los usuarios creados por compra
            firstName: metadata.guest_name?.split(' ')[0] || 'Guest',
            lastName: metadata.guest_name?.split(' ').slice(1).join(' ') || ''
          });

          console.log(`[StripeService] New user created:`, { id: guestUser.id, email: guestUser.email, roleId: guestUser.role_id });

          // Recargar para obtener el Role
          await guestUser.reload({
            include: [{ model: Role }]
          });

          console.log(`[StripeService] New guest user ${guestUser.id} (${guestUser.email}) created from booking`);
        } catch (createError) {
          console.error('[StripeService] Error creating guest user:', createError);
          // Si no podemos crear el usuario, al menos retornar null pero no fallar el booking
          guestUser = null;
        }
      }

      if (guestUser) {
        // Obtener el rol 'owner'
        const ownerRole = await Role.findOne({ where: { name: 'owner' } });
        console.log(`[StripeService] Owner role:`, ownerRole ? { id: ownerRole.id, name: ownerRole.name } : 'NOT FOUND');

        const currentRole = (guestUser as any).Role?.name;
        console.log(`[StripeService] Current user role: ${currentRole}`);

        if (ownerRole && currentRole === 'guest') {
          // Solo convertir si es guest
          console.log(`[StripeService] Converting user ${guestUser.id} from guest to owner`);
          await guestUser.update({ role_id: ownerRole.id });
          
          // Recargar el usuario para obtener el Role actualizado
          await guestUser.reload({
            include: [{ model: Role }]
          });
          
          updatedUser = guestUser;
          console.log(`[StripeService] User ${guestUser.id} (${guestUser.email}) converted from guest to owner after booking payment`);
        } else if (ownerRole) {
          // Si ya es owner o tiene otro rol, retornar de todas formas
          updatedUser = guestUser;
          console.log(`[StripeService] User ${guestUser.id} (${guestUser.email}) already has role: ${currentRole}`);
        }
      }
    } catch (error) {
      console.error('[StripeService] Error in guest to owner conversion:', error);
      // No fallar la operación de booking por este error
    }

    console.log(`[StripeService] Returning updatedUser:`, updatedUser ? { id: updatedUser.id, email: updatedUser.email, role: (updatedUser as any).Role?.name } : 'NULL');

    return { booking, user: updatedUser };
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
