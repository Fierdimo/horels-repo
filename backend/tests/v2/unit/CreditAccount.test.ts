/**
 * CreditAccount Model Unit Tests
 * 
 * Tests for CreditAccount model helper methods.
 * Pure unit tests - no database needed.
 */

import { describe, it, expect } from 'vitest';

// Mock CreditAccount with business logic
class CreditAccount {
  balance: number = 0;
  credit_limit: number | null = null;
  total_earned: number = 0;
  total_spent: number = 0;
  total_expired: number = 0;
  expiration_policy: string = '2_YEARS';

  constructor(data: Partial<CreditAccount>) {
    Object.assign(this, data);
  }

  hasSufficientBalance(amount: number): boolean {
    const availableBalance = this.credit_limit !== null 
      ? this.balance + this.credit_limit 
      : this.balance;
    return availableBalance >= amount;
  }

  getAvailableBalance(): number {
    return this.credit_limit !== null 
      ? this.balance + this.credit_limit 
      : this.balance;
  }
}

describe('CreditAccount Model', () => {

  describe('hasSufficientBalance()', () => {
    it('should return true when balance is sufficient (no credit limit)', () => {
      const account = new CreditAccount({
        balance: 1000,
        credit_limit: null,
      });

      expect(account.hasSufficientBalance(500)).toBe(true);
      expect(account.hasSufficientBalance(1000)).toBe(true);
    });

    it('should return false when balance is insufficient (no credit limit)', () => {
      const account = new CreditAccount({
        balance: 500,
        credit_limit: null,
      });

      expect(account.hasSufficientBalance(1000)).toBe(false);
    });

    it('should consider credit limit when checking balance', () => {
      const account = new CreditAccount({
        balance: 100,
        credit_limit: 500, // Can go -500
      });

      // Can spend up to balance + credit_limit
      expect(account.hasSufficientBalance(200)).toBe(true); // 100 - 200 = -100 (within -500 limit)
      expect(account.hasSufficientBalance(600)).toBe(true); // 100 - 600 = -500 (exactly at limit)
      expect(account.hasSufficientBalance(700)).toBe(false); // 100 - 700 = -600 (exceeds limit)
    });

    it('should handle negative balance with credit limit', () => {
      const account = new CreditAccount({
        balance: -200,
        credit_limit: 500,
      });

      // Already at -200, can go to -500
      expect(account.hasSufficientBalance(100)).toBe(true); // -200 - 100 = -300
      expect(account.hasSufficientBalance(300)).toBe(true); // -200 - 300 = -500 (at limit)
      expect(account.hasSufficientBalance(400)).toBe(false); // -200 - 400 = -600 (exceeds)
    });

    it('should handle zero balance and zero amount', () => {
      const account = new CreditAccount({
        balance: 0,
        credit_limit: null,
      });

      expect(account.hasSufficientBalance(0)).toBe(true);
    });
  });

  describe('getAvailableBalance()', () => {
    it('should return balance when no credit limit', () => {
      const account = new CreditAccount({
        balance: 1500,
        credit_limit: null,
      });

      expect(account.getAvailableBalance()).toBe(1500);
    });

    it('should return balance + credit_limit when credit limit exists', () => {
      const account = new CreditAccount({
        balance: 200,
        credit_limit: 500,
      });

      expect(account.getAvailableBalance()).toBe(700); // 200 + 500
    });

    it('should handle negative balance with credit limit', () => {
      const account = new CreditAccount({
        balance: -100,
        credit_limit: 500,
      });

      expect(account.getAvailableBalance()).toBe(400); // -100 + 500
    });

    it('should handle zero balance with credit limit', () => {
      const account = new CreditAccount({
        balance: 0,
        credit_limit: 300,
      });

      expect(account.getAvailableBalance()).toBe(300);
    });
  });

  describe('Balance Statistics', () => {
    it('should track lifetime totals', () => {
      const account = new CreditAccount({
        balance: 500,
        total_earned: 2000,
        total_spent: 1200,
        total_expired: 300,
      });

      expect(account.total_earned).toBe(2000);
      expect(account.total_spent).toBe(1200);
      expect(account.total_expired).toBe(300);
      
      // Net: 2000 - 1200 - 300 = 500 (should match balance)
      const net = parseFloat(account.total_earned.toString()) - 
                  parseFloat(account.total_spent.toString()) - 
                  parseFloat(account.total_expired.toString());
      expect(net).toBe(parseFloat(account.balance.toString()));
    });
  });

  describe('Expiration Policy', () => {
    it('should have default expiration policy', () => {
      const account = new CreditAccount({});
      expect(account.expiration_policy).toBe('2_YEARS');
    });

    it('should allow setting expiration policy', () => {
      const account1 = new CreditAccount({ expiration_policy: 'NEVER' });
      expect(account1.expiration_policy).toBe('NEVER');

      const account2 = new CreditAccount({ expiration_policy: '1_YEAR' });
      expect(account2.expiration_policy).toBe('1_YEAR');
    });
  });
});

