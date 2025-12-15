import { Router, Response } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { requireOwnerRole } from '../middleware/ownerOnly';
import { authorize } from '../middleware/authorizationMiddleware';
import { logAction } from '../middleware/loggingMiddleware';
import { nightCreditService } from '../services/nightCreditService';
import { NightCreditRequest } from '../models';

const router = Router();

/**
 * @route POST /hotels/owner/night-credits/requests
 * @desc Create a night credit request
 * @access Owner only
 */
router.post(
  '/night-credits/requests',
  authenticateToken,
  requireOwnerRole,
  authorize(['view_own_weeks']),
  logAction('create_night_credit_request'),
  async (req: any, res: Response) => {
    try {
      const ownerId = req.user.id;
      const {
        creditId,
        propertyId,
        checkIn,
        checkOut,
        nightsRequested,
        additionalNights = 0,
        roomType
      } = req.body;

      // Validation
      if (!creditId || !propertyId || !checkIn || !checkOut || !nightsRequested) {
        return res.status(400).json({
          error: 'Missing required fields: creditId, propertyId, checkIn, checkOut, nightsRequested'
        });
      }

      const request = await nightCreditService.createRequest({
        ownerId,
        creditId: Number(creditId),
        propertyId: Number(propertyId),
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut),
        nightsRequested: Number(nightsRequested),
        additionalNights: Number(additionalNights),
        roomType
      });

      res.status(201).json({
        success: true,
        message: 'Night credit request created successfully',
        data: {
          requestId: request.id,
          usingCredits: request.nights_requested,
          buyingNights: request.additional_nights,
          estimatedCost: request.additional_price,
          status: request.status
        }
      });
    } catch (error: any) {
      console.error('Error creating night credit request:', error);
      res.status(400).json({
        error: error.message || 'Failed to create night credit request'
      });
    }
  }
);

/**
 * @route GET /hotels/owner/night-credits/requests
 * @desc Get owner's night credit requests
 * @access Owner only
 */
router.get(
  '/night-credits/requests',
  authenticateToken,
  requireOwnerRole,
  authorize(['view_own_weeks']),
  logAction('view_night_credit_requests'),
  async (req: any, res: Response) => {
    try {
      const ownerId = req.user.id;
      const requests = await nightCreditService.getOwnerRequests(ownerId);

      res.json({
        success: true,
        data: requests
      });
    } catch (error: any) {
      console.error('Error fetching night credit requests:', error);
      res.status(500).json({
        error: 'Failed to fetch night credit requests'
      });
    }
  }
);

/**
 * @route GET /hotels/owner/night-credits/requests/:id
 * @desc Get single night credit request details
 * @access Owner only
 */
router.get(
  '/night-credits/requests/:id',
  authenticateToken,
  requireOwnerRole,
  authorize(['view_own_weeks']),
  logAction('view_night_credit_request_detail'),
  async (req: any, res: Response) => {
    try {
      const ownerId = req.user.id;
      const { id } = req.params;

      const request = await NightCreditRequest.findOne({
        where: {
          id,
          owner_id: ownerId
        }
      });

      if (!request) {
        return res.status(404).json({
          error: 'Request not found'
        });
      }

      res.json({
        success: true,
        data: request
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
 * @route POST /hotels/owner/night-credits/requests/:id/pay
 * @desc Create payment intent for additional nights
 * @access Owner only
 */
router.post(
  '/night-credits/requests/:id/pay',
  authenticateToken,
  requireOwnerRole,
  authorize(['view_own_weeks']),
  logAction('pay_night_credit_additional'),
  async (req: any, res: Response) => {
    try {
      const ownerId = req.user.id;
      const { id } = req.params;

      // Verify ownership
      const request = await NightCreditRequest.findOne({
        where: {
          id,
          owner_id: ownerId
        }
      });

      if (!request) {
        return res.status(404).json({
          error: 'Request not found'
        });
      }

      if (request.status !== 'approved') {
        return res.status(400).json({
          error: 'Request must be approved before payment'
        });
      }

      const paymentData = await nightCreditService.createPaymentIntent(Number(id));

      res.json({
        success: true,
        message: 'Payment intent created',
        data: paymentData
      });
    } catch (error: any) {
      console.error('Error creating payment intent:', error);
      res.status(400).json({
        error: error.message || 'Failed to create payment intent'
      });
    }
  }
);

/**
 * @route DELETE /hotels/owner/night-credits/requests/:id
 * @desc Cancel a pending night credit request
 * @access Owner only
 */
router.delete(
  '/night-credits/requests/:id',
  authenticateToken,
  requireOwnerRole,
  authorize(['view_own_weeks']),
  logAction('cancel_night_credit_request'),
  async (req: any, res: Response) => {
    try {
      const ownerId = req.user.id;
      const { id } = req.params;

      const request = await NightCreditRequest.findOne({
        where: {
          id,
          owner_id: ownerId,
          status: 'pending'
        }
      });

      if (!request) {
        return res.status(404).json({
          error: 'Request not found or cannot be cancelled'
        });
      }

      await request.update({ status: 'expired' });

      res.json({
        success: true,
        message: 'Request cancelled successfully'
      });
    } catch (error: any) {
      console.error('Error cancelling request:', error);
      res.status(500).json({
        error: 'Failed to cancel request'
      });
    }
  }
);

export default router;
