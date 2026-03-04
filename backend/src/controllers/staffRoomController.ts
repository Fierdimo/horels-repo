import { Request, Response } from 'express';
import Room from '../models/room';
import TimeshareUnit from '../models/v2/TimeshareUnit';
import { Property, User } from '../models';
import { RoomSyncService } from '../services/roomSyncService';
import RoomEnrichmentService from '../services/roomEnrichmentService';
import productSyncService from '../services/productSyncService';

const roomSyncService = new RoomSyncService();

interface AuthRequest extends Request {
  user?: User & { property_id?: number | null; role?: string };
}

class StaffRoomController {
  /**
   * Listar habitaciones del hotel: rooms table + timeshare_units, para la propiedad del staff
   */
  async getRoomsByProperty(req: AuthRequest, res: Response) {
    try {
      const isAdmin = req.user?.role === 'admin';

      let propertyId: number | undefined;
      if (req.query.propertyId) {
        propertyId = Number(req.query.propertyId);
      } else if (req.user?.property_id) {
        propertyId = req.user.property_id;
      }

      const where: any = {};
      if (propertyId) where.property_id = propertyId;

      // ── 1. Hotel rooms (rooms table) ──────────────────────────
      const hotelRooms = await Room.findAll({ where, order: [['createdAt', 'ASC']] });
      const enrichedHotelRooms = (await RoomEnrichmentService.enrichRooms(hotelRooms)).map(r => ({
        ...r,
        source: 'hotel' as const,
      }));

      // ── 2. Timeshare units (timeshare_units table) ────────────
      const tsWhere: any = propertyId ? { property_id: propertyId } : {};
      const tsUnits = await TimeshareUnit.findAll({ where: tsWhere, order: [['id', 'ASC']] });
      const enrichedTsUnits = tsUnits.map((u: any) => ({
        id: u.id,
        source: 'timeshare' as const,
        name: u.category,
        description: u.description,
        capacity: u.capacity_max,
        capacityMin: u.capacity_min,
        quantity: u.quantity,
        basePrice: Number(u.base_credit_value) || 0,
        base_price: Number(u.base_credit_value) || 0,
        price: Number(u.base_credit_value) || 0,
        status: u.is_active ? 'available' : 'unavailable',
        images: (() => { try { return u.images ? JSON.parse(u.images) : []; } catch { return []; } })(),
        isMarketplaceEnabled: !!u.is_active,
        property_id: u.property_id,
        bedrooms: u.bedrooms,
        bathrooms: u.bathrooms,
        sizeSqm: u.size_sqm,
        viewType: u.view_type,
        floorRange: u.floor_range,
        floor: u.floor_range || null,
        type: 'timeshare',
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      }));

      const allRooms = [...enrichedTsUnits, ...enrichedHotelRooms];

      res.json({ success: true, data: allRooms, count: allRooms.length });
    } catch (error: any) {
      console.error('Error fetching rooms:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch rooms', message: error.message });
    }
  }

  /**
   * Actualizar un timeshare_unit desde la vista de habitaciones del staff
   */
  async updateTimeshareUnit(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const unit = await TimeshareUnit.findByPk(id);
      if (!unit) return res.status(404).json({ success: false, error: 'Unit not found' });

      const {
        name, description, capacity, quantity,
        base_price, basePrice, status, images,
      } = req.body;

      await unit.update({
        ...(name !== undefined && { category: name }),
        ...(description !== undefined && { description }),
        ...(capacity !== undefined && { capacity_max: Number(capacity) }),
        ...(quantity !== undefined && { quantity: Math.max(1, parseInt(quantity) || 1) }),
        ...((base_price !== undefined || basePrice !== undefined) && {
          base_credit_value: Number(base_price ?? basePrice),
        }),
        ...(status !== undefined && { is_active: status !== 'unavailable' }),
        ...(images !== undefined && { images: JSON.stringify(images) }),
      });

      const updated = await TimeshareUnit.findByPk(id) as any;
      res.json({
        success: true,
        data: {
          id: updated.id,
          source: 'timeshare',
          name: updated.category,
          description: updated.description,
          capacity: updated.capacity_max,
          quantity: updated.quantity,
          basePrice: Number(updated.base_credit_value) || 0,
          status: updated.is_active ? 'available' : 'unavailable',
          images: (() => { try { return updated.images ? JSON.parse(updated.images) : []; } catch { return []; } })(),
          isMarketplaceEnabled: !!updated.is_active,
          property_id: updated.property_id,
        },
        message: 'Unit updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating timeshare unit:', error);
      res.status(500).json({ success: false, error: 'Failed to update unit', message: error.message });
    }
  }

  /**
   * Mapear una habitación del PMS con datos complementarios locales
   * Ya no creamos habitaciones desde cero, las creamos cuando sincronizamos del PMS
   * Este endpoint es para actualizar datos complementarios (images, custom_price, etc)
   */
  async createRoom(req: AuthRequest, res: Response) {
    try {
      const isAdmin = req.user?.role === 'admin';
      const propertyId = (isAdmin && req.body.propertyId)
        ? Number(req.body.propertyId)
        : req.user?.property_id ?? null;

      const {
        name, description, capacity, quantity,
        type, floor, base_price, basePrice,
        status, images, is_marketplace_enabled,
      } = req.body;

      if (!name) {
        return res.status(400).json({ success: false, error: 'name is required' });
      }

      const room = await Room.create({
        name,
        description: description || null,
        capacity: capacity ? Number(capacity) : 2,
        quantity: Math.max(1, parseInt(quantity) || 1),
        type: type || 'standard',
        floor: floor || null,
        base_price: Number(base_price ?? basePrice ?? 0),
        status: (status || 'available') as 'available' | 'occupied' | 'maintenance' | 'unavailable',
        images: images ? JSON.stringify(images) : null,
        is_marketplace_enabled: is_marketplace_enabled ?? false,
        property_id: propertyId,
      });

      const enriched = await RoomEnrichmentService.enrichRoom(room);
      return res.status(201).json({ success: true, data: enriched, message: 'Room created successfully' });
    } catch (error: any) {
      console.error('Error creating room:', error);
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({ success: false, error: 'A room with this name already exists' });
      }
      res.status(500).json({ success: false, error: 'Failed to create room', message: error.message });
    }
  }

  /**
   * Actualizar datos complementarios de una habitación
   * Solo se puede actualizar: customPrice, isMarketplaceEnabled, images, roomTypeId
   * Los datos del PMS (name, capacity, type, etc) vienen del PMS en tiempo real
   */
  async updateRoom(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const room = await Room.findByPk(id);
      if (!room) {
        return res.status(404).json({ success: false, error: 'Room not found' });
      }

      const {
        name, description, capacity, quantity,
        type, floor, base_price, basePrice,
        status, images, is_marketplace_enabled
      } = req.body;

      await room.update({
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(capacity !== undefined && { capacity: Number(capacity) }),
        ...(quantity !== undefined && { quantity: Math.max(1, parseInt(quantity) || 1) }),
        ...(type !== undefined && { type }),
        ...(floor !== undefined && { floor: floor || null }),
        ...((base_price !== undefined || basePrice !== undefined) && {
          base_price: Number(base_price ?? basePrice)
        }),
        ...(status !== undefined && { status }),
        ...(images !== undefined && { images: JSON.stringify(images) }),
        ...(is_marketplace_enabled !== undefined && { is_marketplace_enabled }),
      });

      const enriched = await RoomEnrichmentService.enrichRoom(room);
      res.json({ success: true, data: enriched, message: 'Room updated successfully' });
    } catch (error: any) {
      console.error('Error updating room:', error);
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({ success: false, error: 'A room with this name already exists' });
      }
      res.status(500).json({ success: false, error: 'Failed to update room', message: error.message });
    }
  }

  /**
   * Eliminar habitación
   */
  async deleteRoom(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const room = await Room.findByPk(id);
      if (!room) {
        return res.status(404).json({ success: false, error: 'Room not found' });
      }

      await room.destroy();
      res.json({ success: true, message: 'Room deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting room:', error);
      res.status(500).json({ success: false, error: 'Failed to delete room', message: error.message });
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
      const [roomsResult, productsResult] = await Promise.all([
        roomSyncService.syncRoomsFromPMS(propertyId),
        productSyncService.syncProductsFromPMS(propertyId).catch((error: any) => {
          console.warn('[SyncRooms] Product sync failed, continuing:', error.message);
          return { success: false, created: 0, updated: 0, deactivated: 0, errors: [error.message], summary: undefined };
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
   * Activar/desactivar habitación en marketplace
   */
  async toggleMarketplace(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { enabled } = req.body;

      if (enabled === undefined) {
        return res.status(400).json({ success: false, error: 'enabled field is required' });
      }

      const room = await Room.findByPk(id);
      if (!room) {
        return res.status(404).json({ success: false, error: 'Room not found' });
      }

      await room.update({ is_marketplace_enabled: !!enabled });

      const enriched = await RoomEnrichmentService.enrichRoom(room);
      res.json({
        success: true,
        data: enriched,
        message: `Room ${enabled ? 'enabled' : 'disabled'} in marketplace`
      });
    } catch (error: any) {
      console.error('Error toggling marketplace:', error);
      res.status(500).json({ success: false, error: 'Failed to toggle marketplace status', message: error.message });
    }
  }

  /**
   * Habilitar o deshabilitar TODAS las habitaciones en marketplace (batch operation)
   * POST /api/hotel-staff/rooms/marketplace/batch
   */
  async toggleMarketplaceBatch(req: AuthRequest, res: Response) {
    try {
      const propertyId = req.user?.property_id ?? null;
      const { enabled } = req.body;

      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ success: false, error: 'enabled field is required and must be boolean' });
      }

      const where: any = {};
      if (propertyId) where.property_id = propertyId;

      const [updatedCount] = await Room.update(
        { is_marketplace_enabled: enabled },
        { where }
      );

      res.json({
        success: true,
        data: { count: updatedCount, enabled },
        message: `${updatedCount} rooms ${enabled ? 'enabled' : 'disabled'} in marketplace`
      });
    } catch (error: any) {
      console.error('Error batch toggling marketplace:', error);
      res.status(500).json({ success: false, error: 'Failed to batch toggle marketplace status', message: error.message });
    }
  }
}

export default new StaffRoomController();
