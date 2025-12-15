import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import ConversionService from '../src/services/conversionService';
import LoggingService from '../src/services/loggingService';
import StripeService from '../src/services/stripeService';
import User from '../src/models/User';

// Mock dependencies
vi.mock('../src/services/loggingService', () => ({
  default: {
    logAction: vi.fn(),
  },
}));

vi.mock('../src/services/stripeService', () => ({
  default: {
    createPaymentIntent: vi.fn(),
    confirmPayment: vi.fn(),
  },
}));

vi.mock('../src/models/User', () => ({
  default: {
    findByPk: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
}));

describe('Conversion Service Integration', () => {
  let conversionService: ConversionService;
  let mockStripeService: any;
  let mockUser: any;
  let mockSwapModel: any;
  let mockFeeModel: any;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Get mocked services
    mockStripeService = vi.mocked(StripeService);
    mockUser = vi.mocked(User);

    // Create mock models
    mockSwapModel = {
      create: vi.fn(),
      findAll: vi.fn(),
      findByPk: vi.fn(),
    };

    mockFeeModel = {
      create: vi.fn(),
    };

    // Create service with mocked dependencies
    conversionService = new ConversionService(mockStripeService, mockSwapModel, mockFeeModel);
  });

  describe('Guest to Owner Conversion', () => {
    it('should successfully convert a guest to owner with payment', async () => {
      const userId = 1;
      const mockUserData = {
        id: userId,
        email: 'guest@example.com',
        roleName: 'guest',
        update: vi.fn(),
      };

      const mockPaymentResult = {
        paymentIntentId: 'pi_123',
        clientSecret: 'secret_123',
        amount: 10,
        currency: 'eur',
      };

      const mockConfirmedPayment = {
        paymentIntentId: 'pi_123',
        status: 'succeeded',
        amount: 10,
        currency: 'eur',
      };

      // Mock user lookup
      mockUser.findByPk.mockResolvedValue(mockUserData);

      // Mock payment creation
      mockStripeService.createPaymentIntent.mockResolvedValue(mockPaymentResult);

      // Mock payment confirmation
      mockStripeService.confirmPayment.mockResolvedValue(mockConfirmedPayment);

      // Mock user update
      mockUserData.update.mockResolvedValue({
        ...mockUserData,
        roleName: 'owner',
      });

      const result = await conversionService.convertGuestToOwner(userId);

      expect(mockUser.findByPk).toHaveBeenCalledWith(userId);
      expect(mockStripeService.createPaymentIntent).toHaveBeenCalledWith(10, 'eur', 'swap_fee', { userId, type: 'conversion' });
      expect(mockStripeService.confirmPayment).toHaveBeenCalledWith('pi_123');
      expect(mockUserData.update).toHaveBeenCalledWith({ roleName: 'owner' });

      expect(result).toEqual({
        success: true,
        userId,
        newRole: 'owner',
        paymentId: 'pi_123',
      });

      expect(LoggingService.logAction).toHaveBeenCalledWith({
        action: 'guest_to_owner_conversion',
        details: {
          userId,
          oldRole: 'guest',
          newRole: 'owner',
          paymentId: 'pi_123',
        },
      });
    });

    it('should reject conversion for non-guest users', async () => {
      const userId = 2;
      const mockUserData = {
        id: userId,
        email: 'owner@example.com',
        roleName: 'owner',
      };

      mockUser.findByPk.mockResolvedValue(mockUserData);

      await expect(conversionService.convertGuestToOwner(userId)).rejects.toThrow('User is not a guest');

      expect(mockStripeService.createPaymentIntent).not.toHaveBeenCalled();
    });

    it('should handle payment failure during conversion', async () => {
      const userId = 1;
      const mockUserData = {
        id: userId,
        roleName: 'guest',
        update: vi.fn(),
      };

      mockUser.findByPk.mockResolvedValue(mockUserData);
      mockStripeService.createPaymentIntent.mockRejectedValue(new Error('Payment failed'));

      await expect(conversionService.convertGuestToOwner(userId)).rejects.toThrow('Payment failed');

      expect(mockUserData.update).not.toHaveBeenCalled();
    });

    it('should handle user not found', async () => {
      mockUser.findByPk.mockResolvedValue(null);

      await expect(conversionService.convertGuestToOwner(999)).rejects.toThrow('User not found');
    });
  });

  describe('Swap Creation and Matching', () => {
    it('should create a swap request for a guest', async () => {
      const guestId = 1;
      const propertyId = 'prop_123';
      const checkIn = '2024-07-01';
      const checkOut = '2024-07-05';

      const mockSwap = {
        id: 'swap_123',
        guestId,
        propertyId,
        checkIn,
        checkOut,
        status: 'pending',
        createdAt: new Date(),
      };

      // Mock the swap creation
      mockSwapModel.create.mockResolvedValue(mockSwap);

      const result = await conversionService.createSwapRequest(guestId, propertyId, checkIn, checkOut);

      expect(mockSwapModel.create).toHaveBeenCalledWith({
        guestId,
        propertyId,
        checkIn,
        checkOut,
        status: 'pending',
      });

      expect(result).toEqual(mockSwap);
      expect(LoggingService.logAction).toHaveBeenCalledWith({
        action: 'swap_request_created',
        details: {
          swapId: 'swap_123',
          guestId,
          propertyId,
          checkIn,
          checkOut,
        },
      });
    });

    it('should match available swaps', async () => {
      const propertyId = 'prop_123';
      const checkIn = '2024-07-01';
      const checkOut = '2024-07-05';

      const mockPendingSwaps = [
        {
          id: 'swap_1',
          guestId: 1,
          propertyId,
          checkIn,
          checkOut,
          status: 'pending',
        },
      ];

      const mockAvailableProperties = [
        {
          propertyId,
          available: true,
          date: checkIn,
        },
      ];

      // Mock swap finding and property availability
      mockSwapModel.findAll.mockResolvedValue(mockPendingSwaps);

      const result = await conversionService.findMatchingSwaps(propertyId, checkIn, checkOut);

      expect(mockSwapModel.findAll).toHaveBeenCalledWith({
        where: {
          propertyId,
          checkIn,
          checkOut,
          status: 'pending',
        },
      });

      expect(result).toEqual(mockPendingSwaps);
    });

    it('should complete a swap with payment', async () => {
      const swapId = 'swap_123';
      const mockSwap = {
        id: swapId,
        guestId: 1,
        propertyId: 'prop_123',
        status: 'matched',
        requester_id: 1,
        update: vi.fn().mockResolvedValue({ status: 'completed' }),
      };

      const mockPaymentResult = {
        paymentIntentId: 'pi_456',
        status: 'succeeded',
        amount: 10,
        currency: 'eur',
      };

      // Mock swap lookup
      mockSwapModel.findByPk.mockResolvedValue(mockSwap);

      // Mock payment
      mockStripeService.createPaymentIntent.mockResolvedValue({
        paymentIntentId: 'pi_456',
        clientSecret: 'secret_456',
        amount: 10,
        currency: 'eur',
      });
      mockStripeService.confirmPayment.mockResolvedValue(mockPaymentResult);

      const result = await conversionService.completeSwap(swapId);

      expect(mockSwapModel.findByPk).toHaveBeenCalledWith(swapId, expect.objectContaining({ transaction: expect.anything(), lock: expect.anything() }));
      expect(mockStripeService.createPaymentIntent).toHaveBeenCalledWith(10, 'eur', 'swap_fee', { swapId: swapId, requesterId: 1 });
      expect(mockSwap.update).toHaveBeenCalledWith({ status: 'completed' });

      expect(result).toEqual({
        success: true,
        swapId,
        status: 'completed',
        paymentId: 'pi_456',
      });
    });
  });

  describe('Fee Management', () => {
    it('should calculate swap fees correctly', async () => {
      const fee = await conversionService.calculateSwapFee();

      expect(fee).toBe(10); // €10 fixed fee
    });

    it('should validate fee amounts', async () => {
      expect(await conversionService.isValidFeeAmount(10)).toBe(true);
      expect(await conversionService.isValidFeeAmount(5)).toBe(false);
      expect(await conversionService.isValidFeeAmount(15)).toBe(false);
    });

    it('should track fee payments', async () => {
      const paymentId = 'pi_123';
      const amount = 10;
      const userId = 1;

      // Mock fee tracking
      mockFeeModel.create.mockResolvedValue({
        id: 'fee_123',
        paymentId,
        amount,
        userId,
        type: 'swap_fee',
      });

      const result = await conversionService.recordFeePayment(paymentId, amount, userId, 'swap_fee');

      expect(mockFeeModel.create).toHaveBeenCalledWith({
        paymentId,
        amount,
        userId,
        type: 'swap_fee',
        status: 'completed',
      });

      expect(result).toEqual({
        id: 'fee_123',
        paymentId,
        amount,
        userId,
        type: 'swap_fee',
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockUser.findByPk.mockRejectedValue(new Error('Database error'));

      await expect(conversionService.convertGuestToOwner(1)).rejects.toThrow('Database error');

      expect(LoggingService.logAction).toHaveBeenCalledWith({
        action: 'conversion_error',
        details: {
          userId: 1,
          error: 'Database error',
        },
      });
    });

    it('should handle concurrent conversion attempts', async () => {
      const userId = 1;
      const mockUserData = {
        id: userId,
        roleName: 'guest',
        update: vi.fn().mockRejectedValue(new Error('Concurrent update')),
      };

      mockUser.findByPk.mockResolvedValue(mockUserData);

      await expect(conversionService.convertGuestToOwner(userId)).rejects.toThrow('Concurrent update');
    });
  });
});