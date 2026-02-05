import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { Ownership, WeekAllocation, TimeshareUnit, TimeshareProperty } from '../models/v2';

interface AuthRequest extends Request {
  user?: any;
}

const router = Router();

/**
 * GET /owner/weeks
 * Get all week allocations for the authenticated owner
 */
router.get('/weeks', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    console.log(`[OWNER/WEEKS] Request from user ${userId} for year ${year}`);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    // Get all ownerships for this owner
    const ownerships = await Ownership.findAll({
      where: {
        owner_id: userId,
        status: 'ACTIVE'
      },
      include: [
        {
          model: TimeshareUnit,
          as: 'unit',
          include: [
            {
              model: TimeshareProperty,
              as: 'property'
            }
          ]
        }
      ]
    });

    console.log(`[OWNER/WEEKS] Found ${ownerships.length} ownerships for user ${userId}`);

    if (!ownerships || ownerships.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: 'No ownerships found'
      });
    }

    // Get week allocations for these ownerships
    const ownershipIds = ownerships.map((o: any) => o.id);
    
    console.log(`[OWNER/WEEKS] Looking for allocations in ownership IDs: ${ownershipIds.join(', ')}`);
    
    const weekAllocations = await WeekAllocation.findAll({
      where: {
        ownership_id: ownershipIds,
        year: year
      },
      include: [
        {
          model: Ownership,
          as: 'ownership',
          include: [
            {
              model: TimeshareUnit,
              as: 'unit',
              include: [
                {
                  model: TimeshareProperty,
                  as: 'property'
                }
              ]
            }
          ]
        }
      ],
      order: [['id', 'DESC']]
    });

    console.log(`[OWNER/WEEKS] Found ${weekAllocations.length} week allocations`);

    // Format response - mantener estructura de asociaciones
    const formattedWeeks = weekAllocations.map((allocation: any) => ({
      id: allocation.id,
      year: allocation.year,
      week_number: allocation.week_number,
      start_date: allocation.start_date,
      end_date: allocation.end_date,
      status: allocation.status,
      released_at: allocation.released_at,
      converted_to_credits: !!allocation.credits_issued,
      credits_amount: allocation.credits_issued,
      Ownership: {
        id: allocation.ownership.id,
        type: allocation.ownership.type,
        fixed_week_number: allocation.ownership.fixed_week_number,
        contract_reference: allocation.ownership.contract_reference,
        Unit: {
          id: allocation.ownership.unit.id,
          name: allocation.ownership.unit.name,
          category: allocation.ownership.unit.category,
          description: allocation.ownership.unit.description,
          bedrooms: allocation.ownership.unit.bedrooms,
          bathrooms: allocation.ownership.unit.bathrooms,
          capacity_min: allocation.ownership.unit.capacity_min,
          max_occupancy: allocation.ownership.unit.capacity_max,
          size_sqm: allocation.ownership.unit.size_sqm,
          view_type: allocation.ownership.unit.view_type,
          Property: {
            id: allocation.ownership.unit.property.id,
            name: allocation.ownership.unit.property.name,
            city: allocation.ownership.unit.property.city,
            state: allocation.ownership.unit.property.state,
            country: allocation.ownership.unit.property.country,
            stars: allocation.ownership.unit.property.stars
          }
        }
      }
    }));

    res.json({
      success: true,
      data: formattedWeeks,
      year: year
    });
  } catch (error: any) {
    console.error('[OWNER/WEEKS] Error fetching owner weeks:', error);
    console.error('[OWNER/WEEKS] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch weeks',
      message: error.message
    });
  }
});

/**
 * GET /owner/ownerships
 * Get all ownerships for the authenticated owner
 */
router.get('/ownerships', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const ownerships = await Ownership.findAll({
      where: {
        owner_id: userId
      },
      include: [
        {
          model: TimeshareUnit,
          as: 'unit',
          include: [
            {
              model: TimeshareProperty,
              as: 'property'
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    const formattedOwnerships = ownerships.map((ownership: any) => ({
      id: ownership.id,
      contract_reference: ownership.contract_reference,
      type: ownership.type,
      fixed_week_number: ownership.fixed_week_number,
      annual_points: ownership.annual_points,
      annual_fee: ownership.annual_fee,
      currency: ownership.currency,
      status: ownership.status,
      contract_start_year: ownership.contract_start_year,
      contract_end_year: ownership.contract_end_year,
      purchase_date: ownership.purchase_date,
      unit: {
        id: ownership.unit.id,
        category: ownership.unit.category,
        capacity_min: ownership.unit.capacity_min,
        capacity_max: ownership.unit.capacity_max,
        bedrooms: ownership.unit.bedrooms,
        bathrooms: ownership.unit.bathrooms
      },
      property: {
        id: ownership.unit.property.id,
        name: ownership.unit.property.name,
        city: ownership.unit.property.city,
        country: ownership.unit.property.country
      }
    }));

    res.json({
      success: true,
      data: formattedOwnerships
    });
  } catch (error: any) {
    console.error('Error fetching ownerships:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ownerships',
      message: error.message
    });
  }
});

export default router;
