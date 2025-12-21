import { Request, Response } from 'express';
import Room from '../models/room';
import { Property, User } from '../models';
import { PMSFactory } from '../services/pms/PMSFactory';
import { decryptPMSCredentials } from '../utils/pmsEncryption';
import { RoomSyncService } from '../services/roomSyncService';
import RoomEnrichmentService from '../services/roomEnrichmentService';

const roomSyncService = new RoomSyncService();

interface AuthRequest extends Request {
  user?: User & { property_id?: number | null; role?: string };
}

class StaffRoomController {
  /**
   * Listar habitaciones del hotel del staff con datos enriquecidos del PMS
   */
  async getRoomsByProperty(req: AuthRequest, res: Response) {
    try {
      // Admin puede listar de cualquier property con query param, staff usa su property_id
      const isAdmin = (req.user as any)?.Role?.name === 'admin';
      const propertyId = isAdmin && req.query.propertyId 
        ? parseInt(req.query.propertyId as string) 
        : req.user?.property_id;

      if (!propertyId) {
        return res.status(403).json({
          success: false,
          error: 'Staff user must be assigned to a property, or admin must specify propertyId'
        });
      }

      // Obtener datos locales de habitaciones
      const roomsLocal = await Room.findAll({
        where: { propertyId },
        order: [['createdAt', 'ASC']]
      });

      // Enriquecer con datos del PMS
      const enrichedRooms = await RoomEnrichmentService.enrichRooms(roomsLocal);

      // Importar Booking para obtener información de reservas
      const { Booking } = require('../models');
      
      // Obtener todas las bookings para esta property
      const bookings = await Booking.findAll({
        where: {
          property_id: propertyId,
          status: { [require('sequelize').Op.in]: ['confirmed', 'checked_in', 'pending'] }
        },
        attributes: ['id', 'room_id', 'guest_name', 'guest_email', 'check_in', 'check_out', 'status', 'total_amount']
      });

      // Crear mapa de bookings por room_id
      const bookingsByRoomId: any = {};
      bookings.forEach((booking: any) => {
        if (!bookingsByRoomId[booking.room_id]) {
          bookingsByRoomId[booking.room_id] = [];
        }
        bookingsByRoomId[booking.room_id].push({
          id: booking.id,
          guest_name: booking.guest_name,
          guest_email: booking.guest_email,
          check_in: booking.check_in,
          check_out: booking.check_out,
          status: booking.status,
          total_amount: booking.total_amount
        });
      });

      // Agregar bookings a cada habitación
      const roomsWithBookings = roomsLocal.map((room: any, index: number) => {
        const enrichedRoom = enrichedRooms[index];
        return {
          ...enrichedRoom,
          bookings: bookingsByRoomId[room.id] || [],
          hasActiveBooking: (bookingsByRoomId[room.id] || []).length > 0
        };
      });

      res.json({
        success: true,
        data: roomsWithBookings,
        count: roomsWithBookings.length
      });
    } catch (error: any) {
      console.error('Error fetching rooms:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch rooms',
        message: error.message
      });
    }
  }

  /**
   * Mapear una habitación del PMS con datos complementarios locales
   * Ya no creamos habitaciones desde cero, las creamos cuando sincronizamos del PMS
   * Este endpoint es para actualizar datos complementarios (images, custom_price, etc)
   */
  async createRoom(req: AuthRequest, res: Response) {
    try {
      // Admin puede especificar propertyId en el body, staff usa su property_id asignado
      const isAdmin = (req.user as any)?.Role?.name === 'admin';
      const propertyId = isAdmin && req.body.propertyId 
        ? req.body.propertyId 
        : req.user?.property_id;

      if (!propertyId) {
        return res.status(403).json({
          success: false,
          error: 'Staff user must be assigned to a property, or admin must specify propertyId'
        });
      }

      const {
        pmsResourceId,
        roomTypeId,
        customPrice,
        isMarketplaceEnabled = false,
        images = []
      } = req.body;

      // Validaciones
      if (!pmsResourceId) {
        return res.status(400).json({
          success: false,
          error: 'pmsResourceId is required (map to existing PMS room)'
        });
      }

      // Verificar que la habitación existe en el PMS
      const pmsService = await PMSFactory.getAdapter(propertyId);
      const availability = await pmsService.getAvailability({});
      const pmsRoom = availability?.resources?.find((r: any) => r.Id === pmsResourceId);
      if (!pmsRoom) {
        return res.status(404).json({
          success: false,
          error: 'Room not found in PMS'
        });
      }

      // Crear mapeo local
      const room = await Room.create({
        propertyId,
        pmsResourceId,
        roomTypeId,
        customPrice,
        isMarketplaceEnabled,
        images,
        pmsLastSync: new Date()
      });

      // Enriquecer respuesta con datos del PMS
      const enriched = await RoomEnrichmentService.enrichRoom(room);

      res.status(201).json({
        success: true,
        data: enriched,
        message: 'Room mapping created successfully'
      });
    } catch (error: any) {
      console.error('Error creating room mapping:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create room mapping',
        message: error.message
      });
    }
  }

  /**
   * Actualizar datos complementarios de una habitación
   * Solo se puede actualizar: customPrice, isMarketplaceEnabled, images, roomTypeId
   * Los datos del PMS (name, capacity, type, etc) vienen del PMS en tiempo real
   */
  async updateRoom(req: AuthRequest, res: Response) {
    try {
      const isAdmin = (req.user as any)?.Role?.name === 'admin';
      const propertyId = isAdmin && req.body.propertyId 
        ? req.body.propertyId 
        : req.user?.property_id;
      const { id } = req.params;

      if (!propertyId) {
        return res.status(403).json({
          success: false,
          error: 'Staff user must be assigned to a property, or admin must specify propertyId'
        });
      }

      const room = await Room.findOne({
        where: { id, propertyId }
      });

      if (!room) {
        return res.status(404).json({
          success: false,
          error: 'Room not found or not in your property'
        });
      }

      // Solo permitir actualizar datos complementarios
      const {
        roomTypeId,
        customPrice,
        isMarketplaceEnabled,
        images
      } = req.body;

      await room.update({
        ...(roomTypeId !== undefined && { roomTypeId }),
        ...(customPrice !== undefined && { customPrice }),
        ...(isMarketplaceEnabled !== undefined && { isMarketplaceEnabled }),
        ...(images !== undefined && { images })
      });

      // Enriquecer respuesta
      const enriched = await RoomEnrichmentService.enrichRoom(room);

      res.json({
        success: true,
        data: enriched,
        message: 'Room updated successfully'
      });
    } catch (error: any) {
      console.error('Error updating room:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update room',
        message: error.message
      });
    }
  }

  /**
   * Eliminar habitación
   */
  async deleteRoom(req: AuthRequest, res: Response) {
    try {
      const isAdmin = (req.user as any)?.Role?.name === 'admin';
      const propertyId = isAdmin && req.body.propertyId 
        ? req.body.propertyId 
        : req.user?.property_id;
      const { id } = req.params;

      if (!propertyId) {
        return res.status(403).json({
          success: false,
          error: 'Staff user must be assigned to a property, or admin must specify propertyId'
        });
      }

      const room = await Room.findOne({
        where: { id, propertyId }
      });

      if (!room) {
        return res.status(404).json({
          success: false,
          error: 'Room not found or not in your property'
        });
      }

      await room.destroy();

      res.json({
        success: true,
        message: 'Room deleted successfully'
      });
    } catch (error: any) {
      console.error('Error deleting room:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete room',
        message: error.message
      });
    }
  }

  /**
   * Sincronizar habitaciones desde el PMS
   * REFERENCE ONLY architecture: Solo guarda mapeos, obtiene datos del PMS en tiempo real
   */
  async syncRooms(req: AuthRequest, res: Response) {
    try {
      const isAdmin = (req.user as any)?.Role?.name === 'admin';
      const propertyId = isAdmin && req.body.propertyId 
        ? req.body.propertyId 
        : req.user?.property_id;

      if (!propertyId) {
        return res.status(403).json({
          success: false,
          error: 'Staff user must be assigned to a property, or admin must specify propertyId'
        });
      }

      const property = await Property.findByPk(propertyId);

      if (!property) {
        return res.status(404).json({
          success: false,
          error: 'Property not found'
        });
      }

      if (!property.pms_provider || property.pms_provider === 'none') {
        return res.status(400).json({
          success: false,
          error: 'No PMS configured for this property'
        });
      }

      // Usar roomSyncService para sincronizar
      const result = await roomSyncService.syncRoomsFromPMS(propertyId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: 'Sync failed',
          details: result.errors
        });
      }

      // Obtener habitaciones sincronizadas enriquecidas
      const roomsLocal = await Room.findAll({ where: { propertyId } });
      const enrichedRooms = await RoomEnrichmentService.enrichRooms(roomsLocal);

      res.json({
        success: true,
        data: {
          created: result.created,
          updated: result.updated,
          rooms: enrichedRooms
        },
        message: result.summary
      });
    } catch (error: any) {
      console.error('Error syncing rooms:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to sync rooms',
        message: error.message
      });
    }
  }

  /**
   * @deprecated Usar syncRooms en su lugar (nuevo endpoint llamado cuando presionan el botón)
   * Importar habitaciones desde PMS (legacy)
   */
  async importFromPMS(req: AuthRequest, res: Response) {
    try {
      const isAdmin = (req.user as any)?.Role?.name === 'admin';
      const propertyId = isAdmin && req.body.propertyId 
        ? req.body.propertyId 
        : req.user?.property_id;

      if (!propertyId) {
        return res.status(403).json({
          success: false,
          error: 'Staff user must be assigned to a property, or admin must specify propertyId'
        });
      }

      // Redirigir al nuevo endpoint
      return this.syncRooms(req, res);
    } catch (error: any) {
      console.error('Error importing rooms from PMS:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to import rooms from PMS',
        message: error.message
      });
    }
  }

  /**
   * Activar/desactivar habitación en marketplace
   */
  async toggleMarketplace(req: AuthRequest, res: Response) {
    try {
      const isAdmin = (req.user as any)?.Role?.name === 'admin';
      const propertyId = isAdmin && req.body.propertyId 
        ? req.body.propertyId 
        : req.user?.property_id;
      const { id } = req.params;
      const { enabled } = req.body;

      if (!propertyId) {
        return res.status(403).json({
          success: false,
          error: 'Staff user must be assigned to a property, or admin must specify propertyId'
        });
      }

      if (enabled === undefined) {
        return res.status(400).json({
          success: false,
          error: 'enabled field is required'
        });
      }

      const room = await Room.findOne({
        where: { id, propertyId }
      });

      if (!room) {
        return res.status(404).json({
          success: false,
          error: 'Room not found or not in your property'
        });
      }

      await room.update({ isMarketplaceEnabled: enabled });
      
      // Enriquecer respuesta con datos del PMS
      const enriched = await RoomEnrichmentService.enrichRoom(room);

      res.json({
        success: true,
        data: enriched,
        message: `Room ${enabled ? 'enabled' : 'disabled'} in marketplace`
      });
    } catch (error: any) {
      console.error('Error toggling marketplace:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to toggle marketplace status',
        message: error.message
      });
    }
  }
}

export default new StaffRoomController();
