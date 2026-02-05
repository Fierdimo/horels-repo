/**
 * Marketplace V2 Routes
 * 
 * Public marketplace endpoints that read from V2 database.
 * Data is seeded from Mock PMS but then operates independently.
 */

import { Router, Request, Response } from 'express';
import TimeshareProperty from '../models/v2/TimeshareProperty';
import TimeshareUnit from '../models/v2/TimeshareUnit';
import WeekAllocation from '../models/v2/WeekAllocation';
import Ownership from '../models/v2/Ownership';
import { Op } from 'sequelize';

const router = Router();

/**
 * GET /api/marketplace/properties
 * Get all available properties for marketplace
 * Reads from timeshare_properties table (seeded from Mock PMS)
 */
router.get('/properties', async (req: Request, res: Response) => {
  try {
    const { city, search } = req.query;

    // Build query conditions
    const whereConditions: any = {
      is_active: true
    };

    if (city) {
      whereConditions.city = { [Op.like]: `%${city}%` };
    }

    if (search) {
      whereConditions[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { city: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    // Fetch properties with their units
    const properties = await TimeshareProperty.findAll({
      where: whereConditions,
      include: [{
        model: TimeshareUnit,
        as: 'units',
        where: { is_active: true },
        required: false
      }],
      order: [['name', 'ASC']]
    });

    // Format response
    const propertiesData = properties.map((property: any) => {
      const units = property.units || [];
      const minPrice = units.length > 0 
        ? Math.min(...units.map((u: any) => u.base_credit_value))
        : 0;
      
      return {
        id: property.id,
        name: property.name,
        city: property.city,
        country: property.country,
        description: property.description,
        images: property.images ? JSON.parse(property.images) : [],
        amenities: property.amenities ? JSON.parse(property.amenities) : [],
        checkInTime: '15:00',
        checkOutTime: '11:00',
        phone: '+34 000 000 000',
        email: `info@${property.name.toLowerCase().replace(/\s/g, '')}.com`,
        timezone: 'Europe/Madrid',
        roomTypesCount: units.length,
        minPrice,
        currency: property.condominium_fee_currency,
        available: true
      };
    });

    res.json({
      success: true,
      count: propertiesData.length,
      data: propertiesData,
      source: 'database'
    });
  } catch (error) {
    console.error('Error fetching marketplace properties:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch properties'
    });
  }
});

/**
 * GET /api/marketplace/properties/:propertyId
 * Get detailed property information including room types
 * Reads from database (timeshare_properties + timeshare_units)
 */
router.get('/properties/:propertyId', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;

    // Fetch property with units
    const property = await TimeshareProperty.findOne({
      where: { 
        id: parseInt(propertyId),
        is_active: true 
      },
      include: [{
        model: TimeshareUnit,
        as: 'units',
        where: { is_active: true },
        required: false
      }]
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        error: 'Property not found'
      });
    }

    // Format response
    const propertyData: any = property.toJSON();
    
    res.json({
      success: true,
      data: {
        id: propertyData.id,
        name: propertyData.name,
        address: propertyData.address,
        city: propertyData.city,
        country: propertyData.country,
        description: propertyData.description,
        images: propertyData.images ? JSON.parse(propertyData.images) : [],
        amenities: propertyData.amenities ? JSON.parse(propertyData.amenities) : [],
        checkInTime: '15:00',
        checkOutTime: '11:00',
        phone: '+34 000 000 000',
        email: `info@${propertyData.name.toLowerCase().replace(/\s/g, '')}.com`,
        timezone: 'Europe/Madrid',
        roomTypes: (propertyData.units || []).map((unit: any) => ({
          id: unit.id,
          name: unit.name,
          description: unit.description,
          capacity: unit.max_occupancy,
          basePrice: unit.base_credit_value,
          currency: propertyData.condominium_fee_currency,
          images: unit.images ? JSON.parse(unit.images) : [],
          amenities: unit.amenities ? JSON.parse(unit.amenities) : [],
          quantity: unit.quantity,
          available: true,
          bedrooms: unit.bedrooms,
          bathrooms: unit.bathrooms,
          sizeSqm: unit.size_sqm
        }))
      },
      source: 'database'
    });
  } catch (error) {
    console.error('Error fetching property details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch property details'
    });
  }
});

/**
 * GET /api/marketplace/properties/:propertyId/availability
 * Check availability for specific dates
 * Queries week_allocations table for RELEASED weeks
 */
router.get('/properties/:propertyId/availability', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;
    const { checkIn, checkOut, unitId } = req.query;

    if (!checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        error: 'checkIn and checkOut dates are required'
      });
    }

    // Verify property exists
    const property = await TimeshareProperty.findOne({
      where: { 
        id: parseInt(propertyId),
        is_active: true 
      }
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        error: 'Property not found'
      });
    }

    const checkInDate = new Date(checkIn as string);
    const checkOutDate = new Date(checkOut as string);

    // Get units for this property
    const unitsWhere: any = { 
      property_id: parseInt(propertyId),
      is_active: true 
    };
    
    if (unitId) {
      unitsWhere.id = parseInt(unitId as string);
    }

    const units = await TimeshareUnit.findAll({
      where: unitsWhere
    });

    // Check availability for each unit
    const availability = await Promise.all(units.map(async (unit: any) => {
      // Find RELEASED weeks that overlap with requested dates
      const releasedWeeks = await WeekAllocation.count({
        where: {
          status: 'RELEASED',
          [Op.or]: [
            {
              start_date: { [Op.between]: [checkInDate, checkOutDate] }
            },
            {
              end_date: { [Op.between]: [checkInDate, checkOutDate] }
            },
            {
              [Op.and]: [
                { start_date: { [Op.lte]: checkInDate } },
                { end_date: { [Op.gte]: checkOutDate } }
              ]
            }
          ]
        },
        include: [{
          model: require('../models/v2/Ownership').default,
          as: 'ownership',
          where: { unit_id: unit.id },
          required: true
        }]
      });

      return {
        unitId: unit.id,
        unitName: unit.name,
        totalUnits: unit.quantity,
        availableWeeks: releasedWeeks,
        available: releasedWeeks > 0,
        price: unit.base_credit_value,
        currency: unit.currency || 'EUR'
      };
    }));

    res.json({
      success: true,
      data: {
        propertyId: parseInt(propertyId),
        checkIn: checkInDate,
        checkOut: checkOutDate,
        availability
      }
    });
  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check availability'
    });
  }
});

/**
 * GET /api/marketplace/cities
 * Get list of cities with available properties
 */
router.get('/cities', async (req: Request, res: Response) => {
  try {
    // Query unique cities from database
    const properties = await TimeshareProperty.findAll({
      where: { is_active: true },
      attributes: ['city', 'country'],
      group: ['city', 'country']
    });
    
    // Count properties per city
    const citiesData = await Promise.all(
      properties.map(async (p: any) => {
        const count = await TimeshareProperty.count({
          where: {
            city: p.city,
            country: p.country,
            is_active: true
          }
        });

        return {
          city: p.city,
          country: p.country,
          count
        };
      })
    );

    res.json({
      success: true,
      count: citiesData.length,
      data: citiesData.sort((a, b) => a.city.localeCompare(b.city)),
      source: 'database'
    });
  } catch (error) {
    console.error('Error fetching cities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cities'
    });
  }
});

/**
 * GET /api/marketplace/search
 * Advanced search with filters
 * TODO: Reimpl with database instead of mockPMSManager
 */
/* TEMPORARILY DISABLED - Use /properties endpoint instead
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { 
      query, 
      city, 
      checkIn, 
      checkOut, 
      minPrice, 
      maxPrice,
      guests 
    } = req.query;

    let properties = mockPMSManager.getAllProperties();

    // Text search
    if (query) {
      const searchLower = (query as string).toLowerCase();
      properties = properties.filter(p =>
        p.name.toLowerCase().includes(searchLower) ||
        p.city.toLowerCase().includes(searchLower) ||
        p.description.toLowerCase().includes(searchLower)
      );
    }

    // City filter
    if (city) {
      properties = properties.filter(p => 
        p.city.toLowerCase() === (city as string).toLowerCase()
      );
    }

    // Enrich with availability and pricing
    const results = properties.map(property => {
      const roomTypes = mockPMSManager.getRoomTypes(property.id);
      
      let availableRoomTypes = roomTypes;

      // Check availability if dates provided
      if (checkIn && checkOut) {
        const checkInDate = new Date(checkIn as string);
        const checkOutDate = new Date(checkOut as string);
        
        availableRoomTypes = roomTypes.filter(rt => {
          const bookings = mockPMSManager['db'].getBookingsForRoom(
            rt.id,
            checkInDate,
            checkOutDate
          );
          return bookings.length < rt.quantity;
        });
      }

      // Filter by capacity if guests provided
      if (guests) {
        const guestCount = parseInt(guests as string);
        availableRoomTypes = availableRoomTypes.filter(rt => 
          rt.capacity >= guestCount
        );
      }

      // Filter by price range
      if (minPrice || maxPrice) {
        availableRoomTypes = availableRoomTypes.filter(rt => {
          if (minPrice && rt.basePrice < parseFloat(minPrice as string)) return false;
          if (maxPrice && rt.basePrice > parseFloat(maxPrice as string)) return false;
          return true;
        });
      }

      const lowestPrice = availableRoomTypes.length > 0
        ? Math.min(...availableRoomTypes.map(rt => rt.basePrice))
        : 0;

      return {
        id: property.id,
        name: property.name,
        city: property.city,
        country: property.country,
        description: property.description,
        images: property.images,
        amenities: property.amenities,
        availableRoomTypes: availableRoomTypes.length,
        minPrice: lowestPrice,
        currency: 'EUR',
        available: availableRoomTypes.length > 0
      };
    });

    // Filter out properties with no available rooms
    const availableResults = results.filter(r => r.available);

    res.json({
      success: true,
      count: availableResults.length,
      data: availableResults
    });
  } catch (error) {
    console.error('Error searching marketplace:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search properties'
    });
  }
});
*/

export default router;
