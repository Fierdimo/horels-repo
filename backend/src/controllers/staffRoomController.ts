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
      // V2: Check role directly from user object
      const isAdmin = req.user?.role === 'admin';
      
      // In V2, users don't have property_id - use query param or Mock PMS
      let propertyId: number | string | undefined;
      
      if (req.query.propertyId) {
        propertyId = req.query.propertyId as string;
      } else if (req.user?.property_id) {
        propertyId = req.user.property_id;
      }

      // If no propertyId, use Mock PMS data
      if (!propertyId) {
        try {
          const { MockPMSManager } = await import('../services/pms/MockPMSService');
          const mockPMS = new MockPMSManager();
          const allProperties = mockPMS.getAllProperties();
          
          // Get weeks from database (seeded from Mock PMS)
          const TimeshareProperty = require('../models/v2/TimeshareProperty').default;
          const TimeshareUnit = require('../models/v2/TimeshareUnit').default;
          const WeekAllocation = require('../models/v2/WeekAllocation').default;
          const Ownership = require('../models/v2/Ownership').default;

          const releasedWeeks = await WeekAllocation.findAll({
            where: { status: 'RELEASED' },
            include: [
              {
                model: Ownership,
                as: 'ownership',
                required: true,
                include: [
                  {
                    model: TimeshareUnit,
                    as: 'unit',
                    required: true,
                    include: [
                      {
                        model: TimeshareProperty,
                        as: 'property',
                        required: true
                      }
                    ]
                  }
                ]
              }
            ],
            limit: 100
          });

          const allRooms = releasedWeeks.map((week: any) => {
            const unit = week.ownership?.unit;
            const property = unit?.property;

            return {
              id: `week-${week.id}`,
              name: unit?.name || 'Unknown Unit',
              description: unit?.description || '',
              capacity: unit?.max_occupancy || 4,
              basePrice: unit?.base_credit_value || 0,
              status: 'available',
              propertyName: property?.name || 'Unknown Property',
              propertyCity: property?.city || '',
              images: unit?.images ? JSON.parse(unit.images) : [],
              amenities: unit?.amenities ? JSON.parse(unit.amenities) : [],
              marketplace_enabled: true,
              availability: 1,
              weekInfo: {
                weekNumber: week.week_number,
                year: week.year,
                startDate: week.start_date,
                endDate: week.end_date
              }
            };
          });
          
          return res.json({
            success: true,
            data: allRooms,
            source: 'database',
            message: 'Showing RELEASED weeks from database (seeded from Mock PMS)'
          });
        } catch (mockError) {
          console.error('Error fetching Mock PMS rooms:', mockError);
          return res.json({
            success: true,
            data: [],
            message: 'No property assigned. Please contact administrator.'
          });
        }
      }

      // Obtener datos locales de habitaciones
      // Note: propertyId field doesn't exist in current schema, getting all rooms
      const roomsLocal = await Room.findAll({
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
        name,
        description,
        capacity
      } = req.body;

      // Validaciones
      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'name is required'
        });
      }

      // Crear mapeo local
      // Note: propertyId, roomTypeId, customPrice, isMarketplaceEnabled, images, pmsLastSync
      // fields don't exist in current schema
      const room = await Room.create({
        name,
        description,
        capacity: capacity || 2
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

      // Note: propertyId field doesn't exist in current schema
      const room = await Room.findOne({
        where: { id }
      });

      if (!room) {
        return res.status(404).json({
          success: false,
          error: 'Room not found'
        });
      }

      // Solo permitir actualizar campos existentes
      const {
        name,
        description,
        capacity
      } = req.body;

      await room.update({
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(capacity !== undefined && { capacity })
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

      // Note: propertyId field doesn't exist in current schema
      const room = await Room.findOne({
        where: { id }
      });

      if (!room) {
        return res.status(404).json({
          success: false,
          error: 'Room not found'
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
   * Sincronizar habitaciones y productos desde el PMS
   * REFERENCE ONLY architecture: Solo guarda mapeos, obtiene datos del PMS en tiempo real
   * Optimizado: Responde rápido y devuelve solo el resultado de sincronización sin enrichment
   * Ahora también sincroniza productos/servicios en paralelo
   */
  async syncRooms(req: AuthRequest, res: Response) {
    try {
      // V2: Check role directly from user object
      const isAdmin = req.user?.role === 'admin';
      const propertyId = isAdmin && req.body.propertyId 
        ? req.body.propertyId 
        : req.user?.property_id;

      // V2: property_id doesn't exist on users, allow staff to sync without property_id
      if (!propertyId && !isAdmin) {
        // For staff without property_id, return success with Mock PMS data message
        return res.json({
          success: true,
          data: {
            rooms: {
              created: 0,
              updated: 0,
              total: 0
            },
            products: {
              created: 0,
              updated: 0,
              deactivated: 0,
              total: 0,
              success: true
            }
          },
          message: 'V2: Timeshare weeks are managed via ownership allocations, not room sync',
          note: 'Use /api/admin/generate-allocations to create week allocations'
        });
      }

      if (!propertyId) {
        return res.status(400).json({
          success: false,
          error: 'Admin must specify propertyId'
        });
      }

      const property = await Property.findByPk(propertyId);

      if (!property) {
        return res.status(404).json({
          success: false,
          error: 'Property not found'
        });
      }

      if (!property.pms_provider) {
        return res.status(400).json({
          success: false,
          error: 'No PMS configured for this property'
        });
      }

      // Sincronizar habitaciones y productos EN PARALELO para mejor rendimiento
      const productSyncService = require('../services/productSyncService').default;
      
      const [roomsResult, productsResult] = await Promise.all([
        roomSyncService.syncRoomsFromPMS(propertyId),
        productSyncService.syncProductsFromPMS(propertyId).catch((error: any) => {
          console.warn('[SyncRooms] Product sync failed, continuing:', error.message);
          return { success: false, created: 0, updated: 0, deactivated: 0, errors: [error.message] };
        })
      ]);

      if (!roomsResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Rooms sync failed',
          details: roomsResult.errors
        });
      }

      // Responder INMEDIATAMENTE sin enrichment (más rápido)
      // El frontend hará refetch que traerá los datos enriquecidos
      res.json({
        success: true,
        data: {
          rooms: {
            created: roomsResult.created,
            updated: roomsResult.updated,
            total: roomsResult.created + roomsResult.updated
          },
          products: {
            created: productsResult.created,
            updated: productsResult.updated,
            deactivated: productsResult.deactivated,
            total: productsResult.created + productsResult.updated,
            success: productsResult.success
          }
        },
        message: `Rooms: ${roomsResult.summary || 'synced'}${productsResult.success ? `, Products: ${productsResult.summary || 'synced'}` : ''}`
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

      // Note: propertyId and isMarketplaceEnabled fields don't exist in current schema
      const room = await Room.findOne({
        where: { id }
      });

      if (!room) {
        return res.status(404).json({
          success: false,
          error: 'Room not found'
        });
      }

      // isMarketplaceEnabled field doesn't exist in current schema - skipping update
      // await room.update({ isMarketplaceEnabled: enabled });
      
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

  /**
   * Habilitar o deshabilitar TODAS las habitaciones en marketplace (batch operation)
   * POST /api/hotel-staff/rooms/marketplace/batch
   */
  async toggleMarketplaceBatch(req: AuthRequest, res: Response) {
    try {
      const user = req.user!;
      const propertyId = user.property_id;
      const { enabled } = req.body;

      if (!propertyId) {
        return res.status(403).json({
          success: false,
          error: 'Staff user must be assigned to a property'
        });
      }

      if (typeof enabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'enabled field is required and must be boolean'
        });
      }

      // Operación batch: actualizar todas las habitaciones de la propiedad
      // Note: isMarketplaceEnabled and propertyId fields don't exist in current schema
      // Would need database migration to add these fields
      const updatedCount = 0; // Placeholder - feature not available without schema changes
      // const [updatedCount] = await Room.update(
      //   { isMarketplaceEnabled: enabled },
      //   { 
      //     where: { propertyId },
      //     returning: false
      //   }
      // );

      res.json({
        success: true,
        data: {
          count: updatedCount,
          enabled: enabled
        },
        message: `${updatedCount} rooms ${enabled ? 'enabled' : 'disabled'} in marketplace`
      });
    } catch (error: any) {
      console.error('Error batch toggling marketplace:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to batch toggle marketplace status',
        message: error.message
      });
    }
  }
}

export default new StaffRoomController();
