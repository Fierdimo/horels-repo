import { Router, Response } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import CreditCalculationService from '../services/CreditCalculationService';

interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role_id: number;
    Role?: {
      name: string;
    };
  };
}

const router = Router();

// @route   POST /credits/estimate-deposit
// @desc    Estimate credits for a potential week deposit
// @access  Owner, Staff, Admin
router.post('/estimate-deposit', authenticateToken, async (req: any, res: Response) => {
  try {
    const { property_id, accommodation_type, season_type } = req.body;

    if (!property_id || !accommodation_type || !season_type) {
      return res.status(400).json({
        success: false,
        message: 'property_id, accommodation_type, and season_type are required'
      });
    }

    const estimate = await CreditCalculationService.estimateCreditsForWeek(
      property_id,
      accommodation_type,
      season_type
    );

    res.json({
      success: true,
      data: estimate
    });
  } catch (error: any) {
    console.error('Error estimating deposit credits:', error);
    res.status(500).json({
      success: false,
      message: 'Error estimating credits',
      error: error.message
    });
  }
});

// @route   POST /credits/estimate-booking
// @desc    Estimate credits required for a booking
// @access  Owner, Staff, Admin
router.post('/estimate-booking', authenticateToken, async (req: any, res: Response) => {
  try {
    const { property_id, room_type, season_type, nights } = req.body;

    if (!property_id || !room_type || !season_type || !nights) {
      return res.status(400).json({
        success: false,
        message: 'property_id, room_type, season_type, and nights are required'
      });
    }

    const cost = await CreditCalculationService.calculateBookingCost(
      property_id,
      room_type,
      season_type,
      nights
    );

    res.json({
      success: true,
      data: cost
    });
  } catch (error: any) {
    console.error('Error estimating booking cost:', error);
    res.status(500).json({
      success: false,
      message: 'Error estimating booking cost',
      error: error.message
    });
  }
});

// @route   POST /credits/calculate-swap
// @desc    Calculate credit difference for a potential swap
// @access  Owner
router.post('/calculate-swap', authenticateToken, async (req: any, res: Response) => {
  try {
    const {
      deposited_week_id,
      requested_property_id,
      requested_room_type,
      requested_season_type,
      requested_nights
    } = req.body;

    if (!deposited_week_id || !requested_property_id || !requested_room_type || !requested_season_type || !requested_nights) {
      return res.status(400).json({
        success: false,
        message: 'All swap parameters are required'
      });
    }

    const difference = await CreditCalculationService.calculateSwapDifference(
      deposited_week_id,
      requested_property_id,
      requested_room_type,
      requested_season_type,
      requested_nights
    );

    res.json({
      success: true,
      data: difference
    });
  } catch (error: any) {
    console.error('Error calculating swap difference:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating swap',
      error: error.message
    });
  }
});

// @route   GET /credits/system-constants
// @desc    Get system constants for credit calculations
// @access  Authenticated users
router.get('/system-constants', authenticateToken, async (req: any, res: Response) => {
  try {
    const constants = CreditCalculationService.getSystemConstants();

    res.json({
      success: true,
      data: constants
    });
  } catch (error: any) {
    console.error('Error fetching system constants:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching constants',
      error: error.message
    });
  }
});

export default router;
