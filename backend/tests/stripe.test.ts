import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import StripeService from '../src/services/stripeService';
import LoggingService from '../src/services/loggingService';

// Mock Stripe
vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    paymentIntents: {
      create: vi.fn(),
      retrieve: vi.fn(),
      confirm: vi.fn(),
      cancel: vi.fn(),
    },
    webhooks: {
      constructEvent: vi.fn(),
    },
    refunds: {
      create: vi.fn(),
    },
  })),
}));

// Mock LoggingService
vi.mock('../src/services/loggingService', () => ({
  default: {
    logAction: vi.fn(),
  },
}));

describe('Stripe Service Integration', () => {
  let stripeService: StripeService;
  let mockStripe: any;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Create mock Stripe instance
    mockStripe = {
      paymentIntents: {
        create: vi.fn(),
        retrieve: vi.fn(),
        confirm: vi.fn(),
        cancel: vi.fn(),
      },
      webhooks: {
        constructEvent: vi.fn(),
      },
      refunds: {
        create: vi.fn(),
      },
    };

    // Create service with mocked Stripe
    stripeService = new StripeService(mockStripe);
  });

  describe('Payment Intent Creation', () => {
    it('should create a payment intent for swap fee (€10) with extra fee', async () => {
      const mockPaymentIntent = {
        id: 'pi_123',
        client_secret: 'secret_123',
        amount: 1050, // €10 + 5% fee = €10.50 in cents
        currency: 'eur',
        status: 'requires_payment_method',
      };

      mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent);

      // Simular el middleware: monto original 10, fee 0.5, total 10.5
      const originalAmount = 10;
      const extraFee = 0.5;
      const amountWithFee = 10.5;

      const result = await stripeService.createPaymentIntent(amountWithFee, 'eur', 'swap_fee', { userId: 1, bookingId: 'b123', originalAmount, extraFee });

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 1050,
        currency: 'eur',
        metadata: {
          type: 'swap_fee',
          userId: 1,
          bookingId: 'b123',
          originalAmount,
          extraFee
        },
      });

      expect(result).toEqual({
        paymentIntentId: 'pi_123',
        clientSecret: 'secret_123',
        amount: amountWithFee,
        currency: 'eur',
      });

      expect(LoggingService.logAction).toHaveBeenCalledWith({
        action: 'stripe_payment_intent_created',
        details: {
          paymentIntentId: 'pi_123',
          amount: amountWithFee,
          currency: 'eur',
          type: 'swap_fee',
          metadata: { userId: 1, bookingId: 'b123', originalAmount, extraFee },
        },
      });
    });

    it('should create a payment intent for hotel payment with extra fee', async () => {
      const mockPaymentIntent = {
        id: 'pi_456',
        client_secret: 'secret_456',
        amount: 21000, // €200 + 5% fee = €210 in cents
        currency: 'eur',
        status: 'requires_payment_method',
      };

      mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent);

      // Simular el middleware: monto original 200, fee 10, total 210
      const originalAmount = 200;
      const extraFee = 10;
      const amountWithFee = 210;

      const result = await stripeService.createPaymentIntent(amountWithFee, 'eur', 'hotel_payment', { propertyId: 'p123', guestEmail: 'guest@example.com', originalAmount, extraFee });

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 21000,
        currency: 'eur',
        metadata: {
          type: 'hotel_payment',
          propertyId: 'p123',
          guestEmail: 'guest@example.com',
          originalAmount,
          extraFee
        },
      });

      expect(result).toEqual({
        paymentIntentId: 'pi_456',
        clientSecret: 'secret_456',
        amount: amountWithFee,
        currency: 'eur',
      });
    });

    it('should handle Stripe API errors', async () => {
      mockStripe.paymentIntents.create.mockRejectedValue(new Error('Stripe API Error'));

      await expect(stripeService.createPaymentIntent(10, 'eur', 'swap_fee')).rejects.toThrow('Payment creation failed: Stripe API Error');

      expect(LoggingService.logAction).toHaveBeenCalledWith({
        action: 'stripe_payment_error',
        details: {
          operation: 'createPaymentIntent',
          amount: 10,
          currency: 'eur',
          type: 'swap_fee',
          error: 'Stripe API Error',
        },
      });
    });
  });

  describe('Payment Confirmation', () => {
    it('should confirm a payment intent', async () => {
      const mockPaymentIntent = {
        id: 'pi_123',
        status: 'succeeded',
        amount: 1000,
        currency: 'eur',
      };

      mockStripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent);

      const result = await stripeService.confirmPayment('pi_123');

      expect(mockStripe.paymentIntents.retrieve).toHaveBeenCalledWith('pi_123');
      expect(result).toEqual({
        paymentIntentId: 'pi_123',
        status: 'succeeded',
        amount: 10,
        currency: 'eur',
      });

      expect(LoggingService.logAction).toHaveBeenCalledWith({
        action: 'stripe_payment_confirmed',
        details: {
          paymentIntentId: 'pi_123',
          status: 'succeeded',
          amount: 10,
          currency: 'eur',
        },
      });
    });

    it('should handle failed payments', async () => {
      const mockPaymentIntent = {
        id: 'pi_123',
        status: 'requires_payment_method',
        last_payment_error: { message: 'Card declined' },
      };

      mockStripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent);

      await expect(stripeService.confirmPayment('pi_123')).rejects.toThrow('Payment failed: Card declined');
    });
  });

  describe('Webhook Handling', () => {
    it('should process payment succeeded webhook', async () => {
      const webhookEvent = {
        id: 'evt_123',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_123',
            amount: 1000,
            currency: 'eur',
            metadata: { type: 'swap_fee', userId: '1' },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(webhookEvent);

      const result = await stripeService.handleWebhook('payload', 'signature', 'secret');

      expect(result).toBe(true);
      expect(LoggingService.logAction).toHaveBeenCalledWith({
        action: 'stripe_webhook_payment_succeeded',
        details: {
          paymentIntentId: 'pi_123',
          amount: 10,
          currency: 'eur',
          metadata: { type: 'swap_fee', userId: '1' },
        },
      });
    });

    it('should process payment failed webhook', async () => {
      const webhookEvent = {
        id: 'evt_456',
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_456',
            amount: 1000,
            currency: 'eur',
            last_payment_error: { message: 'Insufficient funds' },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(webhookEvent);

      const result = await stripeService.handleWebhook('payload', 'signature', 'secret');

      expect(result).toBe(true);
      expect(LoggingService.logAction).toHaveBeenCalledWith({
        action: 'stripe_webhook_payment_failed',
        details: {
          paymentIntentId: 'pi_456',
          amount: 10,
          currency: 'eur',
          error: 'Insufficient funds',
        },
      });
    });

    it('should ignore unsupported webhook events', async () => {
      const webhookEvent = {
        id: 'evt_789',
        type: 'customer.created',
        data: { object: {} },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(webhookEvent);

      const result = await stripeService.handleWebhook('payload', 'signature', 'secret');

      expect(result).toBe(true);
      expect(LoggingService.logAction).not.toHaveBeenCalled();
    });

    it('should handle invalid webhook signatures', async () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      await expect(stripeService.handleWebhook('payload', 'invalid_signature', 'secret')).rejects.toThrow('Invalid signature');
    });
  });

  describe('Refund Processing', () => {
    it('should create a refund', async () => {
      const mockRefund = {
        id: 'ref_123',
        amount: 1000,
        currency: 'eur',
        status: 'succeeded',
      };

      mockStripe.refunds.create.mockResolvedValue(mockRefund);

      const result = await stripeService.createRefund('pi_123', 10, 'eur', 'Customer request');

      expect(mockStripe.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_123',
        amount: 1000,
        reason: 'requested_by_customer',
        metadata: { reason: 'Customer request' },
      });

      expect(result).toEqual({
        refundId: 'ref_123',
        amount: 10,
        currency: 'eur',
        status: 'succeeded',
      });

      expect(LoggingService.logAction).toHaveBeenCalledWith({
        action: 'stripe_refund_created',
        details: {
          refundId: 'ref_123',
          paymentIntentId: 'pi_123',
          amount: 10,
          currency: 'eur',
          reason: 'Customer request',
        },
      });
    });

    it('should handle refund errors', async () => {
      mockStripe.refunds.create.mockRejectedValue(new Error('Refund failed'));

      await expect(stripeService.createRefund('pi_123', 10, 'eur')).rejects.toThrow('Refund creation failed: Refund failed');
    });
  });

  describe('Payment Cancellation', () => {
    it('should cancel a payment intent', async () => {
      const mockPaymentIntent = {
        id: 'pi_123',
        status: 'canceled',
      };

      mockStripe.paymentIntents.cancel.mockResolvedValue(mockPaymentIntent);

      const result = await stripeService.cancelPayment('pi_123');

      expect(mockStripe.paymentIntents.cancel).toHaveBeenCalledWith('pi_123');
      expect(result).toBe(true);

      expect(LoggingService.logAction).toHaveBeenCalledWith({
        action: 'stripe_payment_cancelled',
        details: { paymentIntentId: 'pi_123' },
      });
    });
  });
});