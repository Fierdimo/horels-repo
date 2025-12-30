import User from './User';
import Role from './Role';
import Permission from './Permission';
import RolePermission from './RolePermission';
import ActionLog from './ActionLog';
import Week from './Week';
import SwapRequest from './SwapRequest';
import NightCredit from './NightCredit';
import NightCreditRequest from './NightCreditRequest';
import Booking from './Booking';
import HotelService from './HotelService';
import Property from './Property';
import PMSSyncLog from './PMSSyncLog';
import Fee from './Fee';
import Room from './room';
import RoomType from './RoomType';
import OwnerInvitation from './OwnerInvitation';
import CreditBookingCost from './CreditBookingCost';

// Asociaciones existentes (guardadas con comprobaciones para evitar errores durante el arranque de tests)
try {
  if (User && typeof (User as any).belongsTo === 'function') {
    User.belongsTo(Role, { foreignKey: 'role_id' });
    Role.hasMany(User, { foreignKey: 'role_id' });

    User.belongsTo(Property, { foreignKey: 'property_id' });
    Property.hasMany(User, { foreignKey: 'property_id' });

    Role.belongsToMany(Permission, { through: RolePermission, foreignKey: 'role_id', as: 'Permissions' });
    Permission.belongsToMany(Role, { through: RolePermission, foreignKey: 'permission_id', as: 'Roles' });

    ActionLog.belongsTo(User, { foreignKey: 'user_id' });
    User.hasMany(ActionLog, { foreignKey: 'user_id' });

    // Nuevas asociaciones para timesharing
    User.hasMany(Week, { foreignKey: 'owner_id', as: 'Weeks' });
    Week.belongsTo(User, { foreignKey: 'owner_id', as: 'Owner' });

    Property.hasMany(Week, { foreignKey: 'property_id', as: 'Weeks' });
    Week.belongsTo(Property, { foreignKey: 'property_id', as: 'Property' });

    User.hasMany(SwapRequest, { foreignKey: 'requester_id', as: 'SwapRequests' });
    SwapRequest.belongsTo(User, { foreignKey: 'requester_id', as: 'Requester' });

    Week.hasMany(SwapRequest, { foreignKey: 'requester_week_id', as: 'SwapRequests' });
    SwapRequest.belongsTo(Week, { foreignKey: 'requester_week_id', as: 'RequesterWeek' });

    Week.hasMany(SwapRequest, { foreignKey: 'responder_week_id', as: 'ReceivedSwaps' });
    SwapRequest.belongsTo(Week, { foreignKey: 'responder_week_id', as: 'ResponderWeek' });

    User.hasMany(NightCredit, { foreignKey: 'owner_id', as: 'NightCredits' });
    NightCredit.belongsTo(User, { foreignKey: 'owner_id', as: 'Owner' });

    Week.hasMany(NightCredit, { foreignKey: 'original_week_id', as: 'NightCredits' });
    NightCredit.belongsTo(Week, { foreignKey: 'original_week_id', as: 'OriginalWeek' });

    // NightCreditRequest associations
    User.hasMany(NightCreditRequest, { foreignKey: 'owner_id', as: 'NightCreditRequests' });
    NightCreditRequest.belongsTo(User, { foreignKey: 'owner_id', as: 'Owner' });
    NightCreditRequest.belongsTo(NightCredit, { foreignKey: 'credit_id', as: 'Credit' });
    NightCreditRequest.belongsTo(Property, { foreignKey: 'property_id', as: 'Property' });
    NightCreditRequest.belongsTo(User, { foreignKey: 'reviewed_by_staff_id', as: 'ReviewedByStaff' });
    NightCreditRequest.belongsTo(Booking, { foreignKey: 'booking_id', as: 'Booking' });

    // Asociaciones para hotel guests
    Property.hasMany(Booking, { foreignKey: 'property_id', as: 'Bookings' });
    Booking.belongsTo(Property, { foreignKey: 'property_id', as: 'Property' });

    Booking.hasMany(HotelService, { foreignKey: 'booking_id', as: 'Services' });
    HotelService.belongsTo(Booking, { foreignKey: 'booking_id', as: 'Booking' });

    // Asociaciones para PMS Sync Logs
    Property.hasMany(PMSSyncLog, { foreignKey: 'property_id', as: 'SyncLogs' });
    PMSSyncLog.belongsTo(Property, { foreignKey: 'property_id' });

    // Asociaciones para Rooms
    Property.hasMany(Room, { foreignKey: 'propertyId', as: 'Rooms' });
    Room.belongsTo(Property, { foreignKey: 'propertyId', as: 'RoomProperty' });

    // Asociaciones para Bookings-Room (trackear habitación específica)
    Room.hasMany(Booking, { foreignKey: 'room_id', as: 'Bookings' });
    Booking.belongsTo(Room, { foreignKey: 'room_id', as: 'Room' });

    // Asociaciones para Owner Invitations
    OwnerInvitation.belongsTo(User, { foreignKey: 'created_by_staff_id', as: 'createdByStaff' });
    OwnerInvitation.belongsTo(Property, { foreignKey: 'property_id', as: 'property' });
    OwnerInvitation.belongsTo(User, { foreignKey: 'created_user_id', as: 'createdUser' });
    User.hasMany(OwnerInvitation, { foreignKey: 'created_by_staff_id', as: 'createdInvitations' });
    User.hasMany(OwnerInvitation, { foreignKey: 'created_user_id', as: 'receivedInvitation' });
    Property.hasMany(OwnerInvitation, { foreignKey: 'property_id', as: 'invitations' });

    // Asociaciones para Credit Booking Costs
    CreditBookingCost.belongsTo(Property, { foreignKey: 'property_id', as: 'property' });
    Property.hasMany(CreditBookingCost, { foreignKey: 'property_id', as: 'creditCosts' });
  }
} catch (e) {
  // Log and continue — tests will surface issues if associations are required
  // eslint-disable-next-line no-console
  console.warn('Model association setup skipped or partially failed:', e && (e as Error).message);
}

export {
  User,
  Role,
  Permission,
  RolePermission,
  ActionLog,
  Week,
  SwapRequest,
  NightCredit,
  NightCreditRequest,
  Booking,
  HotelService,
  Property,
  PMSSyncLog,
  Fee,
  Room,
  RoomType,
  OwnerInvitation,
  CreditBookingCost,
};