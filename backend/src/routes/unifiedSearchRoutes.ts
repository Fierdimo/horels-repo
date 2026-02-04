import { Router, Request, Response } from 'express';
import UnifiedSearchService from '../services/UnifiedSearchService';

const router = Router();

/**
 * @route   POST /api/unified-search
 * @desc    Search available rooms with prepaid prioritization
 * @access  Public (or authenticated based on requirements)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      location,
      propertyId,
      checkIn,
      checkOut,
      guests,
      roomType,
      minPrice,
      maxPrice,
      showAllOptions,
    } = req.body;

    // Validate required fields
    if (!checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        error: 'Check-in and check-out dates are required',
      });
    }

    // Parse dates
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format',
      });
    }

    if (checkInDate >= checkOutDate) {
      return res.status(400).json({
        success: false,
        error: 'Check-out date must be after check-in date',
      });
    }

    // Build filters
    const filters = {
      location,
      propertyId: propertyId ? parseInt(propertyId) : undefined,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      guests: guests ? parseInt(guests) : undefined,
      roomType,
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      showAllOptions: showAllOptions === true || showAllOptions === 'true',
    };

    // Execute search
    const results = await UnifiedSearchService.search(filters);

    // Filter by price range if specified
    let filteredResults = results;
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      filteredResults = results.filter((result) => {
        const price = result.cashPrice || result.creditPrice || 0;
        if (filters.minPrice !== undefined && price < filters.minPrice) return false;
        if (filters.maxPrice !== undefined && price > filters.maxPrice) return false;
        return true;
      });
    }

    // Group by priority for analytics
    const byPriority = {
      prepaid: filteredResults.filter((r) => r.priority === 1).length,
      released: filteredResults.filter((r) => r.priority === 2).length,
      pms: filteredResults.filter((r) => r.priority === 3).length,
    };

    res.json({
      success: true,
      data: {
        results: filteredResults,
        total: filteredResults.length,
        filters: {
          location: filters.location,
          propertyId: filters.propertyId,
          checkIn: checkInDate.toISOString(),
          checkOut: checkOutDate.toISOString(),
          guests: filters.guests,
          roomType: filters.roomType,
        },
        analytics: {
          byPriority,
          avgMargin: calculateAverageMargin(filteredResults),
          potentialRevenue: calculatePotentialRevenue(filteredResults),
        },
      },
    });
  } catch (error: any) {
    console.error('Error in unified search:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search inventory',
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/unified-search/stats
 * @desc    Get search statistics and availability summary
 * @access  Public
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    // TODO: Implement stats endpoint
    // Count total prepaid, released, and PMS inventory
    
    res.json({
      success: true,
      data: {
        prepaidCount: 0,
        releasedCount: 0,
        pmsCount: 0,
        totalAvailable: 0,
      },
    });
  } catch (error: any) {
    console.error('Error getting search stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get search stats',
      message: error.message,
    });
  }
});

// Helper functions
function calculateAverageMargin(results: any[]): number {
  if (results.length === 0) return 0;
  const totalMargin = results.reduce((sum, r) => sum + (r._internal.marginPercent || 0), 0);
  return Math.round(totalMargin / results.length);
}

function calculatePotentialRevenue(results: any[]): number {
  return results.reduce((sum, r) => {
    const price = r.cashPrice || r.creditPrice || 0;
    const margin = r._internal.marginPercent / 100;
    return sum + price * margin;
  }, 0);
}

export default router;
