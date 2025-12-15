import { Router, Response } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { authorize } from '../middleware/authorizationMiddleware';
import { logAction } from '../middleware/loggingMiddleware';
import { nightCreditService } from '../services/nightCreditService';
import { NightCreditRequest, Property } from '../models';

const router = Router();

/**
 * @route GET /hotels/staff/night-credits/requests
 * @desc Get pending night credit requests for staff's property
 * @access Staff only
 */
router.get(
  '/night-credits/requests',
  authenticateToken,
  authorize(['view_bookings']),
  logAction('view_night_credit_requests_staff'),
  async (req: any, res: Response) => {
    try {
      const propertyId = req.user.property_id;

      if (!propertyId) {
        return res.status(400).json({
          error: 'Staff must be assigned to a property'
        });
      }

      const requests = await nightCreditService.getStaffRequests(propertyId);

      res.json({
        success: true,
        data: requests
      });
    } catch (error: any) {
      console.error('Error fetching night credit requests:', error);
      res.status(500).json({
        error: 'Failed to fetch requests'
      });
    }
  }
);

/**
 * @route GET /hotels/staff/night-credits/requests/:id
 * @desc Get night credit request detail with availability check
 * @access Staff only
 */
router.get(
  '/night-credits/requests/:id',
  authenticateToken,
  authorize(['view_bookings']),
  logAction('view_night_credit_request_detail_staff'),
  async (req: any, res: Response) => {
    try {
      const propertyId = req.user.property_id;
      const { id } = req.params;

      const request = await NightCreditRequest.findOne({
        where: {
          id,
          property_id: propertyId
        }
      });

      if (!request) {
        return res.status(404).json({
          error: 'Request not found'
        });
      }

      // Check availability
      const availability = await nightCreditService.checkAvailability(Number(id));

      res.json({
        success: true,
        data: {
          request,
          availability
        }
      });
    } catch (error: any) {
      console.error('Error fetching request detail:', error);
      res.status(500).json({
        error: 'Failed to fetch request detail'
      });
    }
  }
);

/**
 * @route PATCH /hotels/staff/night-credits/requests/:id/approve
 * @desc Approve a night credit request
 * @access Staff only
 */
router.patch(
  '/night-credits/requests/:id/approve',
  authenticateToken,
  authorize(['manage_bookings']),
  logAction('approve_night_credit_request'),
  async (req: any, res: Response) => {
    try {
      const staffId = req.user.id;
      const propertyId = req.user.property_id;
      const { id } = req.params;
      const { notes } = req.body;

      // Verify request belongs to staff's property
      const request = await NightCreditRequest.findOne({
        where: {
          id,
          property_id: propertyId
        }
      });

      if (!request) {
        return res.status(404).json({
          error: 'Request not found'
        });
      }

      const approvedRequest = await nightCreditService.approveRequest(
        Number(id),
        staffId,
        notes
      );

      res.json({
        success: true,
        message: 'Request approved successfully',
        data: approvedRequest
      });
    } catch (error: any) {
      console.error('Error approving request:', error);
      res.status(400).json({
        error: error.message || 'Failed to approve request'
      });
    }
  }
);

/**
 * @route PATCH /hotels/staff/night-credits/requests/:id/reject
 * @desc Reject a night credit request
 * @access Staff only
 */
router.patch(
  '/night-credits/requests/:id/reject',
  authenticateToken,
  authorize(['manage_bookings']),
  logAction('reject_night_credit_request'),
  async (req: any, res: Response) => {
    try {
      const staffId = req.user.id;
      const propertyId = req.user.property_id;
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          error: 'Reason for rejection is required'
        });
      }

      // Verify request belongs to staff's property
      const request = await NightCreditRequest.findOne({
        where: {
          id,
          property_id: propertyId
        }
      });

      if (!request) {
        return res.status(404).json({
          error: 'Request not found'
        });
      }

      const rejectedRequest = await nightCreditService.rejectRequest(
        Number(id),
        staffId,
        reason
      );

      res.json({
        success: true,
        message: 'Request rejected',
        data: rejectedRequest
      });
    } catch (error: any) {
      console.error('Error rejecting request:', error);
      res.status(400).json({
        error: error.message || 'Failed to reject request'
      });
    }
  }
);

/**
 * @route GET /hotels/staff/availability
 * @desc Get unified availability view (weeks, bookings, locks)
 * @access Staff only
 */
router.get(
  '/availability',
  authenticateToken,
  authorize(['view_bookings']),
  logAction('view_staff_availability'),
  async (req: any, res: Response) => {
    try {
      const propertyId = req.user.property_id;

      if (!propertyId) {
        return res.status(400).json({
          error: 'Staff must be assigned to a property'
        });
      }

      // Get property details
      const property = await Property.findByPk(propertyId);

      // TODO: Implement comprehensive availability logic
      // This would include:
      // - Total rooms
      // - Rooms blocked by weeks
      // - Rooms with active bookings
      // - Pending night credit requests (soft locks)

      res.json({
        success: true,
        message: 'Availability endpoint - coming soon',
        data: {
          property: property?.name,
          // availability: {...}
        }
      });
    } catch (error: any) {
      console.error('Error fetching availability:', error);
      res.status(500).json({
        error: 'Failed to fetch availability'
      });
    }
  }
);

export default router;
