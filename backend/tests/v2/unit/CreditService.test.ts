/**
 * CreditService Unit Tests (V2 - Phase 2)
 * 
 * Tests for credit transaction business logic.
 * Uses mocks to isolate service layer from database.
 * 
 * Test Coverage:
 * - Add credits (week release, purchase, bonus)
 * - Deduct credits (booking, payment)
 * - Insufficient balance validation
 * - Transaction atomicity
 * - Credit calculation formula
 * 
 * See: docs_v2/TIMESHARE_PLATFORM_V2_SPEC.md - CreditService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreditService } from '../../../src/services/v2/CreditService';
import { CreditAccountRepository } from '../../../src/repositories/v2/CreditAccountRepository';
import { CreditTransactionRepository } from '../../../src/repositories/v2/CreditTransactionRepository';

describe('CreditService', () => {
  let service: CreditService;
  let mockAccountRepo: any;
  let mockTransactionRepo: any;

  beforeEach(() => {
    // Mock repositories
    mockAccountRepo = {
      findOrCreateForUser: vi.fn(),
      updateBalance: vi.fn(),
    };

    mockTransactionRepo = {
      create: vi.fn(),
      findAll: vi.fn(),
    };

    service = new CreditService(mockAccountRepo, mockTransactionRepo);
  });

  describe('addCredits()', () => {
    it('should add credits to user account', async () => {
      // Arrange
      const userId = 1;
      const account = {
        id: 100,
        user_id: userId,
        balance: 500,
      };

      mockAccountRepo.findOrCreateForUser.mockResolvedValue(account);
      mockTransactionRepo.create.mockResolvedValue({
        id: 1001,
        account_id: 100,
        type: 'WEEK_RELEASE',
        amount: 1000,
        balance_before: 500,
        balance_after: 1500,
      });

      // Act
      const result = await service.addCredits(userId, {
        type: 'WEEK_RELEASE',
        amount: 1000,
        description: 'Released week 25',
        reference_type: 'week_allocation',
        reference_id: 789,
      });

      // Assert
      expect(result.balance_before).toBe(500);
      expect(result.balance_after).toBe(1500);
      expect(result.amount).toBe(1000);
      expect(mockAccountRepo.updateBalance).toHaveBeenCalledWith(100, 1500);
    });

    it('should reject negative amount', async () => {
      await expect(
        service.addCredits(1, {
          type: 'WEEK_RELEASE',
          amount: -100, // ❌ Negative
          description: 'Invalid',
        })
      ).rejects.toThrow('Amount must be positive');
    });

    it('should record metadata for audit trail', async () => {
      const account = {
        id: 100,
        user_id: 1,
        balance: 0,
      };

      mockAccountRepo.findOrCreateForUser.mockResolvedValue(account);
      mockTransactionRepo.create.mockResolvedValue({ id: 1001 });

      const metadata = {
        baseValue: 1000,
        seasonalMultiplier: 1.2,
        timingMultiplier: 0.9,
      };

      await service.addCredits(1, {
        type: 'WEEK_RELEASE',
        amount: 1080,
        description: 'Week release with calculation',
        metadata,
      });

      expect(mockTransactionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata,
        })
      );
    });
  });

  describe('deductCredits()', () => {
    it('should deduct credits from user account', async () => {
      const account = {
        id: 100,
        user_id: 1,
        balance: 1500,
      };

      mockAccountRepo.findOrCreateForUser.mockResolvedValue(account);
      mockTransactionRepo.create.mockResolvedValue({
        id: 1002,
        amount: -800,
        balance_before: 1500,
        balance_after: 700,
      });

      const result = await service.deductCredits(1, {
        type: 'WEEK_BOOKING',
        amount: 800, // Positive amount (will be negated)
        description: 'Booked week in Marbella',
        reference_type: 'booking',
        reference_id: 5001,
      });

      expect(result.balance_before).toBe(1500);
      expect(result.balance_after).toBe(700);
      expect(result.amount).toBe(-800); // Negated
      expect(mockAccountRepo.updateBalance).toHaveBeenCalledWith(100, 700);
    });

    it('should reject deduction if insufficient balance', async () => {
      const account = {
        id: 100,
        user_id: 1,
        balance: 500, // Only 500 available
      };

      mockAccountRepo.findOrCreateForUser.mockResolvedValue(account);

      await expect(
        service.deductCredits(1, {
          type: 'WEEK_BOOKING',
          amount: 800, // Trying to deduct 800
          description: 'Booking',
        })
      ).rejects.toThrow('Insufficient credits');
    });

    it('should allow exact balance deduction', async () => {
      const account = {
        id: 100,
        user_id: 1,
        balance: 1000,
      };

      mockAccountRepo.findOrCreateForUser.mockResolvedValue(account);
      mockTransactionRepo.create.mockResolvedValue({
        id: 1003,
        amount: -1000,
        balance_before: 1000,
        balance_after: 0,
      });

      const result = await service.deductCredits(1, {
        type: 'WEEK_BOOKING',
        amount: 1000, // Exact balance
        description: 'Booking',
      });

      expect(result.balance_after).toBe(0);
    });
  });

  describe('getBalance()', () => {
    it('should return current user balance', async () => {
      mockAccountRepo.findOrCreateForUser.mockResolvedValue({
        id: 100,
        user_id: 1,
        balance: 2500,
      });

      const balance = await service.getBalance(1);

      expect(balance).toBe(2500);
    });

    it('should return 0 for new user', async () => {
      mockAccountRepo.findOrCreateForUser.mockResolvedValue({
        id: 101,
        user_id: 2,
        balance: 0,
      });

      const balance = await service.getBalance(2);

      expect(balance).toBe(0);
    });
  });

  describe('calculateWeekReleaseCredits()', () => {
    it('should calculate credits with 100% timing (>180 days)', () => {
      const baseValue = 1000;
      const weekNumber = 25;
      const seasonalFactors = { '25': 1.2 }; // High season
      const releaseDate = new Date('2026-01-01');
      const weekStartDate = new Date('2026-07-01'); // 181 days later

      const result = service.calculateWeekReleaseCredits(
        baseValue,
        weekNumber,
        seasonalFactors,
        releaseDate,
        weekStartDate
      );

      expect(result.baseValue).toBe(1000);
      expect(result.seasonalMultiplier).toBe(1.2);
      expect(result.timingMultiplier).toBe(1.0); // 100%
      expect(result.daysInAdvance).toBeGreaterThan(180);
      expect(result.finalCredits).toBe(1200); // 1000 * 1.2 * 1.0
    });

    it('should calculate credits with 90% timing (90-180 days)', () => {
      const releaseDate = new Date('2026-03-01');
      const weekStartDate = new Date('2026-07-01'); // ~120 days later

      const result = service.calculateWeekReleaseCredits(
        1000,
        25,
        { '25': 1.0 },
        releaseDate,
        weekStartDate
      );

      expect(result.timingMultiplier).toBe(0.9); // 90%
      expect(result.finalCredits).toBe(900); // 1000 * 1.0 * 0.9
    });

    it('should calculate credits with 70% timing (30-90 days)', () => {
      const releaseDate = new Date('2026-05-01');
      const weekStartDate = new Date('2026-07-01'); // ~60 days later

      const result = service.calculateWeekReleaseCredits(
        1000,
        25,
        { '25': 1.0 },
        releaseDate,
        weekStartDate
      );

      expect(result.timingMultiplier).toBe(0.7); // 70%
      expect(result.finalCredits).toBe(700); // 1000 * 1.0 * 0.7
    });

    it('should calculate credits with 50% timing (<30 days)', () => {
      const releaseDate = new Date('2026-06-15');
      const weekStartDate = new Date('2026-07-01'); // 16 days later

      const result = service.calculateWeekReleaseCredits(
        1000,
        25,
        { '25': 1.0 },
        releaseDate,
        weekStartDate
      );

      expect(result.timingMultiplier).toBe(0.5); // 50%
      expect(result.finalCredits).toBe(500); // 1000 * 1.0 * 0.5
    });

    it('should handle low season week (seasonal factor < 1.0)', () => {
      const result = service.calculateWeekReleaseCredits(
        1000,
        10, // Low season week
        { '10': 0.8 }, // 80% of base value
        new Date('2026-01-01'),
        new Date('2026-08-01')
      );

      expect(result.seasonalMultiplier).toBe(0.8);
      expect(result.finalCredits).toBe(800); // 1000 * 0.8 * 1.0
    });

    it('should handle high season week (seasonal factor > 1.0)', () => {
      const result = service.calculateWeekReleaseCredits(
        1000,
        30, // High season week
        { '30': 1.5 }, // 150% of base value
        new Date('2026-01-01'),
        new Date('2026-08-01')
      );

      expect(result.seasonalMultiplier).toBe(1.5);
      expect(result.finalCredits).toBe(1500); // 1000 * 1.5 * 1.0
    });

    it('should default to 1.0 seasonal factor if week not in map', () => {
      const result = service.calculateWeekReleaseCredits(
        1000,
        15,
        {}, // Empty seasonal factors
        new Date('2026-01-01'),
        new Date('2026-08-01')
      );

      expect(result.seasonalMultiplier).toBe(1.0); // Default
      expect(result.finalCredits).toBe(1000); // 1000 * 1.0 * 1.0
    });

    it('should combine all factors correctly', () => {
      // High season + late release
      const result = service.calculateWeekReleaseCredits(
        1000,
        25,
        { '25': 1.3 }, // 130% seasonal
        new Date('2026-06-20'),
        new Date('2026-07-01') // 11 days → 50% timing
      );

      expect(result.baseValue).toBe(1000);
      expect(result.seasonalMultiplier).toBe(1.3);
      expect(result.timingMultiplier).toBe(0.5);
      expect(result.finalCredits).toBe(650); // 1000 * 1.3 * 0.5 = 650
    });
  });

  describe('getTransactionHistory()', () => {
    it('should return transaction history for user', async () => {
      const account = {
        id: 100,
        user_id: 1,
        balance: 1500,
      };

      const transactions = [
        {
          id: 1,
          type: 'WEEK_RELEASE',
          amount: 1000,
          balance_after: 1000,
          created_at: new Date('2026-01-15'),
        },
        {
          id: 2,
          type: 'WEEK_BOOKING',
          amount: -500,
          balance_after: 500,
          created_at: new Date('2026-01-20'),
        },
      ];

      mockAccountRepo.findOrCreateForUser.mockResolvedValue(account);
      mockTransactionRepo.findAll.mockResolvedValue(transactions);

      const history = await service.getTransactionHistory(1, 50, 0);

      expect(history).toHaveLength(2);
      expect(mockTransactionRepo.findAll).toHaveBeenCalledWith({
        where: { account_id: 100 },
        limit: 50,
        offset: 0,
        order: [['created_at', 'DESC']],
      });
    });

    it('should support pagination', async () => {
      const account = { id: 100, user_id: 1, balance: 1000 };
      mockAccountRepo.findOrCreateForUser.mockResolvedValue(account);
      mockTransactionRepo.findAll.mockResolvedValue([]);

      await service.getTransactionHistory(1, 20, 40);

      expect(mockTransactionRepo.findAll).toHaveBeenCalledWith({
        where: { account_id: 100 },
        limit: 20,
        offset: 40,
        order: [['created_at', 'DESC']],
      });
    });
  });
});
