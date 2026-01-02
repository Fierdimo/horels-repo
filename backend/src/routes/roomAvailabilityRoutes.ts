import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import Room from '../models/room';
import RoomEnrichmentService from '../services/roomEnrichmentService';

const router = Router();

/**
 * @route   GET /api/rooms/availability/:propertyId
 * @desc    Get available rooms for a property with correct room types from PMS
 * @access  Authenticated users
 */
router.get('/availability/:propertyId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required'
      });
    }

    // Get all rooms for this property
    const rooms = await Room.findAll({
      where: {
        propertyId: parseInt(propertyId),
        isMarketplaceEnabled: true // Solo habitaciones habilitadas para marketplace/bookings
      }
    });

    console.log(`[Room Availability] Found ${rooms.length} rooms for property ${propertyId}`);
    console.log('[Room Availability] Rooms:', rooms.map(r => ({ id: r.id, pmsResourceId: r.pmsResourceId, propertyId: r.propertyId })));

    if (rooms.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: 'No rooms available for this property'
      });
    }

    // Enrich each room with PMS data to get correct room types
    const enrichedRooms = await Promise.allSettled(
      rooms.map(room => RoomEnrichmentService.enrichRoom(room))
    );

    // Filter successful enrichments and format response
    const availableRooms = enrichedRooms
      .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
      .map(result => {
        const enrichedRoom = result.value;
        console.log('[Room Availability] Enriched room:', {
          id: enrichedRoom.id,
          pmsResourceId: enrichedRoom.pmsResourceId,
          name: enrichedRoom.name,
          type: enrichedRoom.type,
          description: enrichedRoom.description
        });
        return {
          roomId: enrichedRoom.pmsResourceId, // UUID de la habitación en el PMS
          id: enrichedRoom.id, // ID local de la habitación
          name: enrichedRoom.name, // Nombre de la habitación (ej: "Room 101")
          roomType: enrichedRoom.type, // Tipo de habitación (ej: "Standard", "Deluxe")
          capacity: enrichedRoom.capacity,
          price: enrichedRoom.price,
          description: enrichedRoom.description,
          available: enrichedRoom.status === 'available',
          amenities: enrichedRoom.amenities
        };
      });

    console.log('[Room Availability] Final response:', availableRooms.map(r => ({ roomId: r.roomId, roomType: r.roomType, name: r.name })));

    res.json({
      success: true,
      data: availableRooms,
      count: availableRooms.length
    });

  } catch (error: any) {
    console.error('Error getting room availability:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get room availability',
      message: error.message
    });
  }
});

export default router;
