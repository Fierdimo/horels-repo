/**
 * V2 Models Index
 * 
 * Initializes all V2 models and defines their associations.
 * 
 * Model Relationship Overview:
 * 
 * TimeshareProperty (1:N) → TimeshareUnit
 * TimeshareUnit (1:N) → Ownership
 * Ownership (1:N) → WeekAllocation
 * User (1:1) → CreditAccount
 * CreditAccount (1:N) → CreditTransaction
 * WeekAllocation (N:1) → V2Booking (circular relationship)
 * TimeshareProperty (1:N) → V2Booking
 * TimeshareProperty (1:N) → HotelInventory
 * 
 * See: docs_v2/TIMESHARE_PLATFORM_V2_SPEC.md - Database Schema
 */

import { Sequelize } from 'sequelize';
import { initTimeshareProperty } from './TimeshareProperty';
import { initTimeshareUnit } from './TimeshareUnit';
import { initOwnership } from './Ownership';
import { initWeekAllocation } from './WeekAllocation';
import { initCreditAccount } from './CreditAccount';
import { initCreditTransaction } from './CreditTransaction';
import { initV2Booking } from './V2Booking';
import { initHotelInventory } from './HotelInventory';
import { initUser } from './User';
import { initCreditSystemConfig } from './CreditSystemConfig';

import TimeshareProperty from './TimeshareProperty';
import TimeshareUnit from './TimeshareUnit';
import Ownership from './Ownership';
import WeekAllocation from './WeekAllocation';
import CreditAccount from './CreditAccount';
import CreditTransaction from './CreditTransaction';
import V2Booking from './V2Booking';
import HotelInventory from './HotelInventory';
import User from './User';
import CreditSystemConfig from './CreditSystemConfig';

/**
 * Initialize all V2 models with Sequelize instance
 */
export function initV2Models(sequelize: Sequelize) {
  // Initialize models
  initUser(sequelize);
  initTimeshareProperty(sequelize);
  initTimeshareUnit(sequelize);
  initOwnership(sequelize);
  initWeekAllocation(sequelize);
  initCreditAccount(sequelize);
  initCreditTransaction(sequelize);
  initV2Booking(sequelize);
  initHotelInventory(sequelize);
  initCreditSystemConfig(sequelize);
  
  // Define associations
  setupAssociations();
  
  return {
    User,
    TimeshareProperty,
    TimeshareUnit,
    Ownership,
    WeekAllocation,
    CreditAccount,
    CreditTransaction,
    V2Booking,
    HotelInventory,
    CreditSystemConfig,
  };
}

/**
 * Setup model associations
 */
function setupAssociations() {
  // TimeshareProperty → TimeshareUnit (1:N)
  TimeshareProperty.hasMany(TimeshareUnit, {
    foreignKey: 'property_id',
    as: 'units',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  TimeshareUnit.belongsTo(TimeshareProperty, {
    foreignKey: 'property_id',
    as: 'property',
  });
  
  // TimeshareUnit → Ownership (1:N)
  TimeshareUnit.hasMany(Ownership, {
    foreignKey: 'unit_id',
    as: 'ownerships',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  Ownership.belongsTo(TimeshareUnit, {
    foreignKey: 'unit_id',
    as: 'unit',
  });
  
  // Ownership → WeekAllocation (1:N)
  Ownership.hasMany(WeekAllocation, {
    foreignKey: 'ownership_id',
    as: 'weekAllocations',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  WeekAllocation.belongsTo(Ownership, {
    foreignKey: 'ownership_id',
    as: 'ownership',
  });
  
  // User → CreditAccount (1:1)
  User.hasOne(CreditAccount, {
    foreignKey: 'user_id',
    as: 'creditAccount',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  CreditAccount.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user',
  });
  
  // User → Ownership (1:N)
  User.hasMany(Ownership, {
    foreignKey: 'owner_id',
    as: 'ownerships',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  Ownership.belongsTo(User, {
    foreignKey: 'owner_id',
    as: 'owner',
  });
  
  // CreditAccount → CreditTransaction (1:N)
  CreditAccount.hasMany(CreditTransaction, {
    foreignKey: 'account_id',
    as: 'transactions',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  CreditTransaction.belongsTo(CreditAccount, {
    foreignKey: 'account_id',
    as: 'account',
  });
  
  // TimeshareProperty → V2Booking (1:N)
  TimeshareProperty.hasMany(V2Booking, {
    foreignKey: 'property_id',
    as: 'bookings',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  V2Booking.belongsTo(TimeshareProperty, {
    foreignKey: 'property_id',
    as: 'property',
  });
  
  // WeekAllocation ↔ V2Booking (Circular Relationship)
  // A WeekAllocation can be associated with one Booking
  WeekAllocation.belongsTo(V2Booking, {
    foreignKey: 'booking_id',
    as: 'booking',
  });
  // A Booking can have multiple WeekAllocations (multi-week bookings)
  V2Booking.hasMany(WeekAllocation, {
    foreignKey: 'booking_id',
    as: 'weekAllocations',
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  });
  
  // TimeshareProperty → HotelInventory (1:N)
  TimeshareProperty.hasMany(HotelInventory, {
    foreignKey: 'property_id',
    as: 'inventory',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  HotelInventory.belongsTo(TimeshareProperty, {
    foreignKey: 'property_id',
    as: 'property',
  });
}

/**
 * Export all models
 */
export {
  User,
  TimeshareProperty,
  TimeshareUnit,
  Ownership,
  WeekAllocation,
  CreditAccount,
  CreditTransaction,
  V2Booking,
  HotelInventory,
  CreditSystemConfig,
};

export default {
  User,
  TimeshareProperty,
  TimeshareUnit,
  Ownership,
  WeekAllocation,
  CreditAccount,
  CreditTransaction,
  V2Booking,
  HotelInventory,
  CreditSystemConfig,
  initV2Models,
};
