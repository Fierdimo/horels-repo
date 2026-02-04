/**
 * Search Routes (V2)
 * 
 * Unified search endpoints for timeshare + hotel inventory
 */

import { Router } from 'express';
import { SearchController } from '../../controllers/v2/SearchController';

const router = Router();

/**
 * POST /api/v2/search
 * 
 * Search unified inventory
 * 
 * Body:
 * - location?: string (city/country)
 * - propertyId?: number
 * - checkIn: string (ISO date)
 * - checkOut: string (ISO date)
 * - guests: number
 * - includeTimeshare?: boolean (default: true)
 * - includeHotels?: boolean (default: true)
 * - minCredits?: number
 * - maxCredits?: number
 * - page?: number (default: 1)
 * - limit?: number (default: 20, max: 100)
 * - sortBy?: 'credits' | 'date' | 'relevance' (default: 'credits')
 */
router.post('/', SearchController.search);

/**
 * GET /api/v2/search/availability/:propertyId
 * 
 * Check availability for specific property
 * 
 * Query:
 * - startDate: string (ISO date)
 * - endDate: string (ISO date)
 * - guests?: number (default: 2)
 */
router.get('/availability/:propertyId', SearchController.checkAvailability);

export default router;
