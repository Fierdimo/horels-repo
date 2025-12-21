import { Router, Request, Response } from 'express';
import { Op } from 'sequelize';
import { authenticateToken } from '../middleware/authMiddleware';
import { requireStaffRole } from '../middleware/staffOnly';
import { logAction } from '../middleware/loggingMiddleware';
import SwapService from '../services/swapService';
import { SwapRequest } from '../models';

const router = Router();

/**
 * STAFF ROUTES - Swap request approval workflow
 */

/**
 * Get pending swap requests for staff's property
 * GET /staff/swaps/pending
 */
router.get(
  '/pending',
  authenticateToken,
  requireStaffRole,
  logAction('view_pending_swaps'),
  async (req: any, res: Response) => {
    try {
      const propertyId = req.user.property_id;

      // Staff must have a property assigned
      if (!propertyId) {
        return res.status(403).json({ 
          error: 'Staff must have a property assigned to view swaps' 
        });
      }

      // Build where clause
      const whereClause: any = {
        status: { [Op.in]: ['pending', 'matched'] },
        property_id: propertyId
      };

      const pendingSwaps = await SwapRequest.findAll({
        where: whereClause,
        include: [
          {
            association: 'RequesterWeek',
            include: [
              { association: 'Owner', attributes: ['id', 'firstName', 'lastName', 'email'] },
              { association: 'Property', attributes: ['id', 'name', 'location', 'city', 'country'] }
            ]
          },
          {
            association: 'ResponderWeek',
            include: [
              { association: 'Owner', attributes: ['id', 'firstName', 'lastName', 'email'] },
              { association: 'Property', attributes: ['id', 'name', 'location', 'city', 'country'] }
            ]
          },
          { association: 'Requester', attributes: ['id', 'firstName', 'lastName', 'email'] }
        ],
        order: [['created_at', 'DESC']]
      });

      res.json({
        success: true,
        data: pendingSwaps,
        total: pendingSwaps.length
      });

    } catch (error: any) {
      console.error('Error fetching pending swaps:', error);
      res.status(500).json({ error: 'Failed to fetch pending swaps' });
    }
  }
);

/**
 * Get all swap requests for staff's property
 * GET /staff/swaps
 * Query: status? = 'pending' | 'matched' | 'awaiting_payment' | 'completed' | 'cancelled'
 */
router.get(
  '/',
  authenticateToken,
  requireStaffRole,
  logAction('view_swaps'),
  async (req: any, res: Response) => {
    try {
      const propertyId = req.user.property_id;
      const { status } = req.query;

      // Staff must have a property assigned
      if (!propertyId) {
        return res.status(403).json({ 
          error: 'Staff must have a property assigned to view swaps' 
        });
      }

      // Build where clause
      const whereClause: any = {
        property_id: propertyId
      };

      if (status) {
        whereClause.status = status;
      }

      const swaps = await SwapRequest.findAll({
        where: whereClause,
        include: [
          {
            association: 'RequesterWeek',
            include: [
              { association: 'Owner', attributes: ['id', 'firstName', 'lastName', 'email'] },
              { association: 'Property', attributes: ['id', 'name', 'location', 'city', 'country'] }
            ]
          },
          {
            association: 'ResponderWeek',
            include: [
              { association: 'Owner', attributes: ['id', 'firstName', 'lastName', 'email'] },
              { association: 'Property', attributes: ['id', 'name', 'location', 'city', 'country'] }
            ]
          },
          { association: 'Requester', attributes: ['id', 'firstName', 'lastName', 'email'] }
        ],
        order: [['created_at', 'DESC']]
      });

      res.json({
        success: true,
        data: swaps,
        total: swaps.length
      });

    } catch (error: any) {
      console.error('Error fetching swaps:', error);
      res.status(500).json({ error: 'Failed to fetch swaps' });
    }
  }
);

/**
 * Get swap request details (staff view)
 * GET /staff/swaps/:swapId
 */
router.get(
  '/:swapId',
  authenticateToken,
  requireStaffRole,
  logAction('view_swap_details'),
  async (req: any, res: Response) => {
    try {
      const { swapId } = req.params;
      const propertyId = req.user.property_id;

      const swap = await SwapRequest.findOne({
        where: {
          id: swapId,
          property_id: propertyId
        },
        include: [
          {
            association: 'RequesterWeek',
            include: [
              { association: 'Owner', attributes: ['id', 'full_name', 'email'] },
              { association: 'Property', attributes: ['id', 'name', 'location', 'city', 'country'] }
            ]
          },
          {
            association: 'ResponderWeek',
            include: [
              { association: 'Owner', attributes: ['id', 'full_name', 'email'] },
              { association: 'Property', attributes: ['id', 'name', 'location', 'city', 'country'] }
            ]
          },
          { association: 'Requester', attributes: ['id', 'full_name', 'email'] }
        ]
      });

      if (!swap) {
        return res.status(404).json({ error: 'Swap request not found' });
      }

      res.json({
        success: true,
        data: swap
      });

    } catch (error: any) {
      console.error('Error fetching swap details:', error);
      res.status(500).json({ error: 'Failed to fetch swap details' });
    }
  }
);

/**
 * Approve a swap request (staff action)
 * POST /staff/swaps/:swapId/approve
 * Body: { notes? }
 */
router.post(
  '/:swapId/approve',
  authenticateToken,
  requireStaffRole,
  logAction('approve_swap'),
  async (req: any, res: Response) => {
    try {
      const { swapId } = req.params;
      const { notes } = req.body;
      const staffId = req.user.id;
      const propertyId = req.user.property_id;

      // Verify swap belongs to this staff's property
      const swap = await SwapRequest.findOne({
        where: {
          id: swapId,
          property_id: propertyId
        }
      });

      if (!swap) {
        return res.status(404).json({ error: 'Swap request not found' });
      }

      const updated = await SwapService.approveSwap(Number(swapId), staffId, notes);

      res.json({
        success: true,
        message: 'Swap approved. Waiting for responder confirmation.',
        data: updated
      });

    } catch (error: any) {
      console.error('Error approving swap:', error);
      res.status(400).json({ error: error.message || 'Failed to approve swap' });
    }
  }
);

/**
 * Reject a swap request (staff action)
 * POST /staff/swaps/:swapId/reject
 * Body: { reason }
 */
router.post(
  '/:swapId/reject',
  authenticateToken,
  requireStaffRole,
  logAction('reject_swap'),
  async (req: any, res: Response) => {
    try {
      const { swapId } = req.params;
      const { reason } = req.body;
      const staffId = req.user.id;
      const propertyId = req.user.property_id;

      if (!reason) {
        return res.status(400).json({ error: 'Reason is required' });
      }

      // Verify swap belongs to this staff's property
      const swap = await SwapRequest.findOne({
        where: {
          id: swapId,
          property_id: propertyId
        }
      });

      if (!swap) {
        return res.status(404).json({ error: 'Swap request not found' });
      }

      const updated = await SwapService.rejectSwap(Number(swapId), staffId, reason);

      res.json({
        success: true,
        message: 'Swap rejected',
        data: updated
      });

    } catch (error: any) {
      console.error('Error rejecting swap:', error);
      res.status(400).json({ error: error.message || 'Failed to reject swap' });
    }
  }
);

export default router;
