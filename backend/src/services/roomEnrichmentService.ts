/**
 * Room Enrichment Service
 * 
 * Enriquece los datos de habitaciones locales con información del PMS.
 * 
 * La tabla rooms solo contiene: id, name, description, capacity
 * El enriquecimiento con PMS está disponible si se integra en el futuro.
 */

import Room from '../models/room';
import { PMSFactory } from './pms/PMSFactory';
import Property from '../models/Property';
import DistributedLockService from './distributedLockService';

export interface EnrichedRoom {
  // Local data (from rooms table)
  id: number;
  name: string;
  description?: string;
  capacity: number;
  createdAt: Date;
  updatedAt: Date;

  // PMS data (enriched at runtime) - optional for now
  floor?: string;
  type: string;
  status: string;
  basePrice?: number;
  amenities?: any[];

  // Calculated
  price: number;
}

export class RoomEnrichmentService {
  /**
   * Enriquece una habitación local con datos del PMS
   */
  static async enrichRoom(roomLocal: Room): Promise<EnrichedRoom> {
    // For now, just return the local room data with basic defaults
    // PMS integration can be added later if needed
    return {
      id: roomLocal.id,
      name: roomLocal.name,
      description: roomLocal.description,
      capacity: roomLocal.capacity,
      type: 'Standard',
      status: 'available',
      createdAt: roomLocal.createdAt,
      updatedAt: roomLocal.updatedAt,
      price: 0, // Default price, can be set from other sources
    };
  }

  /**
   * Enriquece múltiples habitaciones
   */
  static async enrichRooms(roomsLocal: Room[]): Promise<EnrichedRoom[]> {
    if (roomsLocal.length === 0) {
      return [];
    }

    return roomsLocal.map(room => ({
      id: room.id,
      name: room.name,
      description: room.description,
      capacity: room.capacity,
      type: 'Standard',
      status: 'available',
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      price: 0,
    }));
  }

  /**
   * Obtiene todas las habitaciones enriquecidas de una propiedad
   */
  static async getRoomsForProperty(propertyId: number, filters?: {
    isMarketplaceEnabled?: boolean;
  }): Promise<EnrichedRoom[]> {
    // Since propertyId is not in the rooms table, just get all rooms
    const roomsLocal = await Room.findAll();
    return this.enrichRooms(roomsLocal);
  }

  /**
   * Obtiene una habitación enriquecida por ID
   */
  static async getRoomById(roomId: number): Promise<EnrichedRoom> {
    const roomLocal = await Room.findByPk(roomId);
    if (!roomLocal) {
      throw new Error(`Room ${roomId} not found`);
    }
    return this.enrichRoom(roomLocal);
  }

  /**
   * Verifica si una habitación está disponible en un rango de fechas
   */
  static async checkAvailability(
    propertyId: number,
    roomId: number,
    startDate: Date,
    endDate: Date
  ): Promise<boolean> {
    // Simplified: always return true for now
    // PMS integration can be added later
    return true;
  }
}

export default RoomEnrichmentService;
