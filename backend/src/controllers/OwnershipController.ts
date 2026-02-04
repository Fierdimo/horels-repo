/**
 * OwnershipController
 * Manages CRUD operations for ownerships
 * Phase 7: Admin Tools
 */

import { Request, Response } from 'express';
import Ownership from '../models/v2/Ownership';
import TimeshareUnit from '../models/v2/TimeshareUnit';
import TimeshareProperty from '../models/v2/TimeshareProperty';
import { User } from '../models';
import { AuthRequest } from '../middleware/authMiddleware';

class OwnershipController {
  /**
   * List all ownerships (admin) or ownerships for staff's property
   * GET /api/admin/ownerships
   */
  async list(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const isAdmin = user.role_id === 1;
      
      const {
        property_id,
        unit_id,
        owner_id,
        type,
        status,
        page = '1',
        limit = '50'
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      // Build where clause
      const where: any = {};
      
      // If staff, filter by property through unit
      let propertyFilter: any = {};
      if (!isAdmin && user.property_id) {
        propertyFilter = { property_id: user.property_id };
      } else if (property_id) {
        propertyFilter = { property_id: property_id };
      }

      if (unit_id) where.unit_id = unit_id;
      if (owner_id) where.owner_id = owner_id;
      if (type) where.type = type;
      if (status) where.status = status;

      const { rows: ownerships, count } = await Ownership.findAndCountAll({
        where,
        include: [
          {
            model: TimeshareUnit,
            as: 'Unit',
            where: Object.keys(propertyFilter).length > 0 ? propertyFilter : undefined,
            include: [{
              model: TimeshareProperty,
              as: 'Property',
              attributes: ['id', 'name', 'city', 'country']
            }]
          },
          {
            model: User,
            as: 'Owner',
            attributes: ['id', 'email', 'first_name', 'last_name']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: limitNum,
        offset
      });

      res.json({
        success: true,
        data: ownerships,
        meta: {
          total: count,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(count / limitNum)
        }
      });
    } catch (error: any) {
      console.error('Error listing ownerships:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list ownerships',
        details: error.message
      });
    }
  }

  /**
   * Get ownership by ID
   * GET /api/admin/ownerships/:id
   */
  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const user = req.user!;
      const isAdmin = user.role_id === 1;

      const ownership = await Ownership.findOne({
        where: { id },
        include: [
          {
            model: TimeshareUnit,
            as: 'Unit',
            include: [{
              model: TimeshareProperty,
              as: 'Property',
              attributes: ['id', 'name', 'city', 'country']
            }]
          },
          {
            model: User,
            as: 'Owner',
            attributes: ['id', 'email', 'first_name', 'last_name', 'phone']
          }
        ]
      });

      if (!ownership) {
        res.status(404).json({
          success: false,
          error: 'Ownership not found'
        });
        return;
      }

      // Staff can only see ownerships from their property
      if (!isAdmin && user.property_id) {
        const unit = ownership.unit as any;
        if (unit.property_id !== user.property_id) {
          res.status(403).json({
            success: false,
            error: 'Access denied to this ownership'
          });
          return;
        }
      }

      res.json({
        success: true,
        data: ownership
      });
    } catch (error: any) {
      console.error('Error getting ownership:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get ownership',
        details: error.message
      });
    }
  }

  /**
   * Get ownerships by unit
   * GET /api/admin/units/:unitId/ownerships
   */
  async getByUnit(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { unitId } = req.params;
      const user = req.user!;
      const isAdmin = user.role_id === 1;

      // Verify unit exists and check access
      const unit = await TimeshareUnit.findByPk(unitId);
      if (!unit) {
        res.status(404).json({
          success: false,
          error: 'Unit not found'
        });
        return;
      }

      // Staff can only see units from their property
      if (!isAdmin && user.property_id && unit.property_id !== user.property_id) {
        res.status(403).json({
          success: false,
          error: 'Access denied to this unit'
        });
        return;
      }

      const ownerships = await Ownership.findAll({
        where: { unit_id: unitId },
        include: [{
          model: User,
          as: 'Owner',
          attributes: ['id', 'email', 'first_name', 'last_name']
        }],
        order: [['created_at', 'DESC']]
      });

      res.json({
        success: true,
        data: ownerships
      });
    } catch (error: any) {
      console.error('Error getting ownerships by unit:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get ownerships',
        details: error.message
      });
    }
  }

  /**
   * Get ownerships by owner
   * GET /api/admin/users/:userId/ownerships
   */
  async getByOwner(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const user = req.user!;
      const isAdmin = user.role_id === 1;

      // Verify owner exists
      const owner = await User.findByPk(userId);
      if (!owner) {
        res.status(404).json({
          success: false,
          error: 'Owner not found'
        });
        return;
      }

      const where: any = { owner_id: userId };

      // Build query with property filter for staff
      const include: any[] = [
        {
          model: TimeshareUnit,
          as: 'Unit',
          include: [{
            model: TimeshareProperty,
            as: 'Property',
            attributes: ['id', 'name', 'city', 'country']
          }]
        }
      ];

      // Staff can only see ownerships from their property
      if (!isAdmin && user.property_id) {
        include[0].where = { property_id: user.property_id };
      }

      const ownerships = await Ownership.findAll({
        where,
        include,
        order: [['created_at', 'DESC']]
      });

      res.json({
        success: true,
        data: ownerships
      });
    } catch (error: any) {
      console.error('Error getting ownerships by owner:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get ownerships',
        details: error.message
      });
    }
  }

  /**
   * Create a new ownership
   * POST /api/admin/ownerships
   */
  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const isAdmin = user.role_id === 1;

      const {
        owner_id,
        unit_id,
        type,
        fixed_week_number,
        annual_points,
        purchase_date,
        contract_reference,
        contract_start_year,
        contract_end_year,
        annual_fee,
        annual_fee_due_date,
        currency,
        status,
        notes
      } = req.body;

      // Validate required fields
      if (!owner_id || !unit_id || !type) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: owner_id, unit_id, type'
        });
        return;
      }

      // Verify unit exists
      const unit = await TimeshareUnit.findByPk(unit_id);
      if (!unit) {
        res.status(404).json({
          success: false,
          error: 'Unit not found'
        });
        return;
      }

      // Staff can only create ownerships for their property
      if (!isAdmin && user.property_id && unit.property_id !== user.property_id) {
        res.status(403).json({
          success: false,
          error: 'You can only create ownerships for your assigned property'
        });
        return;
      }

      // Verify owner exists
      const owner = await User.findByPk(owner_id);
      if (!owner) {
        res.status(404).json({
          success: false,
          error: 'Owner not found'
        });
        return;
      }

      // Validate type-specific fields
      if (type === 'FIXED_WEEK' && !fixed_week_number) {
        res.status(400).json({
          success: false,
          error: 'fixed_week_number is required for FIXED_WEEK ownership'
        });
        return;
      }

      if (type === 'POINTS' && !annual_points) {
        res.status(400).json({
          success: false,
          error: 'annual_points is required for POINTS ownership'
        });
        return;
      }

      // Create ownership
      const ownership = await Ownership.create({
        owner_id,
        unit_id,
        type,
        fixed_week_number,
        annual_points,
        purchase_date,
        contract_reference,
        contract_start_year: contract_start_year || new Date().getFullYear(),
        contract_end_year,
        annual_fee,
        annual_fee_due_date,
        currency: currency || 'EUR',
        status: status || 'ACTIVE',
        notes
      });

      // Load relationships
      await ownership.reload({
        include: [
          {
            model: TimeshareUnit,
            as: 'Unit',
            include: [{
              model: TimeshareProperty,
              as: 'Property'
            }]
          },
          {
            model: User,
            as: 'Owner',
            attributes: ['id', 'email', 'first_name', 'last_name']
          }
        ]
      });

      res.status(201).json({
        success: true,
        data: ownership,
        message: 'Ownership created successfully'
      });
    } catch (error: any) {
      console.error('Error creating ownership:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create ownership',
        details: error.message
      });
    }
  }

  /**
   * Update ownership
   * PUT /api/admin/ownerships/:id
   */
  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const user = req.user!;
      const isAdmin = user.role_id === 1;

      // Find ownership
      const ownership = await Ownership.findOne({
        where: { id },
        include: [{
          model: TimeshareUnit,
          as: 'Unit'
        }]
      });

      if (!ownership) {
        res.status(404).json({
          success: false,
          error: 'Ownership not found'
        });
        return;
      }

      // Staff can only update ownerships from their property
      const unit = ownership.unit as any;
      if (!isAdmin && user.property_id && unit.property_id !== user.property_id) {
        res.status(403).json({
          success: false,
          error: 'Access denied to this ownership'
        });
        return;
      }

      // Update fields
      const {
        type,
        fixed_week_number,
        annual_points,
        purchase_date,
        contract_reference,
        contract_start_year,
        contract_end_year,
        annual_fee,
        annual_fee_due_date,
        last_payment_date,
        currency,
        status,
        suspension_reason,
        notes,
        metadata
      } = req.body;

      if (type !== undefined) ownership.type = type;
      if (fixed_week_number !== undefined) ownership.fixed_week_number = fixed_week_number;
      if (annual_points !== undefined) ownership.annual_points = annual_points;
      if (purchase_date !== undefined) ownership.purchase_date = purchase_date;
      if (contract_reference !== undefined) ownership.contract_reference = contract_reference;
      if (contract_start_year !== undefined) ownership.contract_start_year = contract_start_year;
      if (contract_end_year !== undefined) ownership.contract_end_year = contract_end_year;
      if (annual_fee !== undefined) ownership.annual_fee = annual_fee;
      if (annual_fee_due_date !== undefined) ownership.annual_fee_due_date = annual_fee_due_date;
      if (last_payment_date !== undefined) ownership.last_payment_date = last_payment_date;
      if (currency !== undefined) ownership.currency = currency;
      if (status !== undefined) ownership.status = status;
      if (suspension_reason !== undefined) ownership.suspension_reason = suspension_reason;
      if (notes !== undefined) ownership.notes = notes;
      if (metadata !== undefined) ownership.metadata = metadata;

      await ownership.save();

      // Reload with relationships
      await ownership.reload({
        include: [
          {
            model: TimeshareUnit,
            as: 'Unit',
            include: [{
              model: TimeshareProperty,
              as: 'Property'
            }]
          },
          {
            model: User,
            as: 'Owner',
            attributes: ['id', 'email', 'first_name', 'last_name']
          }
        ]
      });

      res.json({
        success: true,
        data: ownership,
        message: 'Ownership updated successfully'
      });
    } catch (error: any) {
      console.error('Error updating ownership:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update ownership',
        details: error.message
      });
    }
  }

  /**
   * Delete/Terminate ownership
   * DELETE /api/admin/ownerships/:id
   */
  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const user = req.user!;
      const isAdmin = user.role_id === 1;

      // Find ownership
      const ownership = await Ownership.findOne({
        where: { id },
        include: [{
          model: TimeshareUnit,
          as: 'Unit'
        }]
      });

      if (!ownership) {
        res.status(404).json({
          success: false,
          error: 'Ownership not found'
        });
        return;
      }

      // Staff can only delete ownerships from their property
      const unit = ownership.unit as any;
      if (!isAdmin && user.property_id && unit.property_id !== user.property_id) {
        res.status(403).json({
          success: false,
          error: 'Access denied to this ownership'
        });
        return;
      }

      // Terminate ownership (don't physically delete)
      ownership.status = 'TERMINATED';
      await ownership.save();

      res.json({
        success: true,
        message: 'Ownership terminated successfully'
      });
    } catch (error: any) {
      console.error('Error deleting ownership:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete ownership',
        details: error.message
      });
    }
  }

  /**
   * Get ownership statistics
   * GET /api/admin/ownerships/stats
   */
  async getStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const isAdmin = user.role_id === 1;

      // Build property filter for staff
      let propertyFilter: any = {};
      if (!isAdmin && user.property_id) {
        propertyFilter = { property_id: user.property_id };
      }

      const include: any[] = [{
        model: TimeshareUnit,
        as: 'Unit',
        attributes: [],
        where: Object.keys(propertyFilter).length > 0 ? propertyFilter : undefined
      }];

      // Total ownerships
      const total = await Ownership.count({ include });

      // By status
      const byStatus = await Ownership.findAll({
        attributes: [
          'status',
          [require('sequelize').fn('COUNT', require('sequelize').col('Ownership.id')), 'count']
        ],
        include,
        group: ['status'],
        raw: true
      });

      // By type
      const byType = await Ownership.findAll({
        attributes: [
          'type',
          [require('sequelize').fn('COUNT', require('sequelize').col('Ownership.id')), 'count']
        ],
        include,
        group: ['type'],
        raw: true
      });

      res.json({
        success: true,
        data: {
          total,
          byStatus: byStatus.reduce((acc: any, item: any) => {
            acc[item.status] = parseInt(item.count);
            return acc;
          }, {}),
          byType: byType.reduce((acc: any, item: any) => {
            acc[item.type] = parseInt(item.count);
            return acc;
          }, {})
        }
      });
    } catch (error: any) {
      console.error('Error getting ownership stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get ownership statistics',
        details: error.message
      });
    }
  }
}

export default new OwnershipController();
