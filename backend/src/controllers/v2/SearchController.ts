/**
 * SearchController (V2)
 * 
 * Unified search across timeshare + hotel inventory
 * 
 * Endpoints:
 * - POST /api/v2/search - Search available inventory
 * 
 * See: docs_v2/TIMESHARE_PLATFORM_V2_SPEC.md - Phase 4
 */

import { Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import {
  UnifiedSearchService,
  UnifiedSearchFilters,
} from '../../services/v2/UnifiedSearchService';

export class SearchController {
  /**
   * POST /api/v2/search
   * 
   * Search unified inventory (timeshare + hotels)
   * 
   * @param req - Express request with user context
   * @param res - Express response
   */
  static async search(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        location,
        propertyId,
        checkIn,
        checkOut,
        guests,
        includeTimeshare = true,
        includeHotels = true,
        minCredits,
        maxCredits,
        page = 1,
        limit = 20,
        sortBy = 'credits',
      } = req.body;

      // Validate required fields
      if (!checkIn || !checkOut) {
        res.status(400).json({
          error: 'checkIn and checkOut dates are required',
        });
        return;
      }

      if (!guests || guests < 1) {
        res.status(400).json({
          error: 'guests must be at least 1',
        });
        return;
      }

      // Parse dates
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);

      // Validate dates
      if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
        res.status(400).json({
          error: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DD)',
        });
        return;
      }

      if (checkInDate >= checkOutDate) {
        res.status(400).json({
          error: 'checkOut must be after checkIn',
        });
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (checkInDate < today) {
        res.status(400).json({
          error: 'checkIn cannot be in the past',
        });
        return;
      }

      // Build filters
      const filters: UnifiedSearchFilters = {
        location,
        propertyId: propertyId ? parseInt(propertyId, 10) : undefined,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        guests: parseInt(guests, 10),
        includeTimeshare,
        includeHotels,
        minCredits: minCredits ? parseInt(minCredits, 10) : undefined,
        maxCredits: maxCredits ? parseInt(maxCredits, 10) : undefined,
        page: parseInt(page, 10),
        limit: Math.min(parseInt(limit, 10), 100), // Max 100 results per page
        sortBy: sortBy as 'credits' | 'date' | 'relevance',
      };

      // Search
      const searchService = new UnifiedSearchService();
      const searchResults = await searchService.search(filters);

      res.status(200).json({
        success: true,
        data: searchResults,
      });
    } catch (error: any) {
      console.error('[SearchController] Search error:', error);
      res.status(500).json({
        error: 'Failed to search inventory',
        details: error.message,
      });
    }
  }

  /**
   * GET /api/v2/search/availability/:propertyId
   * 
   * Check availability for specific property + date range
   * 
   * Useful for calendar view
   */
  static async checkAvailability(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { propertyId } = req.params;
      const { startDate, endDate, guests = 2 } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          error: 'startDate and endDate are required',
        });
        return;
      }

      // Parse dates
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        res.status(400).json({
          error: 'Invalid date format',
        });
        return;
      }

      // Search with specific property
      const filters: UnifiedSearchFilters = {
        propertyId: parseInt(propertyId, 10),
        checkIn: start,
        checkOut: end,
        guests: parseInt(guests as string, 10),
        includeTimeshare: true,
        includeHotels: true,
        page: 1,
        limit: 100, // Get all for availability check
      };

      const searchService = new UnifiedSearchService();
      const results = await searchService.search(filters);

      // Transform to simple availability map
      const availability = results.results.map((r) => ({
        date: r.dates.checkIn,
        available: r.availability.available,
        credits: r.price.credits,
        source: r.source,
      }));

      res.status(200).json({
        success: true,
        data: {
          propertyId: parseInt(propertyId, 10),
          startDate: start,
          endDate: end,
          availability,
        },
      });
    } catch (error: any) {
      console.error('[SearchController] Availability check error:', error);
      res.status(500).json({
        error: 'Failed to check availability',
        details: error.message,
      });
    }
  }
}
