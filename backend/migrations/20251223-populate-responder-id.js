'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // For COMPLETED swaps, the bookings were already exchanged
    // So the CURRENT owner of responder_source_id is actually the REQUESTER
    // We need to look at requester_source_id to find who is the responder now
    
    // Update responder_id for COMPLETED swaps with booking exchanges
    await queryInterface.sequelize.query(`
      UPDATE swap_requests sr
      INNER JOIN bookings b ON sr.requester_source_id = b.id
      INNER JOIN users u ON b.guest_email = u.email
      SET sr.responder_id = u.id
      WHERE sr.requester_source_type = 'booking'
      AND sr.responder_source_type = 'booking'
      AND sr.responder_id IS NULL
      AND sr.status = 'completed'
      AND u.id != sr.requester_id
    `);

    // For MATCHED swaps (not yet completed), use current owner of responder booking
    await queryInterface.sequelize.query(`
      UPDATE swap_requests sr
      INNER JOIN bookings b ON sr.responder_source_id = b.id
      INNER JOIN users u ON b.guest_email = u.email
      SET sr.responder_id = u.id
      WHERE sr.responder_source_type = 'booking' 
      AND sr.responder_id IS NULL
      AND sr.status = 'matched'
    `);

    // For CANCELLED swaps, try to find based on responder booking original owner
    await queryInterface.sequelize.query(`
      UPDATE swap_requests sr
      INNER JOIN bookings b ON sr.responder_source_id = b.id
      INNER JOIN users u ON b.guest_email = u.email
      SET sr.responder_id = u.id
      WHERE sr.responder_source_type = 'booking' 
      AND sr.responder_id IS NULL
      AND sr.status = 'cancelled'
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE swap_requests 
      SET responder_id = NULL
      WHERE responder_source_type = 'booking'
    `);
  }
};
