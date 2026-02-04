import Stripe from 'stripe';
import { User } from '../models';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-12-15.clover' as any, // Use 'as any' to avoid frequent version updates
});

export class PaymentMethodService {
  /**
   * Create or retrieve Stripe customer for user
   */
  static async getOrCreateCustomer(userId: number): Promise<string> {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Return existing customer if available
    if (user.stripe_customer_id) {
      return user.stripe_customer_id;
    }

    // Create new Stripe customer
    const customer = await stripe.customers.create({
      email: user.email,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
      metadata: {
        user_id: userId.toString(),
      },
    });

    // Save customer ID to user
    await user.update({ stripe_customer_id: customer.id });

    return customer.id;
  }

  /**
   * Create Setup Intent for adding payment method
   */
  static async createSetupIntent(userId: number): Promise<{ clientSecret: string; customerId: string }> {
    const customerId = await this.getOrCreateCustomer(userId);

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
    });

    return {
      clientSecret: setupIntent.client_secret!,
      customerId,
    };
  }

  /**
   * Save payment method as default for user
   */
  static async savePaymentMethod(userId: number, paymentMethodId: string): Promise<void> {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const customerId = user.stripe_customer_id;
    if (!customerId) {
      throw new Error('No Stripe customer found');
    }

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    // Set as default payment method
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // V2: Don't store payment_method_id on user, retrieve from Stripe when needed
  }

  /**
   * Get user's payment methods
   */
  static async getPaymentMethods(userId: number): Promise<Stripe.PaymentMethod[]> {
    const user = await User.findByPk(userId);
    if (!user || !user.stripe_customer_id) {
      return [];
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: user.stripe_customer_id,
      type: 'card',
    });

    return paymentMethods.data;
  }

  /**
   * Remove payment method
   */
  static async removePaymentMethod(userId: number, paymentMethodId: string): Promise<void> {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    await stripe.paymentMethods.detach(paymentMethodId);
    // V2: Payment method ID is not stored on user, so no need to clear it
  }

  /**
   * Check if user has payment method configured
   */
  static async hasPaymentMethod(userId: number): Promise<boolean> {
    const user = await User.findByPk(userId);
    if (!user?.stripe_customer_id) {
      return false;
    }
    
    // V2: Check Stripe for payment methods instead of user field
    const paymentMethods = await stripe.paymentMethods.list({
      customer: user.stripe_customer_id,
      type: 'card',
      limit: 1
    });
    
    return paymentMethods.data.length > 0;
  }

  /**
   * Charge user for swap fee
   */
  static async chargeSwapFee(userId: number, amount: number, swapId: number): Promise<string> {
    const user = await User.findByPk(userId);
    if (!user || !user.stripe_customer_id) {
      throw new Error('User has no payment method configured');
    }

    // V2: Get default payment method from Stripe customer
    const customer = await stripe.customers.retrieve(user.stripe_customer_id);
    const defaultPaymentMethod = (customer as any).invoice_settings?.default_payment_method;
    
    if (!defaultPaymentMethod) {
      throw new Error('User has no default payment method configured');
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'eur',
      customer: user.stripe_customer_id,
      payment_method: defaultPaymentMethod,
      off_session: true,
      confirm: true,
      metadata: {
        user_id: userId.toString(),
        swap_id: swapId.toString(),
        type: 'swap_fee',
      },
      description: `Swap fee for swap #${swapId}`,
    });

    return paymentIntent.id;
  }
}
