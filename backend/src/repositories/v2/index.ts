/**
 * V2 Repositories Index
 * 
 * Exports all V2 repositories for easy import.
 * 
 * Usage:
 * import { WeekAllocationRepository, CreditAccountRepository } from '@/repositories/v2';
 */

export { BaseRepository, IBaseRepository } from './BaseRepository';
export { TimesharePropertyRepository } from './TimesharePropertyRepository';
export { WeekAllocationRepository } from './WeekAllocationRepository';
export { CreditAccountRepository } from './CreditAccountRepository';
export { CreditTransactionRepository } from './CreditTransactionRepository';

// Singleton instances (optional - can also use dependency injection)
export const propertyRepository = new (require('./TimesharePropertyRepository').TimesharePropertyRepository)();
export const weekAllocationRepository = new (require('./WeekAllocationRepository').WeekAllocationRepository)();
export const creditAccountRepository = new (require('./CreditAccountRepository').CreditAccountRepository)();
export const creditTransactionRepository = new (require('./CreditTransactionRepository').CreditTransactionRepository)();
