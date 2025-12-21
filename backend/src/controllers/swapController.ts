import { Request, Response } from 'express';
import SwapService from '../services/swapService';
import { stripeService } from '../services/stripeService';
import { Week, SwapRequest } from '../models';

export class SwapController {
  
  /**
   * GET /owner/swaps/compatible-weeks/:weekId
   * Search for compatible weeks available for swap
   */
  static async searchCompatibleWeeks(req: any, res: Response) {
    try {
      const { weekId } = req.params;
      const { propertyId, limit } = req.query;
      const userId = req.user.id;

      // Validate ownership of the week
      const week = await Week.findByPk(weekId);
      if (!week) {
        return res.status(404).json({ error: 'Week not found' });
      }

      if (week.owner_id !== userId) {
        return res.status(403).json({ error: 'You can only swap your own weeks' });
      }

      const compatibleWeeks = await SwapService.findCompatibleWeeks(
        Number(weekId),
        userId,
        {
          propertyId: propertyId ? Number(propertyId) : undefined,
          limit: limit ? Number(limit) : 50
        }
      );

      res.json({
        success: true,
        data: {
          requesterWeek: week,
          compatibleWeeks,
          total: compatibleWeeks.length
        }
      });

    } catch (error: any) {
      console.error('Error searching compatible weeks:', error);
      res.status(400).json({ error: error.message || 'Failed to search compatible weeks' });
    }
  }

  /**
   * POST /owner/swaps
   * Create a new swap request
   */
  static async createSwapRequest(req: any, res: Response) {
    try {
      const { requester_week_id, desired_start_date, desired_property_id } = req.body;
      const userId = req.user.id;

      if (!requester_week_id) {
        return res.status(400).json({ error: 'requester_week_id is required' });
      }

      const swapRequest = await SwapService.createSwapRequest(
        userId,
        requester_week_id, // Pass as-is (can be number or "booking_X")
        null, // responder_week_id is null at creation
        {
          desired_start_date: desired_start_date ? new Date(desired_start_date) : undefined,
          desired_property_id: desired_property_id ? Number(desired_property_id) : undefined
        }
      );

      res.status(201).json({
        success: true,
        message: 'Swap request created successfully',
        data: swapRequest
      });

    } catch (error: any) {
      console.error('Error creating swap request:', error);
      res.status(400).json({ error: error.message || 'Failed to create swap request' });
    }
  }

  /**
   * GET /owner/swaps
   * Get all swap requests for current owner
   */
  static async getOwnerSwaps(req: any, res: Response) {
    try {
      const userId = req.user.id;
      const { role } = req.query; // 'requester', 'responder', or 'both'

      const swaps = await SwapService.getOwnerSwaps(
        userId,
        role as any || 'both'
      );

      res.json({
        success: true,
        data: swaps,
        total: swaps.length
      });

    } catch (error: any) {
      console.error('Error fetching owner swaps:', error);
      res.status(500).json({ error: 'Failed to fetch swaps' });
    }
  }

  /**
   * GET /owner/swaps/browse/available
   * Get available swaps to browse (pending swaps from other owners)
   */
  static async getAvailableSwaps(req: any, res: Response) {
    try {
      const userId = req.user.id;

      const swaps = await SwapService.getAvailableSwapsForUser(userId);

      res.json({
        success: true,
        data: swaps,
        total: swaps.length
      });

    } catch (error: any) {
      console.error('Error fetching available swaps:', error);
      res.status(500).json({ error: 'Failed to fetch available swaps' });
    }
  }

  /**
   * GET /owner/swaps/:swapId
   * Get swap request details
   */
  static async getSwapDetails(req: any, res: Response) {
    try {
      const { swapId } = req.params;
      const userId = req.user.id;

      const swap = await SwapRequest.findByPk(swapId, {
        include: [
          {
            association: 'RequesterWeek',
            include: [
              { association: 'Owner', attributes: ['id', 'full_name', 'email'] },
              { association: 'Property', attributes: ['id', 'name', 'location'] }
            ]
          },
          {
            association: 'ResponderWeek',
            include: [
              { association: 'Owner', attributes: ['id', 'full_name', 'email'] },
              { association: 'Property', attributes: ['id', 'name', 'location'] }
            ]
          },
          { association: 'Requester', attributes: ['id', 'full_name', 'email'] }
        ]
      });

      if (!swap) {
        return res.status(404).json({ error: 'Swap request not found' });
      }

      // Check if user is involved in this swap
      const requesterWeek = (swap as any).RequesterWeek;
      const responderWeek = (swap as any).ResponderWeek;

      if (
        swap.requester_id !== userId &&
        (!responderWeek || responderWeek.owner_id !== userId)
      ) {
        return res.status(403).json({ error: 'You do not have access to this swap' });
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

  /**
   * POST /owner/swaps/:swapId/accept
   * Accept a swap request (as responder)
   */
  static async acceptSwap(req: any, res: Response) {
    try {
      const { swapId } = req.params;
      const userId = req.user.id;

      const swap = await SwapService.acceptSwap(Number(swapId), userId);

      res.json({
        success: true,
        message: 'Swap accepted. Please proceed to payment.',
        data: swap
      });

    } catch (error: any) {
      console.error('Error accepting swap:', error);
      res.status(400).json({ error: error.message || 'Failed to accept swap' });
    }
  }

  /**
   * POST /owner/swaps/:swapId/reject
   * Reject a swap request (as responder)
   */
  static async rejectSwap(req: any, res: Response) {
    try {
      const { swapId } = req.params;
      const userId = req.user.id;

      const swap = await SwapService.rejectSwapRequest(Number(swapId), userId);

      res.json({
        success: true,
        message: 'Swap rejected',
        data: swap
      });

    } catch (error: any) {
      console.error('Error rejecting swap:', error);
      res.status(400).json({ error: error.message || 'Failed to reject swap' });
    }
  }

  /**
   * POST /owner/swaps/:swapId/payment-intent
   * Create a Stripe payment intent for the swap fee
   */
  static async createPaymentIntent(req: any, res: Response) {
    try {
      const { swapId } = req.params;
      const userId = req.user.id;
      const user = req.user;

      const swap = await SwapRequest.findByPk(swapId, {
        include: [{ association: 'RequesterWeek', include: [{ association: 'Owner' }] }]
      });

      if (!swap) {
        return res.status(404).json({ error: 'Swap request not found' });
      }

      // Verify user is authorized to pay this swap
      const requesterWeek = (swap as any).RequesterWeek;
      if (requesterWeek.owner_id !== userId) {
        return res.status(403).json({ error: 'Only the requester can pay for this swap' });
      }

      if (swap.status !== 'awaiting_payment') {
        return res.status(400).json({ error: 'Swap is not ready for payment' });
      }

      if (swap.payment_intent_id) {
        return res.json({
          success: true,
          message: 'Payment intent already created',
          data: { paymentIntentId: swap.payment_intent_id }
        });
      }

      // Create Stripe payment intent for €10 swap fee
      const paymentResult = await stripeService.createSwapFeePaymentIntent(
        userId,
        Number(swapId),
        swap.requester_week_id,
        swap.swap_fee as any,
        user.email
      );

      // Update swap with payment intent ID
      await swap.update({ payment_intent_id: paymentResult.paymentIntentId });

      res.json({
        success: true,
        message: 'Payment intent created',
        data: {
          swapId,
          amount: paymentResult.amount,
          currency: paymentResult.currency,
          clientSecret: paymentResult.clientSecret,
          paymentIntentId: paymentResult.paymentIntentId,
          description: `Swap fee for week ${swap.requester_week_id}`
        }
      });

    } catch (error: any) {
      console.error('Error creating payment intent:', error);
      res.status(500).json({ error: error.message || 'Failed to create payment intent' });
    }
  }

  /**
   * POST /owner/swaps/:swapId/confirm-payment
   * Confirm payment and complete the swap
   */
  static async confirmPayment(req: any, res: Response) {
    try {
      const { swapId } = req.params;
      const { paymentIntentId } = req.body;
      const userId = req.user.id;

      if (!paymentIntentId) {
        return res.status(400).json({ error: 'paymentIntentId is required' });
      }

      const swap = await SwapRequest.findByPk(swapId, {
        include: [{ association: 'RequesterWeek' }]
      });

      if (!swap) {
        return res.status(404).json({ error: 'Swap request not found' });
      }

      // Verify user is the requester
      const requesterWeek = (swap as any).RequesterWeek;
      if (requesterWeek.owner_id !== userId) {
        return res.status(403).json({ error: 'Only the requester can confirm payment' });
      }

      // Verify payment with Stripe
      const paymentConfirm = await stripeService.confirmSwapFeePayment(paymentIntentId, Number(swapId));

      if (!paymentConfirm.success) {
        return res.status(400).json({ error: 'Payment confirmation failed' });
      }

      // Complete the swap (transfer ownership)
      const completedSwap = await SwapService.completeSwap(Number(swapId), paymentIntentId);

      res.json({
        success: true,
        message: 'Swap completed successfully! Weeks have been exchanged.',
        data: {
          swap: completedSwap,
          payment: paymentConfirm
        }
      });

    } catch (error: any) {
      console.error('Error confirming payment:', error);
      res.status(400).json({ error: error.message || 'Failed to confirm payment' });
    }
  }
}

export default SwapController;
