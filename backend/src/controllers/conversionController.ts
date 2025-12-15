import { Request, Response } from 'express';
import ConversionService from '../services/conversionService';
import LoggingService from '../services/loggingService';
import { User } from '../models';
import PlatformSetting from '../models/PlatformSetting';

interface AuthRequest extends Request {
  user?: any;
}

export class ConversionController {
  private conversionService: ConversionService;
  private loggingService: LoggingService;

  constructor() {
    this.conversionService = new ConversionService();
    this.loggingService = new LoggingService();
  }

  /**
   * Convert a guest user to owner with payment
   */
  convertGuestToOwner = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { userId } = req.body;
      const requestingUser = req.user;

      // Validate input
      if (!userId) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }

      // Check permissions - only admin or the user themselves can convert
      if (requestingUser.Role?.name !== 'admin' && requestingUser.id !== userId) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      const result = await this.conversionService.convertGuestToOwner(userId);

      // Log the conversion
      await LoggingService.logAction({
        user_id: requestingUser.id,
        action: 'convert_guest_to_owner',
        details: `Converted guest ${userId} to owner`,
        req,
      });

      res.status(200).json({
        message: 'Guest successfully converted to owner',
        data: result
      });
    } catch (error) {
      console.error('Conversion error:', error);
      res.status(500).json({ error: 'Failed to convert guest to owner' });
    }
  };

  /**
   * Create a swap request for a guest
   */
  createSwapRequest = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { guestId, propertyId, checkIn, checkOut } = req.body;
      const requestingUser = req.user;

      // Validate input
      if (!guestId || !propertyId || !checkIn || !checkOut) {
        res.status(400).json({ error: 'Guest ID, property ID, check-in and check-out dates are required' });
        return;
      }

      // Check permissions - only admin or the guest themselves can create swap requests
      if (requestingUser.Role?.name !== 'admin' && requestingUser.id !== guestId) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      const result = await this.conversionService.createSwapRequest(guestId, propertyId, checkIn, checkOut);

      // Log the swap request
      await LoggingService.logAction({
        user_id: requestingUser.id,
        action: 'create_swap_request',
        details: `Created swap request for guest ${guestId}`,
        req,
      });

      res.status(201).json({
        message: 'Swap request created successfully',
        data: result
      });
    } catch (error) {
      console.error('Swap request creation error:', error);
      res.status(500).json({ error: 'Failed to create swap request' });
    }
  };

  /**
   * Find matching swaps for a property
   */
  findMatchingSwaps = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { propertyId } = req.params;
      const { checkIn, checkOut } = req.query;
      const requestingUser = req.user;

      if (!propertyId || !checkIn || !checkOut) {
        res.status(400).json({ error: 'Property ID, check-in and check-out dates are required' });
        return;
      }

      // Check permissions - only admin or staff can search for matches
      if (!['admin', 'staff'].includes(requestingUser.Role?.name)) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      const matches = await this.conversionService.findMatchingSwaps(propertyId as string, checkIn as string, checkOut as string);

      // Log the search
      await LoggingService.logAction({
        user_id: requestingUser.id,
        action: 'find_matching_swaps',
        details: `Found ${matches.length} matching swaps for property ${propertyId}`,
        req,
      });

      res.status(200).json({
        message: 'Matching swaps found',
        data: matches
      });
    } catch (error) {
      console.error('Find matching swaps error:', error);
      res.status(500).json({ error: 'Failed to find matching swaps' });
    }
  };

  /**
   * Complete a swap with payment
   */
  completeSwap = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { swapId, paymentIntentId, bookingId } = req.body;
      const requestingUser = req.user;

      if (!swapId) {
        res.status(400).json({ error: 'Swap ID is required' });
        return;
      }

      // Check permissions - only admin or staff can complete swaps
      if (!['admin', 'staff'].includes(requestingUser.Role?.name)) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      const result = await this.conversionService.completeSwap(swapId, paymentIntentId, bookingId);

      // Log the swap completion
      await LoggingService.logAction({
        user_id: requestingUser.id,
        action: 'complete_swap',
        details: `Completed swap ${swapId}`,
        req,
      });

      res.status(200).json({
        message: 'Swap completed successfully',
        data: result
      });
    } catch (error) {
      console.error('Complete swap error:', error);
      res.status(500).json({ error: 'Failed to complete swap' });
    }
  };

  /**
   * Calculate swap fee for a property
   */
  calculateSwapFee = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const requestingUser = req.user;

      // Read persisted platform setting directly to ensure immediate visibility
      // of admin updates performed in the same process (tests/import ordering
      // can cause service-level model references to be stale). Fall back to
      // the service if the DB setting is not present.
      let fee: number | null = null;
      try {
        const row = await PlatformSetting.findOne({ where: { key: 'swap_fee' } });
        if (row) {
          const value = row.get('value') as string;
          if (value) {
            const parsed = Number(value);
            if (!Number.isNaN(parsed)) fee = parsed;
          }
        }
      } catch (err) {
        // ignore and fallback to service
        fee = null;
      }

      if (fee === null) {
        fee = await this.conversionService.calculateSwapFee();
      }

      // Log the fee calculation
      await LoggingService.logAction({
        user_id: requestingUser.id,
        action: 'calculate_swap_fee',
        details: `Calculated swap fee: €${fee}`,
        req,
      });

      res.status(200).json({
        message: 'Swap fee calculated',
        data: { fee }
      });
    } catch (error) {
      console.error('Calculate swap fee error:', error);
      res.status(500).json({ error: 'Failed to calculate swap fee' });
    }
  };

  /**
   * Admin-only: Update swap fee runtime setting
   */
  setSwapFee = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const requestingUser = req.user;
      const { fee } = req.body;

      if (!['admin'].includes(requestingUser.Role?.name)) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      if (fee === undefined || fee === null) {
        res.status(400).json({ error: 'Fee value is required' });
        return;
      }

      const numeric = Number(fee);
      if (Number.isNaN(numeric) || numeric < 0) {
        res.status(400).json({ error: 'Invalid fee value' });
        return;
      }

      // Upsert into platform_settings
      try {
        const existing = await PlatformSetting.findOne({ where: { key: 'swap_fee' } });
        let savedVal = numeric;
        if (existing) {
          await existing.update({ value: String(numeric) });
          const updated = await PlatformSetting.findOne({ where: { key: 'swap_fee' } });
          savedVal = Number(updated?.get('value') || numeric);
        } else {
          await PlatformSetting.create({ key: 'swap_fee', value: String(numeric) });
          const created = await PlatformSetting.findOne({ where: { key: 'swap_fee' } });
          savedVal = Number(created?.get('value') || numeric);
        }

        await LoggingService.logAction({
          user_id: requestingUser.id,
          action: 'update_swap_fee',
          details: { fee: savedVal },
          req,
        });

        res.status(200).json({ message: 'Swap fee updated', data: { fee: savedVal } });
        return;
      } catch (err) {
        console.error('Failed to persist swap_fee setting:', err);
        res.status(500).json({ error: 'Failed to persist setting' });
        return;
      }
    } catch (error) {
      console.error('Set swap fee error:', error);
      res.status(500).json({ error: 'Failed to set swap fee' });
    }
  };
}