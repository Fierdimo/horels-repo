'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Remove existing role_permissions to avoid duplicates and make seeder idempotent
    await queryInterface.bulkDelete('role_permissions', null, {});

    // Asignar permisos a roles
    // Guest: view_bookings
    // Owner: view_bookings, create_booking, update_booking, manage_payments
    // Staff: view_bookings, create_booking, update_booking, view_reports, view_users, update_user
    // Admin: all permissions

    const permissions = [
      { role: 'guest', perms: ['view_bookings', 'view_own_weeks'] },
      { role: 'owner', perms: ['view_bookings', 'create_booking', 'update_booking', 'cancel_booking', 'view_availability', 'view_property', 'view_own_properties', 'manage_payments', 'view_own_weeks'] },
      { role: 'staff', perms: ['view_bookings', 'create_booking', 'update_booking', 'cancel_booking', 'view_availability', 'view_property', 'view_reports', 'view_own_weeks', 'view_users', 'update_user', 'manage_bookings'] },
      { role: 'admin', perms: ['create_user', 'view_users', 'update_user', 'delete_user', 'view_bookings', 'create_booking', 'update_booking', 'cancel_booking', 'view_availability', 'view_property', 'view_own_properties', 'manage_payments', 'view_reports', 'manage_roles', 'manage_permissions', 'view_own_weeks', 'manage_bookings'] }
    ];

    for (const { role, perms } of permissions) {
      for (const perm of perms) {
        await queryInterface.sequelize.query(`
          INSERT INTO role_permissions (role_id, permission_id, createdAt, updatedAt)
          SELECT r.id, p.id, NOW(), NOW()
          FROM roles r, permissions p
          WHERE r.name = '${role}' AND p.name = '${perm}'
        `);
      }
    }
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('role_permissions', null, {});
  }
};
