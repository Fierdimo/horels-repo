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

/**
 * @route GET /hotels/staff/owners
 * @desc Get owners list for staff's property (for period assignment)
 * @access Staff only
 */
router.get(
  '/owners',
  authenticateToken,
  authorize(['view_bookings']),
  logAction('view_owners_list_staff'),
  async (req: any, res: Response) => {
    try {
      const propertyId = req.user.property_id;

      if (!propertyId) {
        return res.status(400).json({
          success: false,
          error: 'Staff must be assigned to a property'
        });
      }

      const { Role, User } = require('../models');
      
      // Get owner role
      const ownerRole = await Role.findOne({ where: { name: 'owner' } });
      
      if (!ownerRole) {
        return res.status(404).json({ 
          success: false,
          error: 'Owner role not found' 
        });
      }

      // Get all active owners (staff can assign periods to any owner for their property)
      const owners = await User.findAll({
        where: { 
          role_id: ownerRole.id
          // Temporalmente sin filtro de status para ver todos los owners
        },
        attributes: ['id', 'firstName', 'lastName', 'email', 'status'],
        order: [['firstName', 'ASC'], ['lastName', 'ASC']]
      });

      console.log('Found owners:', owners.length);
      if (owners.length > 0) {
        console.log('First owner sample:', JSON.stringify(owners[0], null, 2));
      }

      res.json({
        success: true,
        data: owners
      });
    } catch (error) {
      console.error('Error fetching owners for staff:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch owners'
      });
    }
  }
);

/**
 * @route POST /hotels/staff/assign-period
 * @desc Assign a floating period to an owner (staff can only assign to their property)
 * @access Staff only
 */
router.post(
  '/assign-period',
  authenticateToken,
  authorize(['view_bookings', 'create_booking']),
  logAction('assign_period_to_owner_staff'),
  async (req: any, res: Response) => {
    try {
      const staffPropertyId = req.user.property_id;
      const { owner_id, nights, valid_until, accommodation_type } = req.body;

      if (!staffPropertyId) {
        return res.status(400).json({
          success: false,
          error: 'Staff must be assigned to a property'
        });
      }

      // Use staff's property automatically
      const property_id = staffPropertyId;

      // Validate required fields
      if (!owner_id || !nights || !valid_until || !accommodation_type) {
        return res.status(400).json({ 
          success: false,
          error: 'Missing required fields: owner_id, nights, valid_until, accommodation_type' 
        });
      }

      const { Role, User, Week } = require('../models');

      // Validate owner exists and is an owner role
      const owner = await User.findOne({
        where: { id: owner_id },
        include: [{ 
          model: Role, 
          where: { name: 'owner' },
          attributes: ['name']
        }]
      });

      if (!owner) {
        return res.status(404).json({ 
          success: false,
          error: 'Owner not found or user is not an owner' 
        });
      }

      // Validate property exists
      const property = await Property.findByPk(property_id);
      if (!property) {
        return res.status(404).json({ 
          success: false,
          error: 'Property not found' 
        });
      }

      // Validate nights value
      const nightsNum = parseInt(nights);
      if (isNaN(nightsNum) || nightsNum < 1) {
        return res.status(400).json({ 
          success: false,
          error: 'Nights must be at least 1' 
        });
      }

      // Validate valid_until date
      const validUntilDate = new Date(valid_until);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (validUntilDate <= today) {
        return res.status(400).json({ 
          success: false,
          error: 'Valid until date must be in the future' 
        });
      }

      // Create the floating period (without specific dates)
      const week = await Week.create({
        owner_id,
        property_id,
        nights: nightsNum,
        valid_until: validUntilDate,
        accommodation_type,
        status: 'available'
      });

      await week.reload({
        include: [{ model: Property, as: 'Property', attributes: ['name', 'location'] }]
      });

      res.json({
        success: true,
        message: `Floating period of ${nightsNum} night(s) assigned successfully (valid until ${validUntilDate.toLocaleDateString()})`,
        data: {
          week,
          nights: nightsNum,
          owner_name: `${owner.firstName} ${owner.lastName}`,
          owner_email: owner.email
        }
      });
    } catch (error) {
      console.error('Error assigning period:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to assign period' 
      });
    }
  }
);

export default router;
