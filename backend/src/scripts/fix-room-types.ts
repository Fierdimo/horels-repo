/**
 * Script to fix room_type field in bookings table
 * 
 * Problem: Some bookings have room IDs (like "Room 000c3de6...") instead of room types
 * Solution: For each booking with invalid room_type, lookup the actual room and get its type from PMS
 */

import Booking from '../models/Booking';
import Room from '../models/room';
import Property from '../models/Property';
import RoomEnrichmentService from '../services/roomEnrichmentService';
import sequelize from '../config/database';

async function fixRoomTypes() {
  try {
    console.log('Starting room_type fix...');

    // Get all bookings with room_type that looks like an ID (contains UUID pattern or "Room")
    const bookingsToFix = await Booking.findAll({
      where: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('room_type')),
        'LIKE',
        '%room%'
      ),
      include: [
        {
          model: Room,
          as: 'Room',
          required: false
        },
        {
          model: Property,
          as: 'Property',
          required: true
        }
      ]
    });

    console.log(`Found ${bookingsToFix.length} bookings to fix`);

    let fixed = 0;
    let failed = 0;
    let skipped = 0;

    for (const booking of bookingsToFix) {
      try {
        const roomType = booking.room_type;
        console.log(`\nProcessing booking ${booking.id} - Current room_type: ${roomType}`);

        // Skip if it doesn't look like an ID
        if (!roomType || (!roomType.includes('-') && !roomType.toLowerCase().includes('room'))) {
          console.log('  Skipping - room_type looks valid');
          skipped++;
          continue;
        }

        // Try to get room
        const room = (booking as any).Room;
        if (!room) {
          console.log(`  Warning: Booking ${booking.id} has no associated room, using 'Standard'`);
          await booking.update({ room_type: 'Standard' });
          fixed++;
          continue;
        }

        // Enrich room to get actual type from PMS
        try {
          const enrichedRoom = await RoomEnrichmentService.enrichRoom(room);
          const actualRoomType = enrichedRoom.type || enrichedRoom.name || 'Standard';
          
          console.log(`  Updating to: ${actualRoomType}`);
          await booking.update({ room_type: actualRoomType });
          fixed++;
        } catch (enrichError) {
          console.log(`  Warning: Could not enrich room, using 'Standard'`);
          await booking.update({ room_type: 'Standard' });
          fixed++;
        }

      } catch (error) {
        console.error(`  Error fixing booking ${booking.id}:`, error);
        failed++;
      }
    }

    console.log('\n=== Summary ===');
    console.log(`Total processed: ${bookingsToFix.length}`);
    console.log(`Fixed: ${fixed}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Failed: ${failed}`);

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
fixRoomTypes()
  .then(() => {
    console.log('\nScript completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
