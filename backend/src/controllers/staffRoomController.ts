import { Request, Response } from 'express';
import TimeshareUnit from '../models/v2/TimeshareUnit';
import { Property, User } from '../models';
import productSyncService from '../services/productSyncService';

// Helper: format a TimeshareUnit as a unified room response
function formatUnit(u: any) {
  return {
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
  };
}

interface AuthRequest extends Request {
  user?: User & { property_id?: number | null; role?: string };
}

class StaffRoomController {
  /**
   * Listar habitaciones del hotel: rooms table + timeshare_units, para la propiedad del staff
   */
  async getRoomsByProperty(req: AuthRequest, res: Response) {
    try {
      let propertyId: number | undefined;
      if (req.query.propertyId) {
        propertyId = Number(req.query.propertyId);
      } else if (req.user?.property_id) {
        propertyId = req.user.property_id;
      }

      const where: any = propertyId ? { property_id: propertyId } : {};
      const units = await TimeshareUnit.findAll({ where, order: [['id', 'ASC']] });
      const data = units.map((u: any) => formatUnit(u));

      res.json({ success: true, data, count: data.length });
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

      const { name, description, capacity, quantity, base_price, basePrice, status, images } = req.body;

      if (!name) return res.status(400).json({ success: false, error: 'name is required' });

      const unit = await TimeshareUnit.create({
        category: name,
        description: description || null,
        capacity_max: capacity ? Number(capacity) : 2,
        capacity_min: 1,
        quantity: Math.max(1, parseInt(quantity) || 1),
        base_credit_value: Number(base_price ?? basePrice ?? 0),
        is_active: status !== 'unavailable',
        images: images ? JSON.stringify(images) : null,
        property_id: propertyId,
      } as any);

      return res.status(201).json({ success: true, data: formatUnit(unit), message: 'Room created successfully' });
    } catch (error: any) {
      console.error('Error creating room:', error);
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
      const unit = await TimeshareUnit.findByPk(id);
      if (!unit) return res.status(404).json({ success: false, error: 'Room not found' });

      const { name, description, capacity, quantity, base_price, basePrice, status, images, is_marketplace_enabled } = req.body;

      await unit.update({
        ...(name !== undefined && { category: name }),
        ...(description !== undefined && { description }),
        ...(capacity !== undefined && { capacity_max: Number(capacity) }),
        ...(quantity !== undefined && { quantity: Math.max(1, parseInt(quantity) || 1) }),
        ...((base_price !== undefined || basePrice !== undefined) && { base_credit_value: Number(base_price ?? basePrice) }),
        ...(status !== undefined && { is_active: status !== 'unavailable' }),
        ...(images !== undefined && { images: JSON.stringify(images) }),
        ...(is_marketplace_enabled !== undefined && { is_active: !!is_marketplace_enabled }),
      });

      const updated = await TimeshareUnit.findByPk(id);
      res.json({ success: true, data: formatUnit(updated), message: 'Room updated successfully' });
    } catch (error: any) {
      console.error('Error updating room:', error);
      res.status(500).json({ success: false, error: 'Failed to update room', message: error.message });
    }
  }

  /**
   * Eliminar habitación
   */
  async deleteRoom(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const unit = await TimeshareUnit.findByPk(id);
      if (!unit) return res.status(404).json({ success: false, error: 'Room not found' });

      await unit.destroy();
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

      // V2: room units come from timeshare_units table; sync products only
      const productsResult = await productSyncService.syncProductsFromPMS(propertyId).catch((error: any) => {
        console.warn('[SyncRooms] Product sync failed, continuing:', error.message);
        return { success: false, created: 0, updated: 0, deactivated: 0, errors: [error.message], summary: undefined };
      });

      res.json({
        success: true,
        data: {
          rooms: { created: 0, updated: 0, total: 0 },
          products: {
            created: productsResult.created,
            updated: productsResult.updated,
            deactivated: productsResult.deactivated,
            total: (productsResult.created || 0) + (productsResult.updated || 0),
            success: productsResult.success
          }
        },
        message: `V2: Timeshare units managed via timeshare_units table.${productsResult.success ? ` Products: ${productsResult.summary || 'synced'}` : ''}`
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

      if (enabled === undefined) return res.status(400).json({ success: false, error: 'enabled field is required' });

      const unit = await TimeshareUnit.findByPk(id);
      if (!unit) return res.status(404).json({ success: false, error: 'Room not found' });

      await unit.update({ is_active: !!enabled });
      const updated = await TimeshareUnit.findByPk(id);
      res.json({
        success: true,
        data: formatUnit(updated),
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

      const where: any = propertyId ? { property_id: propertyId } : {};
      const [updatedCount] = await TimeshareUnit.update({ is_active: enabled }, { where });

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
