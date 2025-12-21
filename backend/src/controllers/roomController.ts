import { Request, Response } from 'express';
import Room from '../models/room';
import RoomEnrichmentService from '../services/roomEnrichmentService';

const roomController = {
  /**
   * Obtener todas las habitaciones enriquecidas con datos del PMS
   * Nota: Debería ser deprecado en favor de getRoomsByProperty en staffRoomController
   */
  async getAllRooms(req: Request, res: Response) {
    try {
      const roomsLocal = await Room.findAll();
      const enriched = await RoomEnrichmentService.enrichRooms(roomsLocal);
      res.json(enriched);
    } catch (err) {
      res.status(500).json({ error: 'Error fetching rooms' });
    }
  },

  /**
   * Crear un nuevo mapeo de habitación desde el PMS
   * Solo aceptar datos complementarios (custom_price, images, etc)
   */
  async createRoom(req: Request, res: Response) {
    try {
      const { pmsResourceId, propertyId, roomTypeId, customPrice, isMarketplaceEnabled, images } = req.body;
      
      if (!pmsResourceId || !propertyId) {
        return res.status(400).json({ 
          error: 'pmsResourceId and propertyId are required' 
        });
      }

      const room = await Room.create({ 
        pmsResourceId, 
        propertyId, 
        roomTypeId, 
        customPrice, 
        isMarketplaceEnabled: isMarketplaceEnabled || false,
        images: images || [],
        pmsLastSync: new Date()
      });
      
      const enriched = await RoomEnrichmentService.enrichRoom(room);
      res.status(201).json(enriched);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error creating room mapping' });
    }
  },

  /**
   * Actualizar solo datos complementarios de una habitación
   * No actualizar: name, description, capacity, floor, type, status, basePrice (vienen del PMS)
   */
  async updateRoom(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { roomTypeId, customPrice, isMarketplaceEnabled, images } = req.body;
      
      const room = await Room.findByPk(id);
      if (!room) return res.status(404).json({ error: 'Room not found' });
      
      await room.update({ 
        ...(roomTypeId !== undefined && { roomTypeId }),
        ...(customPrice !== undefined && { customPrice }),
        ...(isMarketplaceEnabled !== undefined && { isMarketplaceEnabled }),
        ...(images !== undefined && { images })
      });
      
      const enriched = await RoomEnrichmentService.enrichRoom(room);
      res.json(enriched);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error updating room' });
    }
  },

  /**
   * Eliminar mapeo de habitación
   */
  async deleteRoom(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const room = await Room.findByPk(id);
      if (!room) return res.status(404).json({ error: 'Room not found' });
      await room.destroy();
      res.status(204).send();
    } catch (err) {
      res.status(400).json({ error: 'Error deleting room' });
    }
  },
};

export default roomController;
