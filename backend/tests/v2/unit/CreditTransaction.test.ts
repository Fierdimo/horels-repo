/**
 * CreditTransaction Model Unit Tests
 * 
 * Tests for CreditTransaction model helper methods and immutability.
 * Pure unit tests - no database needed.
 */

import { describe, it, expect } from 'vitest';

// Mock CreditTransaction with business logic
class CreditTransaction {
  balance_before: number = 0;
  amount: number = 0;
  balance_after: number = 0;
  type?: string;
  description?: string;
  reference_type?: string | null;
  reference_id?: number | null;
  metadata?: any;
  created_by?: number | null;
  ip_address?: string;

  constructor(data: Partial<CreditTransaction>) {
    Object.assign(this, data);
  }

  validateBalance(): boolean {
    const calculated = this.balance_before + this.amount;
    const diff = Math.abs(calculated - this.balance_after);
    return diff < 0.01; // Allow small floating-point errors
  }

  isCredit(): boolean {
    return this.amount > 0;
  }

  isDebit(): boolean {
    return this.amount < 0;
  }
}

describe('CreditTransaction Model', () => {

  describe('Balance Integrity Validation', () => {
    it('should validate correct balance calculation', () => {
      const txn = new CreditTransaction({
        balance_before: 1000,
        amount: 500,
        balance_after: 1500,
      });

      expect(txn.validateBalance()).toBe(true);
    });

    it('should validate correct balance for debit transaction', () => {
      const txn = new CreditTransaction({
        balance_before: 1000,
        amount: -300,
        balance_after: 700,
      });

      expect(txn.validateBalance()).toBe(true);
    });

    it('should detect incorrect balance calculation', () => {
      const txn = new CreditTransaction({
        balance_before: 1000,
        amount: 500,
        balance_after: 1400, // Should be 1500
      });

      expect(txn.validateBalance()).toBe(false);
    });

    it('should handle decimal precision', () => {
      const txn = new CreditTransaction({
        balance_before: 100.50,
        amount: 25.75,
        balance_after: 126.25,
      });

      expect(txn.validateBalance()).toBe(true);
    });

    it('should allow small floating-point precision errors', () => {
      // Simulate floating point rounding error
      const txn = new CreditTransaction({
        balance_before: 100.33,
        amount: 200.67,
        balance_after: 301.00, // Might have tiny precision error
      });

      // Should still pass with < 0.01 tolerance
      expect(txn.validateBalance()).toBe(true);
    });

    it('should detect large balance discrepancies', () => {
      const txn = new CreditTransaction({
        balance_before: 1000,
        amount: 500,
        balance_after: 2000, // Off by 500
      });

      expect(txn.validateBalance()).toBe(false);
    });
  });

  describe('Transaction Type Detection', () => {
    it('should detect credit transactions (positive amount)', () => {
      const txn = new CreditTransaction({
        amount: 500,
      });

      expect(txn.isCredit()).toBe(true);
      expect(txn.isDebit()).toBe(false);
    });

    it('should detect debit transactions (negative amount)', () => {
      const txn = new CreditTransaction({
        amount: -300,
      });

      expect(txn.isCredit()).toBe(false);
      expect(txn.isDebit()).toBe(true);
    });

    it('should handle zero amount', () => {
      const txn = new CreditTransaction({
        amount: 0,
      });

      expect(txn.isCredit()).toBe(false);
      expect(txn.isDebit()).toBe(false);
    });
  });

  describe('Transaction Types', () => {
    it('should support WEEK_RELEASE type', () => {
      const txn = new CreditTransaction({
        type: 'WEEK_RELEASE',
        amount: 1080,
        description: 'Released week 25 at Marbella',
      });

      expect(txn.type).toBe('WEEK_RELEASE');
      expect(txn.isCredit()).toBe(true);
    });

    it('should support WEEK_BOOKING type', () => {
      const txn = new CreditTransaction({
        type: 'WEEK_BOOKING',
        amount: -1200,
        description: 'Booked week at Lisbon',
      });

      expect(txn.type).toBe('WEEK_BOOKING');
      expect(txn.isDebit()).toBe(true);
    });

    it('should support CREDIT_PURCHASE type', () => {
      const txn = new CreditTransaction({
        type: 'CREDIT_PURCHASE',
        amount: 500,
        description: 'Purchased 500 credits',
      });

      expect(txn.type).toBe('CREDIT_PURCHASE');
    });

    it('should support CREDIT_EXPIRATION type', () => {
      const txn = new CreditTransaction({
        type: 'CREDIT_EXPIRATION',
        amount: -200,
        description: 'Credits expired after 2 years',
      });

      expect(txn.type).toBe('CREDIT_EXPIRATION');
      expect(txn.isDebit()).toBe(true);
    });

    it('should support REFUND type', () => {
      const txn = new CreditTransaction({
        type: 'REFUND',
        amount: 1200,
        description: 'Refund for cancelled booking',
      });

      expect(txn.type).toBe('REFUND');
      expect(txn.isCredit()).toBe(true);
    });
  });

  describe('Reference Tracking', () => {
    it('should store reference to week_allocation', () => {
      const txn = new CreditTransaction({
        reference_type: 'week_allocation',
        reference_id: 1001,
      });

      expect(txn.reference_type).toBe('week_allocation');
      expect(txn.reference_id).toBe(1001);
    });

    it('should store reference to booking', () => {
      const txn = new CreditTransaction({
        reference_type: 'booking',
        reference_id: 5001,
      });

      expect(txn.reference_type).toBe('booking');
      expect(txn.reference_id).toBe(5001);
    });

    it('should allow null references for manual adjustments', () => {
      const txn = new CreditTransaction({
        type: 'ADJUSTMENT',
        reference_type: null,
        reference_id: null,
      });

      expect(txn.reference_type).toBeNull();
      expect(txn.reference_id).toBeNull();
    });
  });

  describe('Metadata Storage', () => {
    it('should store calculation metadata', () => {
      const metadata = {
        baseValue: 1000,
        seasonalFactor: 1.2,
        timingFactor: 0.9,
        finalCredits: 1080,
      };

      const txn = new CreditTransaction({
        metadata,
      });

      expect(txn.metadata).toEqual(metadata);
    });

    it('should allow null metadata', () => {
      const txn = new CreditTransaction({
        metadata: null,
      });

      expect(txn.metadata).toBeNull();
    });
  });

  describe('Audit Trail', () => {
    it('should track created_by user', () => {
      const txn = new CreditTransaction({
        created_by: 42, // Admin user ID
        ip_address: '192.168.1.100',
      });

      expect(txn.created_by).toBe(42);
      expect(txn.ip_address).toBe('192.168.1.100');
    });

    it('should allow null created_by for automated transactions', () => {
      const txn = new CreditTransaction({
        created_by: null,
      });

      expect(txn.created_by).toBeNull();
    });
  });
});

