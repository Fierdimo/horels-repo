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
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
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

    // Save to user record
    await user.update({ stripe_payment_method_id: paymentMethodId });
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

    // If this was the default, clear it
    if (user.stripe_payment_method_id === paymentMethodId) {
      await user.update({ stripe_payment_method_id: null });
    }
  }

  /**
   * Check if user has payment method configured
   */
  static async hasPaymentMethod(userId: number): Promise<boolean> {
    const user = await User.findByPk(userId);
    return !!user?.stripe_payment_method_id;
  }

  /**
   * Charge user for swap fee
   */
  static async chargeSwapFee(userId: number, amount: number, swapId: number): Promise<string> {
    const user = await User.findByPk(userId);
    if (!user || !user.stripe_customer_id || !user.stripe_payment_method_id) {
      throw new Error('User has no payment method configured');
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'eur',
      customer: user.stripe_customer_id,
      payment_method: user.stripe_payment_method_id,
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
