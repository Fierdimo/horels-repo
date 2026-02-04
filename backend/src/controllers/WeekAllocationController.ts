import { Request, Response } from 'express';
import weekAllocationService, { DistributionMethod } from '../services/WeekAllocationService';

/**
 * Controller for Week Allocation Generation
 * Manages preview and generation of week allocations for properties
 */
export class WeekAllocationController {
  /**
   * Preview week allocations without saving
   * POST /api/admin/allocations/preview
   */
  async preview(req: Request, res: Response): Promise<void> {
    try {
      const { property_id, year, method, seasonal_weights } = req.body;

      // Validation
      if (!property_id || !year || !method) {
        res.status(400).json({
          error: 'Missing required fields',
          required: ['property_id', 'year', 'method']
        });
        return;
      }

      const validMethods: DistributionMethod[] = ['EQUAL', 'SEASONAL', 'RANDOM'];
      if (!validMethods.includes(method as DistributionMethod)) {
        res.status(400).json({
          error: 'Invalid distribution method',
          valid: validMethods
        });
        return;
      }

      const currentYear = new Date().getFullYear();
      if (year < currentYear) {
        res.status(400).json({
          error: `Year must be ${currentYear} or later`
        });
        return;
      }

      // Generate preview
      const preview = await weekAllocationService.previewAllocations({
        propertyId: property_id,
        year,
        method: method as DistributionMethod,
        seasonalWeights: seasonal_weights
      });

      res.json({
        success: true,
        preview
      });

    } catch (error: any) {
      console.error('Preview allocations error:', error);
      res.status(500).json({
        error: error.message || 'Failed to preview allocations'
      });
    }
  }

  /**
   * Generate and save week allocations
   * POST /api/admin/allocations/generate
   */
  async generate(req: Request, res: Response): Promise<void> {
    try {
      const { property_id, year, method, override, seasonal_weights } = req.body;

      // Validation
      if (!property_id || !year || !method) {
        res.status(400).json({
          error: 'Missing required fields',
          required: ['property_id', 'year', 'method']
        });
        return;
      }

      const validMethods: DistributionMethod[] = ['EQUAL', 'SEASONAL', 'RANDOM'];
      if (!validMethods.includes(method as DistributionMethod)) {
        res.status(400).json({
          error: 'Invalid distribution method',
          valid: validMethods
        });
        return;
      }

      const currentYear = new Date().getFullYear();
      if (year < currentYear) {
        res.status(400).json({
          error: `Year must be ${currentYear} or later`
        });
        return;
      }

      // Generate allocations
      const result = await weekAllocationService.generateAllocations({
        propertyId: property_id,
        year,
        method: method as DistributionMethod,
        override: override || false,
        seasonalWeights: seasonal_weights
      });

      if (result.success) {
        res.json({
          success: true,
          message: 'Allocations generated successfully',
          allocationsCreated: result.allocationsCreated,
          allocationsSkipped: result.allocationsSkipped
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Failed to generate some allocations',
          allocationsCreated: result.allocationsCreated,
          allocationsSkipped: result.allocationsSkipped,
          errors: result.errors
        });
      }

    } catch (error: any) {
      console.error('Generate allocations error:', error);
      res.status(500).json({
        error: error.message || 'Failed to generate allocations'
      });
    }
  }

  /**
   * Get week allocations for a property and year
   * GET /api/admin/allocations
   */
  async list(req: Request, res: Response): Promise<void> {
    try {
      const { property_id, year, ownership_id } = req.query;

      if (!property_id && !ownership_id) {
        res.status(400).json({
          error: 'Either property_id or ownership_id is required'
        });
        return;
      }

      const WeekAllocation = require('../models/v2/WeekAllocation').default;
      const Ownership = require('../models/v2/Ownership').default;
      const TimeshareUnit = require('../models/v2/TimeshareUnit').default;
      const TimeshareProperty = require('../models/v2/TimeshareProperty').default;
      const User = require('../models/v2/User').default;

      const where: any = {};
      const ownershipWhere: any = {};

      if (year) {
        where.year = year;
      }

      if (ownership_id) {
        where.ownership_id = ownership_id;
      }

      if (property_id) {
        // Filter by property through ownership → unit relationship
      }

      const allocations = await WeekAllocation.findAll({
        where,
        include: [{
          model: Ownership,
          as: 'ownership',
          where: ownershipWhere,
          include: [{
            model: TimeshareUnit,
            as: 'unit',
            where: property_id ? { property_id } : undefined,
            include: [{
              model: TimeshareProperty,
              as: 'Property'
            }]
          }, {
            model: User,
            as: 'owner',
            attributes: ['id', 'first_name', 'last_name', 'email']
          }]
        }],
        order: [['year', 'DESC'], ['week_number', 'ASC']]
      });

      // Group by ownership
      const grouped = allocations.reduce((acc: any, allocation: any) => {
        const ownershipId = allocation.ownership_id;
        if (!acc[ownershipId]) {
          acc[ownershipId] = {
            ownership_id: ownershipId,
            owner: {
              id: allocation.ownership.owner.id,
              name: `${allocation.ownership.owner.first_name} ${allocation.ownership.owner.last_name}`,
              email: allocation.ownership.owner.email
            },
            unit: {
              id: allocation.ownership.unit.id,
              category: allocation.ownership.unit.category,
              property_name: allocation.ownership.unit.Property.name
            },
            years: {}
          };
        }

        const year = allocation.year;
        if (!acc[ownershipId].years[year]) {
          acc[ownershipId].years[year] = {
            year,
            weeks: [],
            used_count: 0,
            available_count: 0
          };
        }

        acc[ownershipId].years[year].weeks.push({
          week_number: allocation.week_number,
          is_used: allocation.is_used
        });

        if (allocation.is_used) {
          acc[ownershipId].years[year].used_count++;
        } else {
          acc[ownershipId].years[year].available_count++;
        }

        return acc;
      }, {});

      res.json({
        success: true,
        allocations: Object.values(grouped)
      });

    } catch (error: any) {
      console.error('List allocations error:', error);
      res.status(500).json({
        error: error.message || 'Failed to list allocations'
      });
    }
  }

  /**
   * Delete week allocations for a property and year
   * DELETE /api/admin/allocations
   */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { property_id, year } = req.body;

      if (!property_id || !year) {
        res.status(400).json({
          error: 'Missing required fields',
          required: ['property_id', 'year']
        });
        return;
      }

      const WeekAllocation = require('../models/v2/WeekAllocation').default;
      const Ownership = require('../models/v2/Ownership').default;
      const TimeshareUnit = require('../models/v2/TimeshareUnit').default;

      // Get ownership IDs for this property
      const ownerships = await Ownership.findAll({
        include: [{
          model: TimeshareUnit,
          as: 'unit',
          where: { property_id },
          attributes: []
        }],
        attributes: ['id']
      });

      const ownershipIds = ownerships.map((o: any) => o.id);

      // Delete allocations
      const deleted = await WeekAllocation.destroy({
        where: {
          year,
          ownership_id: ownershipIds
        }
      });

      res.json({
        success: true,
        message: `Deleted ${deleted} allocations for property ${property_id}, year ${year}`,
        deletedCount: deleted
      });

    } catch (error: any) {
      console.error('Delete allocations error:', error);
      res.status(500).json({
        error: error.message || 'Failed to delete allocations'
      });
    }
  }
}

export default new WeekAllocationController();
