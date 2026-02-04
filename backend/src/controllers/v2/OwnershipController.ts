/**
 * Ownership Controller (V2)
 * 
 * Handles ownership management (admin/staff):
 * - Create ownership
 * - Get ownership details
 * - List user ownerships
 * - Transfer ownership
 * - Terminate ownership
 * 
 * See: docs_v2/TIMESHARE_PLATFORM_V2_SPEC.md - API Specification
 */

import { Request, Response } from 'express';
import { OwnershipService } from '../../services/v2/OwnershipService';
import { WeekAllocationService } from '../../services/v2/WeekAllocationService';
import { OwnershipRepository } from '../../repositories/v2/OwnershipRepository';
import { WeekAllocationRepository } from '../../repositories/v2/WeekAllocationRepository';

// Auth middleware adds user to request
type AuthRequest = Request & {
  user?: {
    id: number;
    email: string;
    role?: string;
  };
};

export class OwnershipController {
  /**
   * POST /api/v2/ownerships
   * Create new ownership (admin only)
   */
  static async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Check admin role
      if (req.user?.role !== 'admin') {
        res.status(403).json({ success: false, error: 'Admin access required' });
        return;
      }

      const { ownerId, unitId, type, fixedWeekNumber, annualPoints, annualFee, currency, contractStartYear, contractEndYear } = req.body;

      // Validation
      if (!ownerId || !unitId || !type || !annualFee || !contractStartYear) {
        res.status(400).json({ 
          success: false, 
          error: 'Missing required fields: ownerId, unitId, type, annualFee, contractStartYear' 
        });
        return;
      }

      // Type-specific validation
      if (type === 'FIXED_WEEK' && !fixedWeekNumber) {
        res.status(400).json({ success: false, error: 'fixedWeekNumber required for FIXED_WEEK' });
        return;
      }

      if (type === 'POINTS' && !annualPoints) {
        res.status(400).json({ success: false, error: 'annualPoints required for POINTS' });
        return;
      }

      // Initialize services
      const ownershipRepo = new OwnershipRepository();
      const weekRepo = new WeekAllocationRepository();
      const weekAllocationService = new WeekAllocationService(weekRepo, ownershipRepo);
      const ownershipService = new OwnershipService(ownershipRepo, weekAllocationService);

      // Create ownership
      const ownership = await ownershipService.createOwnership({
        user_id: ownerId, // Service expects user_id
        unit_id: unitId,
        type: type as 'FIXED_WEEK' | 'FLOATING' | 'POINTS',
        fixed_week_number: fixedWeekNumber,
        annual_points: annualPoints,
        annual_fee: annualFee,
        currency: currency || 'EUR',
        contract_start_year: contractStartYear,
        contract_end_year: contractEndYear,
      });

      // Generate allocations for current year
      if (type === 'FIXED_WEEK') {
        const currentYear = new Date().getFullYear();
        await weekAllocationService.generateAnnualAllocations(
          ownership.id,
          currentYear,
          type
        );
      }

      res.status(201).json({
        success: true,
        data: {
          id: ownership.id,
          ownerId: ownership.owner_id,
          unitId: ownership.unit_id,
          type: ownership.type,
          fixedWeekNumber: ownership.fixed_week_number,
          annualPoints: ownership.annual_points,
          status: ownership.status,
          contractStartYear: ownership.contract_start_year,
          contractEndYear: ownership.contract_end_year,
        },
      });
    } catch (error: any) {
      console.error('Error creating ownership:', error);
      
      if (error.message.includes('already exists')) {
        res.status(409).json({ success: false, error: error.message });
        return;
      }

      res.status(500).json({ 
        success: false, 
        error: 'Failed to create ownership',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * GET /api/v2/ownerships/:id
   * Get ownership details
   */
  static async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const ownershipId = parseInt(req.params.id);
      const year = parseInt(req.query.year as string) || new Date().getFullYear();

      // Initialize services
      const ownershipRepo = new OwnershipRepository();
      const weekRepo = new WeekAllocationRepository();
      const weekAllocationService = new WeekAllocationService(weekRepo, ownershipRepo);
      const ownershipService = new OwnershipService(ownershipRepo, weekAllocationService);

      // Get ownership details
      const ownership = await ownershipService.getOwnershipDetails(ownershipId, year);

      if (!ownership) {
        res.status(404).json({ success: false, error: 'Ownership not found' });
        return;
      }

      // Check access (owner or admin)
      const userId = req.user?.id;
      const isOwner = (ownership as any).owner_id === userId;
      const isAdmin = req.user?.role === 'admin';

      if (!isOwner && !isAdmin) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      res.status(200).json({
        success: true,
        data: ownership,
      });
    } catch (error: any) {
      console.error('Error fetching ownership:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch ownership',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * GET /api/v2/ownerships/my-ownerships
   * Get all ownerships for authenticated user
   */
  static async getMyOwnerships(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const activeOnly = req.query.activeOnly === 'true';

      // Initialize services
      const ownershipRepo = new OwnershipRepository();
      const weekRepo = new WeekAllocationRepository();
      const weekAllocationService = new WeekAllocationService(weekRepo, ownershipRepo);
      const ownershipService = new OwnershipService(ownershipRepo, weekAllocationService);

      // Get user ownerships
      const ownerships = await ownershipService.getUserOwnerships(userId, activeOnly);

      res.status(200).json({
        success: true,
        data: ownerships,
        meta: {
          count: ownerships.length,
          activeOnly,
        },
      });
    } catch (error: any) {
      console.error('Error fetching my ownerships:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch ownerships',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * POST /api/v2/ownerships/:id/transfer
   * Transfer ownership to another user (admin only)
   */
  static async transfer(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Check admin role
      if (req.user?.role !== 'admin') {
        res.status(403).json({ success: false, error: 'Admin access required' });
        return;
      }

      const ownershipId = parseInt(req.params.id);
      const { newOwnerId } = req.body;

      if (!newOwnerId) {
        res.status(400).json({ success: false, error: 'newOwnerId is required' });
        return;
      }

      // Initialize services
      const ownershipRepo = new OwnershipRepository();
      const weekRepo = new WeekAllocationRepository();
      const weekAllocationService = new WeekAllocationService(weekRepo, ownershipRepo);
      const ownershipService = new OwnershipService(ownershipRepo, weekAllocationService);

      // Transfer ownership
      const ownership = await ownershipService.transferOwnership(ownershipId, {
        new_owner_id: newOwnerId,
        transfer_date: new Date(),
      });

      res.status(200).json({
        success: true,
        data: {
          id: ownership.id,
          previousOwnerId: req.body.previousOwnerId, // Should be tracked in metadata
          newOwnerId: ownership.owner_id,
          status: ownership.status,
          transferredAt: new Date(),
        },
      });
    } catch (error: any) {
      console.error('Error transferring ownership:', error);
      
      if (error.message.includes('not found')) {
        res.status(404).json({ success: false, error: error.message });
        return;
      }

      res.status(500).json({ 
        success: false, 
        error: 'Failed to transfer ownership',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * POST /api/v2/ownerships/:id/terminate
   * Terminate ownership (admin only)
   */
  static async terminate(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Check admin role
      if (req.user?.role !== 'admin') {
        res.status(403).json({ success: false, error: 'Admin access required' });
        return;
      }

      const ownershipId = parseInt(req.params.id);
      const { reason } = req.body;
      const adminId = req.user!.id;

      // Initialize services
      const ownershipRepo = new OwnershipRepository();
      const weekRepo = new WeekAllocationRepository();
      const weekAllocationService = new WeekAllocationService(weekRepo, ownershipRepo);
      const ownershipService = new OwnershipService(ownershipRepo, weekAllocationService);

      // Terminate ownership
      await ownershipService.terminateOwnership(ownershipId, reason || 'Administrative termination', adminId);

      res.status(200).json({
        success: true,
        data: {
          id: ownershipId,
          status: 'TERMINATED',
          terminatedAt: new Date(),
          reason,
        },
      });
    } catch (error: any) {
      console.error('Error terminating ownership:', error);
      
      if (error.message.includes('not found')) {
        res.status(404).json({ success: false, error: error.message });
        return;
      }

      res.status(500).json({ 
        success: false, 
        error: 'Failed to terminate ownership',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}
