/**
 * UnitController
 * Manages CRUD operations for timeshare units (categories)
 * Phase 7: Admin Tools
 */

import { Request, Response } from 'express';
import TimeshareUnit from '../models/v2/TimeshareUnit';
import TimeshareProperty from '../models/v2/TimeshareProperty';
import { AuthRequest } from '../middleware/authMiddleware';

class UnitController {
  /**
   * List all units (admin) or units for staff's property
   * GET /api/admin/units
   */
  async list(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const isAdmin = user.role_id === 1; // Assuming role_id 1 is admin
      
      // Query parameters
      const {
        property_id,
        category,
        is_active,
        page = '1',
        limit = '50'
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      // Build where clause
      const where: any = {};
      
      // Staff can only see units from their property
      if (!isAdmin && user.property_id) {
        where.property_id = user.property_id;
      } else if (property_id) {
        where.property_id = property_id;
      }

      if (category) {
        where.category = { [require('sequelize').Op.like]: `%${category}%` };
      }

      if (is_active !== undefined) {
        where.is_active = is_active === 'true';
      }

      const { rows: units, count } = await TimeshareUnit.findAndCountAll({
        where,
        include: [{
          model: TimeshareProperty,
          as: 'Property',
          attributes: ['id', 'name', 'city', 'country']
        }],
        order: [['property_id', 'ASC'], ['category', 'ASC']],
        limit: limitNum,
        offset
      });

      res.json({
        success: true,
        data: units,
        meta: {
          total: count,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(count / limitNum)
        }
      });
    } catch (error: any) {
      console.error('Error listing units:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list units',
        details: error.message
      });
    }
  }

  /**
   * Get unit by ID
   * GET /api/admin/units/:id
   */
  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const user = req.user!;
      const isAdmin = user.role_id === 1;

      const where: any = { id };
      
      // Staff can only see units from their property
      if (!isAdmin && user.property_id) {
        where.property_id = user.property_id;
      }

      const unit = await TimeshareUnit.findOne({
        where,
        include: [{
          model: TimeshareProperty,
          as: 'Property',
          attributes: ['id', 'name', 'city', 'country']
        }]
      });

      if (!unit) {
        res.status(404).json({
          success: false,
          error: 'Unit not found'
        });
        return;
      }

      res.json({
        success: true,
        data: unit
      });
    } catch (error: any) {
      console.error('Error getting unit:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get unit',
        details: error.message
      });
    }
  }

  /**
   * Get units by property
   * GET /api/admin/properties/:propertyId/units
   */
  async getByProperty(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { propertyId } = req.params;
      const user = req.user!;
      const isAdmin = user.role_id === 1;

      // Staff can only see units from their property
      if (!isAdmin && user.property_id && parseInt(propertyId) !== user.property_id) {
        res.status(403).json({
          success: false,
          error: 'Access denied to this property'
        });
        return;
      }

      const units = await TimeshareUnit.findAll({
        where: { property_id: propertyId },
        order: [['category', 'ASC']]
      });

      res.json({
        success: true,
        data: units
      });
    } catch (error: any) {
      console.error('Error getting units by property:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get units',
        details: error.message
      });
    }
  }

  /**
   * Create a new unit
   * POST /api/admin/units
   */
  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const isAdmin = user.role_id === 1;

      const {
        property_id,
        category,
        capacity_min,
        capacity_max,
        quantity,
        bedrooms,
        bathrooms,
        size_sqm,
        floor_range,
        base_credit_value,
        seasonal_factors,
        description,
        amenities,
        images,
        view_type
      } = req.body;

      // Validate required fields
      if (!property_id || !category || !capacity_max || !quantity || !base_credit_value) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: property_id, category, capacity_max, quantity, base_credit_value'
        });
        return;
      }

      // Staff can only create units for their property
      if (!isAdmin) {
        if (!user.property_id || property_id !== user.property_id) {
          res.status(403).json({
            success: false,
            error: 'You can only create units for your assigned property'
          });
          return;
        }
      }

      // Verify property exists
      const property = await TimeshareProperty.findByPk(property_id);
      if (!property) {
        res.status(404).json({
          success: false,
          error: 'Property not found'
        });
        return;
      }

      // Generate slug
      const slug = `${property.slug}-${category.toLowerCase().replace(/\s+/g, '-')}`;

      // Create unit
      const unit = await TimeshareUnit.create({
        property_id,
        category,
        slug,
        capacity_min: capacity_min || 1,
        capacity_max,
        quantity,
        bedrooms: bedrooms || 0,
        bathrooms: bathrooms || 1.0,
        size_sqm,
        floor_range,
        base_credit_value,
        seasonal_factors,
        currency: 'EUR',
        description,
        amenities: amenities || [],
        images: images || [],
        view_type: view_type || 'NO_VIEW',
        is_active: true
      });

      res.status(201).json({
        success: true,
        data: unit,
        message: 'Unit created successfully'
      });
    } catch (error: any) {
      console.error('Error creating unit:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create unit',
        details: error.message
      });
    }
  }

  /**
   * Update unit
   * PUT /api/admin/units/:id
   */
  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const user = req.user!;
      const isAdmin = user.role_id === 1;

      // Find unit
      const where: any = { id };
      if (!isAdmin && user.property_id) {
        where.property_id = user.property_id;
      }

      const unit = await TimeshareUnit.findOne({ where });

      if (!unit) {
        res.status(404).json({
          success: false,
          error: 'Unit not found or access denied'
        });
        return;
      }

      // Update fields
      const {
        category,
        capacity_min,
        capacity_max,
        quantity,
        bedrooms,
        bathrooms,
        size_sqm,
        floor_range,
        base_credit_value,
        seasonal_factors,
        description,
        amenities,
        images,
        view_type,
        is_active
      } = req.body;

      if (category !== undefined) unit.category = category;
      if (capacity_min !== undefined) unit.capacity_min = capacity_min;
      if (capacity_max !== undefined) unit.capacity_max = capacity_max;
      if (quantity !== undefined) unit.quantity = quantity;
      if (bedrooms !== undefined) unit.bedrooms = bedrooms;
      if (bathrooms !== undefined) unit.bathrooms = bathrooms;
      if (size_sqm !== undefined) unit.size_sqm = size_sqm;
      if (floor_range !== undefined) unit.floor_range = floor_range;
      if (base_credit_value !== undefined) unit.base_credit_value = base_credit_value;
      if (seasonal_factors !== undefined) unit.seasonal_factors = seasonal_factors;
      if (description !== undefined) unit.description = description;
      if (amenities !== undefined) unit.amenities = amenities;
      if (images !== undefined) unit.images = images;
      // if (view_type !== undefined) unit.view_type = view_type; // Field doesn't exist in model
      if (is_active !== undefined) unit.is_active = is_active;

      await unit.save();

      res.json({
        success: true,
        data: unit,
        message: 'Unit updated successfully'
      });
    } catch (error: any) {
      console.error('Error updating unit:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update unit',
        details: error.message
      });
    }
  }

  /**
   * Delete unit (soft delete by setting is_active = false)
   * DELETE /api/admin/units/:id
   */
  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const user = req.user!;
      const isAdmin = user.role_id === 1;

      // Find unit
      const where: any = { id };
      if (!isAdmin && user.property_id) {
        where.property_id = user.property_id;
      }

      const unit = await TimeshareUnit.findOne({ where });

      if (!unit) {
        res.status(404).json({
          success: false,
          error: 'Unit not found or access denied'
        });
        return;
      }

      // Soft delete
      unit.is_active = false;
      await unit.save();

      res.json({
        success: true,
        message: 'Unit deactivated successfully'
      });
    } catch (error: any) {
      console.error('Error deleting unit:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete unit',
        details: error.message
      });
    }
  }

  /**
   * Bulk create units
   * POST /api/admin/units/bulk
   */
  async bulkCreate(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { units } = req.body;
      const user = req.user!;
      const isAdmin = user.role_id === 1;

      if (!Array.isArray(units) || units.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Invalid units array'
        });
        return;
      }

      const results = {
        created: [] as any[],
        failed: [] as any[]
      };

      for (const unitData of units) {
        try {
          // Staff can only create units for their property
          if (!isAdmin && (!user.property_id || unitData.property_id !== user.property_id)) {
            results.failed.push({
              data: unitData,
              error: 'Access denied to this property'
            });
            continue;
          }

          // Verify property exists
          const property = await TimeshareProperty.findByPk(unitData.property_id);
          if (!property) {
            results.failed.push({
              data: unitData,
              error: 'Property not found'
            });
            continue;
          }

          // Generate slug
          const slug = `${property.slug}-${unitData.category.toLowerCase().replace(/\s+/g, '-')}`;

          // Create unit
          const unit = await TimeshareUnit.create({
            ...unitData,
            slug,
            currency: 'EUR',
            is_active: true
          });

          results.created.push(unit);
        } catch (error: any) {
          results.failed.push({
            data: unitData,
            error: error.message
          });
        }
      }

      res.status(201).json({
        success: true,
        data: results,
        message: `Created ${results.created.length} units, ${results.failed.length} failed`
      });
    } catch (error: any) {
      console.error('Error bulk creating units:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to bulk create units',
        details: error.message
      });
    }
  }
}

export default new UnitController();
