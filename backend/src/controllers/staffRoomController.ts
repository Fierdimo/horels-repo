import { Request, Response } from 'express';
import Room from '../models/room';
import { Property, User } from '../models';
import { PMSFactory } from '../services/pms/PMSFactory';
import { decryptPMSCredentials } from '../utils/pmsEncryption';
import roomSyncService from '../services/roomSyncService';

interface AuthRequest extends Request {
  user?: User & { property_id?: number | null; role?: string };
}

class StaffRoomController {
  /**
   * Listar habitaciones del hotel del staff
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

      const rooms = await Room.findAll({
        where: { propertyId },
        order: [['name', 'ASC']]
      });

      res.json({
        success: true,
        data: rooms,
        count: rooms.length
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
   * Crear nueva habitación
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
        capacity,
        type,
        floor,
        status = 'active',
        amenities,
        basePrice,
        customPrice,
        isMarketplaceEnabled = false,
        images = []
      } = req.body;

      // Validaciones
      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'Room name is required'
        });
      }

      if (!capacity || capacity < 1) {
        return res.status(400).json({
          success: false,
          error: 'Valid capacity is required'
        });
      }

      const room = await Room.create({
        propertyId,
        name,
        description,
        capacity,
        type,
        floor,
        status,
        amenities,
        basePrice,
        customPrice,
        isMarketplaceEnabled,
        images
      });

      res.status(201).json({
        success: true,
        data: room,
        message: 'Room created successfully'
      });
    } catch (error: any) {
      console.error('Error creating room:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create room',
        message: error.message
      });
    }
  }

  /**
   * Actualizar habitación
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

      const {
        name,
        description,
        capacity,
        type,
        floor,
        status,
        amenities,
        basePrice,
        customPrice,
        isMarketplaceEnabled,
        images
      } = req.body;

      await room.update({
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(capacity && { capacity }),
        ...(type !== undefined && { type }),
        ...(floor !== undefined && { floor }),
        ...(status && { status }),
        ...(amenities !== undefined && { amenities }),
        ...(basePrice !== undefined && { basePrice }),
        ...(customPrice !== undefined && { customPrice }),
        ...(isMarketplaceEnabled !== undefined && { isMarketplaceEnabled }),
        ...(images !== undefined && { images })
      });

      res.json({
        success: true,
        data: room,
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
   * Importar habitaciones desde PMS
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

      const property = await Property.findByPk(propertyId);

      if (!property) {
        return res.status(404).json({
          success: false,
          error: 'Property not found'
        });
      }

      // Verificar que tiene PMS configurado
      if (!property.pms_provider || property.pms_provider === 'none') {
        return res.status(400).json({
          success: false,
          error: 'No PMS configured for this property'
        });
      }

      if (!property.pms_credentials) {
        return res.status(400).json({
          success: false,
          error: 'PMS credentials not configured'
        });
      }

      // Desencriptar credenciales
      const credentials = decryptPMSCredentials(property.pms_credentials);

      // Crear adapter PMS
      const adapter = PMSFactory.createAdapter(property.pms_provider, credentials);

      // Obtener habitaciones del PMS
      const availability = await adapter.getAvailability({});
      
      const services = availability?.services || [];
      const resources = availability?.resources || [];

      if (resources.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No rooms found in PMS'
        });
      }

      // Importar habitaciones
      const importedRooms = [];
      const updatedRooms = [];
      const errors = [];

      for (const resource of resources) {
        try {
          // Buscar el servicio (tipo de habitación) correspondiente
          const service = services.find((s: any) => s.Id === resource.ServiceId);
          const roomType = service?.Name || 'Standard';

          // Verificar si ya existe esta habitación (por pms_resource_id)
          const existingRoom = await Room.findOne({
            where: {
              propertyId,
              pmsResourceId: resource.Id
            }
          });

          const roomData = {
            name: resource.Name || `Room ${resource.Id}`,
            description: `Imported from ${property.pms_provider}`,
            capacity: resource.Capacity || 2,
            type: roomType,
            status: 'available',
            pmsResourceId: resource.Id,
            pmsLastSync: new Date(),
            isMarketplaceEnabled: false // Por defecto deshabilitado hasta que staff lo active
          };

          if (existingRoom) {
            // Actualizar habitación existente
            await existingRoom.update(roomData);
            updatedRooms.push(existingRoom);
          } else {
            // Crear nueva habitación
            const newRoom = await Room.create({
              ...roomData,
              propertyId
            });
            importedRooms.push(newRoom);
          }
        } catch (error: any) {
          errors.push({
            resource: resource.Id,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        data: {
          imported: importedRooms.length,
          updated: updatedRooms.length,
          errors: errors.length,
          rooms: [...importedRooms, ...updatedRooms]
        },
        message: `Imported ${importedRooms.length} new rooms, updated ${updatedRooms.length} existing rooms`,
        ...(errors.length > 0 && { errors })
      });
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
   * Sincronizar habitaciones desde el PMS (método simplificado)
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

      // Usar el servicio de sincronización
      const result = await roomSyncService.syncRoomsFromPMS(propertyId);

      if (!result.success && result.errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: result.errors[0],
          details: result
        });
      }

      res.json({
        success: true,
        data: {
          created: result.created,
          updated: result.updated,
          total: result.created + result.updated,
          rooms: result.rooms
        },
        message: `Synchronized ${result.created + result.updated} rooms from PMS (${result.created} new, ${result.updated} updated)`,
        ...(result.errors.length > 0 && { warnings: result.errors })
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
      
      // Refrescar para asegurar que tenemos los datos actualizados
      await room.reload();

      res.json({
        success: true,
        data: room,
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
