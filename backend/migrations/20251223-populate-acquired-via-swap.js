'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Mark requester bookings that were swapped
    await queryInterface.sequelize.query(`
      UPDATE bookings b
      INNER JOIN swap_requests sr ON sr.requester_source_id = b.id
      SET b.acquired_via_swap_id = sr.id
      WHERE sr.requester_source_type = 'booking'
      AND sr.status = 'completed'
      AND b.acquired_via_swap_id IS NULL
    `);

    // Mark responder bookings that were swapped
    await queryInterface.sequelize.query(`
      UPDATE bookings b
      INNER JOIN swap_requests sr ON sr.responder_source_id = b.id
      SET b.acquired_via_swap_id = sr.id
      WHERE sr.responder_source_type = 'booking'
      AND sr.status = 'completed'
      AND b.acquired_via_swap_id IS NULL
    `);
  },

  async down(queryInterface, Sequelize) {
    // Clear acquired_via_swap_id for bookings from completed swaps
    await queryInterface.sequelize.query(`
      UPDATE bookings b
      INNER JOIN swap_requests sr ON (sr.requester_source_id = b.id OR sr.responder_source_id = b.id)
      SET b.acquired_via_swap_id = NULL
      WHERE sr.status = 'completed'
    `);
  }
};
