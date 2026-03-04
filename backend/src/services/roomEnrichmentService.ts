/**
 * Room Enrichment Service
 *
 * Returns room data stored in the local DB (now fully self-contained).
 * PMS sync populates the DB; this service just shapes the response.
 */

import Room from '../models/room';

export interface EnrichedRoom {
  id: number;
  name: string;
  description?: string | null;
  capacity: number;
  quantity: number;
  type: string;
  floor?: string | null;
  basePrice: number;
  base_price: number;
  status: string;
  images: string[];
  isMarketplaceEnabled: boolean;
  property_id?: number | null;
  bookings?: any[];
  hasActiveBooking?: boolean;
  createdAt: Date;
  updatedAt: Date;
  // legacy alias
  price: number;
}

function toEnriched(room: Room): EnrichedRoom {
  const price = Number(room.base_price) || 0;
  return {
    id: room.id,
    name: room.name,
    description: room.description,
    capacity: room.capacity,
    quantity: room.quantity ?? 1,
    type: room.type || 'standard',
    floor: room.floor,
    basePrice: price,
    base_price: price,
    status: room.status || 'available',
    images: room.imageList,
    isMarketplaceEnabled: !!room.is_marketplace_enabled,
    property_id: room.property_id,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    price,
  };
}

export class RoomEnrichmentService {
  static async enrichRoom(room: Room): Promise<EnrichedRoom> {
    return toEnriched(room);
  }

  static async enrichRooms(rooms: Room[]): Promise<EnrichedRoom[]> {
    return rooms.map(toEnriched);
  }

  static async getRoomsForProperty(propertyId: number): Promise<EnrichedRoom[]> {
    const { Op } = require('sequelize');
    const rooms = await Room.findAll({
      where: { property_id: propertyId },
      order: [['createdAt', 'ASC']],
    });
    return rooms.map(toEnriched);
  }

  static async getRoomById(roomId: number): Promise<EnrichedRoom> {
    const room = await Room.findByPk(roomId);
    if (!room) throw new Error(`Room ${roomId} not found`);
    return toEnriched(room);
  }
}

export default RoomEnrichmentService;
