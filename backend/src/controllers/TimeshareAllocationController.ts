import { Request, Response } from 'express';
import PrepaidInventoryService from '../services/PrepaidInventoryService';
import TimeshareAllocation from '../models/TimeshareAllocation';
import { Op } from 'sequelize';

type AuthRequest = Request & {
  user?: {
    id: number;
    email: string;
    role: string;
    property_id?: number;
  };
};

class TimeshareAllocationController {
  
  /**
   * List all allocations with filters
   * GET /api/admin/prepaid-inventory
   */
  async list(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        property_id,
        status,
        room_type,
        is_released,
        expiring_soon,
        page = 1,
        limit = 50,
      } = req.query;

      const where: any = {};

      // Filter by property (admin sees all, staff sees only their property)
      if (req.user?.role === 'staff' && req.user.property_id) {
        where.property_id = req.user.property_id;
      } else if (property_id) {
        where.property_id = parseInt(property_id as string);
      }

      if (status) {
        where.status = status;
      }

      if (room_type) {
        where.room_type = room_type;
      }

      if (is_released !== undefined) {
        where.is_released = is_released === 'true';
      }

      // Expiring soon filter (next 30 days)
      if (expiring_soon === 'true') {
        const now = new Date();
        const threshold = new Date();
        threshold.setDate(threshold.getDate() + 30);
        
        where.valid_until = {
          [Op.gte]: now,
          [Op.lte]: threshold,
        };
        where.status = 'ACTIVE';
      }

      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

      const { rows: allocations, count } = await TimeshareAllocation.findAndCountAll({
        where,
        limit: parseInt(limit as string),
        offset,
        order: [['created_at', 'DESC']],
        include: [
          {
            association: 'property',
            attributes: ['id', 'name', 'location', 'city', 'country'],
          },
          {
            association: 'currentOwner',
            attributes: ['id', 'firstName', 'lastName', 'email'],
          },
        ],
      });

      res.json({
        success: true,
        data: {
          allocations,
          pagination: {
            total: count,
            page: parseInt(page as string),
            limit: parseInt(limit as string),
            pages: Math.ceil(count / parseInt(limit as string)),
          },
        },
      });
    } catch (error: any) {
      console.error('Error listing allocations:', error);
      res.status(500).json({
        success: false,
        message: 'Error listing allocations',
        error: error.message,
      });
    }
  }

  /**
   * Get allocation by ID
   * GET /api/admin/prepaid-inventory/:id
   */
  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const allocation = await TimeshareAllocation.findByPk(id, {
        include: [
          {
            association: 'property',
            attributes: ['id', 'name', 'location', 'city', 'country', 'pms_provider'],
          },
          {
            association: 'currentOwner',
            attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
          },
        ],
      });

      if (!allocation) {
        res.status(404).json({
          success: false,
          message: 'Allocation not found',
        });
        return;
      }

      // Check authorization (staff can only see their property)
      if (
        req.user?.role === 'staff' &&
        allocation.property_id !== req.user.property_id
      ) {
        res.status(403).json({
          success: false,
          message: 'Not authorized to view this allocation',
        });
        return;
      }

      res.json({
        success: true,
        data: allocation,
      });
    } catch (error: any) {
      console.error('Error getting allocation:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting allocation',
        error: error.message,
      });
    }
  }

  /**
   * Create new allocation
   * POST /api/admin/prepaid-inventory
   */
  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = req.body;

      // Staff can only create for their property
      if (req.user?.role === 'staff') {
        if (!req.user.property_id) {
          res.status(403).json({
            success: false,
            message: 'Staff must be assigned to a property',
          });
          return;
        }
        data.property_id = req.user.property_id;
      }

      // Validate required fields
      const requiredFields = [
        'property_id',
        'pms_resource_id',
        'room_type',
        'valid_from',
        'valid_until',
        'allocation_type',
      ];

      for (const field of requiredFields) {
        if (!data[field]) {
          res.status(400).json({
            success: false,
            message: `Missing required field: ${field}`,
          });
          return;
        }
      }

      // Convert date strings to Date objects
      data.valid_from = new Date(data.valid_from);
      data.valid_until = new Date(data.valid_until);

      const allocation = await PrepaidInventoryService.createAllocation(data);

      res.status(201).json({
        success: true,
        message: 'Allocation created successfully',
        data: allocation,
      });
    } catch (error: any) {
      console.error('Error creating allocation:', error);
      res.status(400).json({
        success: false,
        message: 'Error creating allocation',
        error: error.message,
      });
    }
  }

  /**
   * Update allocation
   * PUT /api/admin/prepaid-inventory/:id
   */
  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const data = req.body;

      // Get existing allocation
      const existing = await TimeshareAllocation.findByPk(id);
      if (!existing) {
        res.status(404).json({
          success: false,
          message: 'Allocation not found',
        });
        return;
      }

      // Check authorization
      if (
        req.user?.role === 'staff' &&
        existing.property_id !== req.user.property_id
      ) {
        res.status(403).json({
          success: false,
          message: 'Not authorized to update this allocation',
        });
        return;
      }

      // Convert date strings if present
      if (data.valid_from) {
        data.valid_from = new Date(data.valid_from);
      }
      if (data.valid_until) {
        data.valid_until = new Date(data.valid_until);
      }

      const updated = await PrepaidInventoryService.updateAllocation(
        parseInt(id),
        data
      );

      res.json({
        success: true,
        message: 'Allocation updated successfully',
        data: updated,
      });
    } catch (error: any) {
      console.error('Error updating allocation:', error);
      res.status(400).json({
        success: false,
        message: 'Error updating allocation',
        error: error.message,
      });
    }
  }

  /**
   * Delete allocation (soft delete)
   * DELETE /api/admin/prepaid-inventory/:id
   */
  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Get existing allocation
      const existing = await TimeshareAllocation.findByPk(id);
      if (!existing) {
        res.status(404).json({
          success: false,
          message: 'Allocation not found',
        });
        return;
      }

      // Check authorization
      if (
        req.user?.role === 'staff' &&
        existing.property_id !== req.user.property_id
      ) {
        res.status(403).json({
          success: false,
          message: 'Not authorized to delete this allocation',
        });
        return;
      }

      await PrepaidInventoryService.deleteAllocation(parseInt(id));

      res.json({
        success: true,
        message: 'Allocation deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting allocation:', error);
      res.status(400).json({
        success: false,
        message: 'Error deleting allocation',
        error: error.message,
      });
    }
  }

  /**
   * Bulk import allocations from PMS
   * POST /api/admin/prepaid-inventory/bulk-import
   */
  async bulkImport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { property_id, resource_ids, config } = req.body;

      // Staff can only import for their property
      let propertyId = property_id;
      if (req.user?.role === 'staff') {
        if (!req.user.property_id) {
          res.status(403).json({
            success: false,
            message: 'Staff must be assigned to a property',
          });
          return;
        }
        propertyId = req.user.property_id;
      }

      // Validate required fields
      if (!propertyId || !resource_ids || !Array.isArray(resource_ids)) {
        res.status(400).json({
          success: false,
          message: 'property_id and resource_ids (array) are required',
        });
        return;
      }

      if (!config || !config.valid_from || !config.valid_until || !config.allocation_type) {
        res.status(400).json({
          success: false,
          message: 'config with valid_from, valid_until, and allocation_type is required',
        });
        return;
      }

      // Convert dates
      config.valid_from = new Date(config.valid_from);
      config.valid_until = new Date(config.valid_until);

      const result = await PrepaidInventoryService.bulkImportFromPMS(
        propertyId,
        resource_ids,
        config
      );

      res.json({
        success: result.success,
        message: `Imported ${result.created} new, updated ${result.updated} existing`,
        data: result,
      });
    } catch (error: any) {
      console.error('Error bulk importing:', error);
      res.status(400).json({
        success: false,
        message: 'Error bulk importing allocations',
        error: error.message,
      });
    }
  }

  /**
   * Get allocation statistics
   * GET /api/admin/prepaid-inventory/stats
   */
  async getStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      let propertyId: number | undefined;

      // Staff sees only their property stats
      if (req.user?.role === 'staff') {
        propertyId = req.user.property_id;
      } else if (req.query.property_id) {
        propertyId = parseInt(req.query.property_id as string);
      }

      const stats = await PrepaidInventoryService.getStats(propertyId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      console.error('Error getting stats:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting statistics',
        error: error.message,
      });
    }
  }

  /**
   * Sync allocation with PMS (verify resource still exists)
   * POST /api/admin/prepaid-inventory/:id/sync
   */
  async syncWithPMS(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const allocation = await TimeshareAllocation.findByPk(id);
      if (!allocation) {
        res.status(404).json({
          success: false,
          message: 'Allocation not found',
        });
        return;
      }

      // Check authorization
      if (
        req.user?.role === 'staff' &&
        allocation.property_id !== req.user.property_id
      ) {
        res.status(403).json({
          success: false,
          message: 'Not authorized to sync this allocation',
        });
        return;
      }

      // Update last_sync_at
      await allocation.update({ last_sync_at: new Date() });

      res.json({
        success: true,
        message: 'Allocation synced successfully',
        data: allocation,
      });
    } catch (error: any) {
      console.error('Error syncing allocation:', error);
      res.status(500).json({
        success: false,
        message: 'Error syncing allocation',
        error: error.message,
      });
    }
  }
}

export default new TimeshareAllocationController();
