import { Router, Request, Response } from 'express';
import { Op } from 'sequelize';
import crypto from 'crypto';
import { authenticateToken } from '../middleware/authMiddleware';
import { requireStaffRole } from '../middleware/staffOnly';
import OwnerInvitation from '../models/OwnerInvitation';
import Property from '../models/Property';
import User from '../models/User';
import Week from '../models/Week';
import NightCredit from '../models/NightCredit';
import Role from '../models/Role';
import CreditCalculationService from '../services/CreditCalculationService';
import sequelize from '../config/database';

// Extend Request type to include user
interface AuthRequest extends Request {
  user?: User;
}

// Week data interface for invitations
interface RoomData {
  room_id: number;
  start_date: string;
  end_date: string;
  room_type: string; // For credit calculation
}

const router = Router();

// Create owner invitation with pre-assigned weeks
router.post(
  '/create-owner-invitation',
  authenticateToken,
  requireStaffRole,
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        email,
        first_name,
        last_name,
        rooms_data, // Array of: [{room_id, start_date, end_date, room_type}]
        expires_in_days = 30,
      } = req.body;

      // Get staff's property_id
      const staffUser = req.user;
      if (!staffUser?.property_id) {
        return res.status(403).json({
          success: false,
          message: 'Staff user must be associated with a property',
        });
      }

      const property_id = staffUser.property_id;

      // Validation
      if (!email || !rooms_data || !Array.isArray(rooms_data) || rooms_data.length === 0) {
        console.log('❌ Validation failed:', { email, rooms_data });
        return res.status(400).json({
          success: false,
          message: 'Email and rooms_data are required',
        });
      }

      // Validate that all rooms have required fields
      for (const room of rooms_data) {
        if (!room.room_id || !room.start_date || !room.end_date || !room.room_type) {
          console.log('❌ Room validation failed:', room);
          return res.status(400).json({
            success: false,
            message: 'All rooms must have room_id, start_date, end_date, and room_type',
          });
        }
      }

      // Import Room model to validate rooms belong to staff's property
      const { default: Room } = await import('../models/room');
      
      // Verify all rooms belong to staff's property
      const roomIds = rooms_data.map(r => r.room_id);
      const rooms = await Room.findAll({
        where: { id: roomIds, propertyId: property_id }
      });
      
      if (rooms.length !== roomIds.length) {
        return res.status(403).json({
          success: false,
          message: 'One or more rooms do not belong to your property',
        });
      }

      // TODO: Validate room availability for the specified dates

      // Check if user already exists
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists. Use the assign period feature instead.',
        });
      }

      // Check for existing pending invitation
      const existingInvitation = await OwnerInvitation.findOne({
        where: { email, status: 'pending' },
      });

      if (existingInvitation && existingInvitation.isValid()) {
        return res.status(400).json({
          success: false,
          message: 'A pending invitation already exists for this email',
          data: {
            token: existingInvitation.token,
            expires_at: existingInvitation.expires_at,
          },
        });
      }

      // Generate unique token
      const token = crypto.randomBytes(32).toString('hex');

      // Calculate expiration date
      const expires_at = new Date();
      expires_at.setDate(expires_at.getDate() + expires_in_days);

      // Create invitation
      const invitation = await OwnerInvitation.create({
        token,
        email,
        first_name,
        last_name,
        created_by_staff_id: (req as any).user.id,
        property_id,
        rooms_data,
        expires_at,
        status: 'pending',
      });

      // Generate invitation link
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const invitationLink = invitation.getInvitationLink(frontendUrl);

      // NOTE: Email is NOT sent automatically anymore.
      // Staff must manually click "Send Email" button after reviewing the invitation.
      console.log(`📧 Invitation created for ${email}. Email NOT sent automatically.`);

      return res.status(201).json({
        success: true,
        message: 'Owner invitation created successfully. Use "Send Email" button to send invitation.',
        data: {
          invitation: {
            id: invitation.id,
            token: invitation.token,
            email: invitation.email,
            first_name: invitation.first_name,
            last_name: invitation.last_name,
            property_id: invitation.property_id,
            rooms_data: invitation.rooms_data,
            rooms_count: invitation.rooms_data.length,
            expires_at: invitation.expires_at,
            invitation_link: invitationLink,
            email_sent: false,
            created_at: invitation.created_at,
            status: invitation.status,
          },
        },
      });
    } catch (error: any) {
      console.error('Error creating owner invitation:', error);
      return res.status(500).json({
        success: false,
        message: 'Error creating invitation',
        error: error.message,
      });
    }
  }
);

// Cancel pending invitation (for testing/cleanup)
router.delete(
  '/cancel-invitation/:invitationId',
  authenticateToken,
  requireStaffRole,
  async (req: AuthRequest, res: Response) => {
    try {
      const { invitationId } = req.params;
      const staffUser = req.user;

      if (!staffUser?.property_id) {
        return res.status(403).json({
          success: false,
          message: 'Staff user must be associated with a property',
        });
      }

      // Find invitation
      const invitation = await OwnerInvitation.findByPk(invitationId);

      if (!invitation) {
        return res.status(404).json({
          success: false,
          message: 'Invitation not found',
        });
      }

      // Verify invitation belongs to staff's property
      if (invitation.property_id !== staffUser.property_id) {
        return res.status(403).json({
          success: false,
          message: 'You can only cancel invitations for your property',
        });
      }

      // Only allow canceling pending invitations
      if (invitation.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: `Cannot cancel invitation with status: ${invitation.status}`,
        });
      }

      // Update status to cancelled
      await invitation.update({ status: 'cancelled' });

      return res.json({
        success: true,
        message: 'Invitation cancelled successfully',
        data: {
          invitation_id: invitation.id,
          email: invitation.email,
        },
      });
    } catch (error: any) {
      console.error('Error cancelling invitation:', error);
      return res.status(500).json({
        success: false,
        message: 'Error cancelling invitation',
        error: error.message,
      });
    }
  }
);

// Send invitation email manually
router.post(
  '/:invitationId/send-email',
  authenticateToken,
  requireStaffRole,
  async (req: AuthRequest, res: Response) => {
    try {
      const { invitationId } = req.params;
      const staffUser = req.user;

      if (!staffUser?.property_id) {
        return res.status(403).json({
          success: false,
          message: 'Staff user must be associated with a property',
        });
      }

      // Find invitation
      const invitation = await OwnerInvitation.findByPk(invitationId);

      if (!invitation) {
        return res.status(404).json({
          success: false,
          message: 'Invitation not found',
        });
      }

      // Verify invitation belongs to staff's property
      if (invitation.property_id !== staffUser.property_id) {
        return res.status(403).json({
          success: false,
          message: 'You can only send emails for invitations from your property',
        });
      }

      // Only send email for pending invitations
      if (invitation.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: `Cannot send email for invitation with status: ${invitation.status}`,
        });
      }

      // Generate invitation link
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const invitationLink = invitation.getInvitationLink(frontendUrl);

      // Send invitation email
      const emailService = (await import('../services/emailService')).default;
      const property = await Property.findByPk(invitation.property_id);
      const propertyName = property ? property.name : 'Our Property';
      
      let emailSent = false;
      try {
        emailSent = await emailService.sendOwnerInvitation(
          invitation.email,
          invitation.first_name,
          invitation.last_name,
          invitationLink,
          propertyName,
          invitation.rooms_data.length
        );
        
        if (emailSent) {
          console.log(`✅ Invitation email sent successfully to ${invitation.email}`);
          return res.json({
            success: true,
            message: 'Invitation email sent successfully',
            data: {
              invitation_id: invitation.id,
              email: invitation.email,
              email_sent: true,
            },
          });
        } else {
          console.log(`⚠️ Invitation email could not be sent to ${invitation.email} (email service issue)`);
          return res.status(500).json({
            success: false,
            message: 'Failed to send invitation email. Email service may be unavailable.',
          });
        }
      } catch (emailError: any) {
        console.error('❌ Failed to send invitation email:', emailError.message);
        return res.status(500).json({
          success: false,
          message: 'Failed to send invitation email',
          error: emailError.message,
        });
      }
    } catch (error: any) {
      console.error('Error sending invitation email:', error);
      return res.status(500).json({
        success: false,
        message: 'Error sending invitation email',
        error: error.message,
      });
    }
  }
);

// Get invitation by token (public endpoint for registration)
router.get('/invitation/:token', async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.params;

    console.log('🔍 Validating invitation token:', token);

    const invitation = await OwnerInvitation.findOne({
      where: { token },
      include: [
        {
          model: Property,
          as: 'property',
          attributes: ['id', 'name', 'location'],
        },
      ],
    });

    if (!invitation) {
      console.log('❌ Invitation not found for token:', token);
      return res.status(404).json({
        success: false,
        message: 'Invitation not found',
      });
    }

    console.log('📋 Invitation found:', {
      status: invitation.status,
      expires_at: invitation.expires_at,
      is_valid: invitation.isValid()
    });

    if (!invitation.isValid()) {
      console.log('❌ Invitation is not valid:', {
        status: invitation.status,
        expires_at: invitation.expires_at,
        now: new Date()
      });
      return res.status(400).json({
        success: false,
        message: invitation.status === 'expired' ? 'Invitation has expired' : 'Invitation is no longer valid',
        data: { status: invitation.status },
      });
    }

    return res.json({
      success: true,
      data: {
        email: invitation.email,
        first_name: invitation.first_name,
        last_name: invitation.last_name,
        property: invitation.property,
        rooms_count: invitation.rooms_data.length,
        expires_at: invitation.expires_at,
      },
    });
  } catch (error: any) {
    console.error('Error fetching invitation:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching invitation',
      error: error.message,
    });
  }
});

// OBSOLETE: Moved to publicInvitationRoutes (no auth required)
// Validate invitation token (for registration page)
/*
router.get('/validate-token', async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Token is required',
      });
    }

    const { Op } = await import('sequelize');
    const invitation = await OwnerInvitation.findOne({
      where: {
        token,
        status: 'pending',
        expires_at: { [Op.gt]: new Date() }
      },
      include: [
        {
          model: Property,
          as: 'property',
          attributes: ['id', 'name', 'location', 'tier'],
        }
      ],
    });

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired invitation token',
      });
    }

    // Parse rooms_data if it's a string
    let roomsData = invitation.rooms_data;
    if (typeof roomsData === 'string') {
      roomsData = JSON.parse(roomsData);
    }

    // Calculate estimated credits for each room
    const roomsWithEstimates = roomsData.map((room: any) => {
      const startDate = new Date(room.start_date);
      const endDate = new Date(room.end_date);
      const nights = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Simple estimation (actual calculation happens on acceptance)
      const estimatedCredits = Math.round(nights * 1.2); // Rough estimate

      return {
        ...room,
        nights,
        estimated_credits: estimatedCredits
      };
    });

    const totalNights = roomsWithEstimates.reduce((sum: number, room: any) => sum + room.nights, 0);
    const totalEstimatedCredits = roomsWithEstimates.reduce((sum: number, room: any) => sum + room.estimated_credits, 0);

    return res.json({
      success: true,
      data: {
        invitation: {
          email: invitation.email,
          first_name: invitation.first_name,
          last_name: invitation.last_name,
          property: invitation.property,
          rooms: roomsWithEstimates,
          total_nights: totalNights,
          total_estimated_credits: totalEstimatedCredits,
          expires_at: invitation.expires_at,
        }
      },
    });
  } catch (error: any) {
    console.error('Error validating invitation token:', error);
    return res.status(500).json({
      success: false,
      message: 'Error validating invitation token',
      error: error.message,
    });
  }
});
*/

// Accept invitation and create owner account (called during registration)
router.post('/accept-invitation', async (req: AuthRequest, res: Response) => {
  try {
    const { token, user_id, acceptance_type } = req.body;

    if (!token || !user_id) {
      return res.status(400).json({
        success: false,
        message: 'Token and user_id are required',
      });
    }

    if (!acceptance_type || !['booking', 'credits'].includes(acceptance_type)) {
      return res.status(400).json({
        success: false,
        message: 'acceptance_type must be either "booking" or "credits"',
      });
    }

    const invitation = await OwnerInvitation.findOne({
      where: { token, status: 'pending' },
      include: [{ model: Property, as: 'property' }],
    });

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found or already accepted',
      });
    }

    if (!invitation.isValid()) {
      return res.status(400).json({
        success: false,
        message: 'Invitation has expired',
      });
    }

    // Import models needed
    const { Week, User, Role, NightCredit, Booking } = await import('../models');
    const { default: CreditBookingCost } = await import('../models/CreditBookingCost');
    const { default: SeasonalCalendar } = await import('../models/SeasonalCalendar');

    // Get the user and convert to owner role
    const user = await User.findByPk(user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Convert user to owner role
    const ownerRole = await Role.findOne({ where: { name: 'owner' } });
    if (ownerRole) {
      await user.update({ role_id: ownerRole.id });
    }

    // Process based on acceptance type
    if (acceptance_type === 'booking') {
      // FLOW A: Accept as Bookings (create pending reservations for owner to confirm)
      const createdBookings = [];
      
      // Parse rooms_data if it's a string
      let roomsData = invitation.rooms_data;
      if (typeof roomsData === 'string') {
        roomsData = JSON.parse(roomsData);
      }
      
      console.log('📦 Processing rooms data:', JSON.stringify(roomsData, null, 2));
      
      for (const roomData of roomsData) {
        console.log('🏠 Creating confirmed booking for room:', roomData);
        
        // Generate unique guest token for the booking
        const guestToken = `owner-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        
        const booking = await Booking.create({
          property_id: invitation.property_id,
          room_id: roomData.room_id,
          guest_name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
          guest_email: user.email,
          guest_phone: user.phone || null,
          check_in: new Date(roomData.start_date),
          check_out: new Date(roomData.end_date),
          room_type: roomData.room_type || 'standard',
          status: 'confirmed', // Automatically confirmed since staff already approved these dates
          guest_token: guestToken,
          total_amount: 0, // No payment needed for owner invitations
          currency: 'EUR',
          payment_status: 'completed',
          raw: {
            source: 'staff_invitation',
            booking_type: 'owner_invitation_auto_confirmed',
            user_id: user_id,
            invitation_id: invitation.id
          }
        });
        
        createdBookings.push(booking);
      }

      // Mark invitation as accepted
      await invitation.update({
        status: 'accepted',
        acceptance_type: 'booking',
        accepted_at: new Date(),
        created_user_id: user_id,
      });

      return res.json({
        success: true,
        message: 'Invitation accepted. Your bookings have been automatically confirmed.',
        data: {
          acceptance_type: 'booking',
          bookings_created: createdBookings.length,
          bookings: createdBookings.map(b => ({
            id: b.id,
            room_id: b.room_id,
            check_in: b.check_in,
            check_out: b.check_out,
            status: b.status,
          })),
          user_role: 'owner',
        },
      });

    } else {
      // FLOW B: Convert to Credits (deposit in wallet using NEW system)
      const { default: UserCreditWallet } = await import('../models/UserCreditWallet');
      const { default: CreditTransaction } = await import('../models/CreditTransaction');
      
      const createdWeeks = [];
      const createdTransactions = [];
      let totalNights = 0;
      let totalCredits = 0;

      // Get or create wallet for user
      const wallet = await UserCreditWallet.getOrCreateWallet(user_id);

      for (const roomData of invitation.rooms_data) {
        // Calculate nights from dates
        const startDate = new Date(roomData.start_date);
        const endDate = new Date(roomData.end_date);
        const nights = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

        if (nights < 1) {
          console.warn(`Invalid period for room: ${roomData.start_date} to ${roomData.end_date}`);
          continue;
        }

        // AUTO-DETECT season type from dates using seasonal calendar (with default fallback)
        let seasonType: 'RED' | 'WHITE' | 'BLUE' = 'WHITE';
        try {
          seasonType = await SeasonalCalendar.getSeasonForDateWithDefault(invitation.property_id, startDate);
          console.log(`Season detected for ${roomData.start_date}: ${seasonType}`);
        } catch (error) {
          console.error('Error detecting season, using WHITE fallback:', error);
        }

        // Create the week record
        const week = await Week.create({
          owner_id: user_id,
          property_id: invitation.property_id,
          start_date: roomData.start_date,
          end_date: roomData.end_date,
          accommodation_type: roomData.room_type,
          season_type: seasonType,
          nights: nights,
          status: 'converted',
          deposited_for_credits: true,
          deposited_at: new Date(),
        });
        createdWeeks.push(week);

        // Calculate credits using Master Formula
        let weekCredits = 0;
        let calculationBreakdown = null;
        
        try {
          const creditResult = await CreditCalculationService.calculateDepositCredits(week.id);
          weekCredits = creditResult.credits;
          calculationBreakdown = creditResult.breakdown;
          
          console.log(`✅ Credits calculated for week ${week.id}:`, {
            credits: creditResult.credits,
            property: creditResult.breakdown.propertyName,
            tier: creditResult.breakdown.propertyTier,
            season: creditResult.breakdown.seasonType,
            roomType: creditResult.breakdown.roomType,
            formula: `${creditResult.breakdown.baseValue} × ${creditResult.breakdown.tierMultiplier} × ${creditResult.breakdown.locationMultiplier} × ${creditResult.breakdown.roomTypeMultiplier} = ${creditResult.credits}`,
            breakdown: creditResult.breakdown
          });
          
          // Update week with calculation details
          await week.update({
            credits_generated: weekCredits,
            deposit_calculation: calculationBreakdown
          });
        } catch (error: any) {
          console.error('❌ Error calculating credits with Master Formula:', error);
          weekCredits = nights; // Fallback to nights only
        }

        // Calculate expiration date (6 months)
        const expiryDate = CreditCalculationService.calculateExpirationDate(new Date());

        // Create credit transaction (DEPOSIT)
        const transaction = await CreditTransaction.create({
          user_id: user_id,
          transaction_type: 'DEPOSIT',
          amount: weekCredits,
          balance_after: parseFloat(wallet.total_balance.toString()) + weekCredits,
          status: 'ACTIVE',
          week_id: week.id,
          description: `Deposit from invitation: ${nights} nights at ${invitation.property?.name || 'property'} (${seasonType} season, ${roomData.room_type})`,
          expires_at: expiryDate,
          deposited_at: new Date(),
          metadata: JSON.stringify({
            invitation_id: invitation.id,
            property_id: invitation.property_id,
            season_type: seasonType,
            nights: nights,
            room_type: roomData.room_type,
            calculation: calculationBreakdown
          })
        });

        createdTransactions.push(transaction);
        
        // Update wallet balance
        wallet.total_balance = parseFloat(wallet.total_balance.toString()) + weekCredits;
        wallet.total_earned = parseFloat(wallet.total_earned.toString()) + weekCredits;
        wallet.last_transaction_at = new Date();
        
        totalNights += nights;
        totalCredits += weekCredits;
      }

      // Save wallet updates
      await wallet.save();

      // Mark invitation as accepted
      await invitation.update({
        status: 'accepted',
        acceptance_type: 'credits',
        accepted_at: new Date(),
        created_user_id: user_id,
      });

      console.log(`✅ Invitation accepted with NEW credit system:`, {
        user_id,
        weeks_created: createdWeeks.length,
        transactions_created: createdTransactions.length,
        total_credits: totalCredits,
        wallet_balance: wallet.total_balance
      });

      return res.json({
        success: true,
        message: `Invitation accepted! ${totalCredits} credits deposited to your wallet (expires in 6 months)`,
        data: {
          acceptance_type: 'credits',
          weeks_created: createdWeeks.length,
          transactions_created: createdTransactions.length,
          total_nights: totalNights,
          total_credits: totalCredits,
          wallet_balance: parseFloat(wallet.total_balance.toString()),
          expiration_date: createdTransactions[0]?.expires_at,
          user_role: 'owner',
        },
      });
    }
  } catch (error: any) {
    console.error('Error accepting invitation:', error);
    return res.status(500).json({
      success: false,
      message: 'Error accepting invitation',
      error: error.message,
    });
  }
});

// List invitations created by current staff member
router.get('/my-invitations', authenticateToken, requireStaffRole, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;
    const staffUser = req.user;

    if (!staffUser?.property_id) {
      return res.status(403).json({
        success: false,
        message: 'Staff user must be associated with a property',
      });
    }

    const whereClause: any = { 
      created_by_staff_id: staffUser.id,
      property_id: staffUser.property_id 
    };

    // Filter by status if provided
    if (status) {
      whereClause.status = status;
    }

    const invitations = await OwnerInvitation.findAll({
      where: whereClause,
      include: [
        {
          model: Property,
          as: 'property',
          attributes: ['id', 'name', 'location'],
        },
        {
          model: User,
          as: 'createdUser',
          attributes: ['id', 'email', 'first_name', 'last_name'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    // Add invitation_link to each invitation
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const invitationsWithLinks = invitations.map((invitation) => {
      const invitationJson = invitation.toJSON();
      return {
        ...invitationJson,
        invitation_link: invitation.getInvitationLink(frontendUrl),
        rooms_count: invitation.rooms_data?.length || 0,
      };
    });

    return res.json({
      success: true,
      data: { invitations: invitationsWithLinks },
    });
  } catch (error: any) {
    console.error('Error listing invitations:', error);
    return res.status(500).json({
      success: false,
      message: 'Error listing invitations',
      error: error.message,
    });
  }
});

// Get pending approval bookings for staff
router.get('/pending-approvals', authenticateToken, requireStaffRole, async (req: AuthRequest, res: Response) => {
  try {
    const staffUser = req.user;
    const propertyId = staffUser?.property_id;

    if (!propertyId) {
      return res.status(403).json({
        success: false,
        message: 'Staff user must be associated with a property',
      });
    }

    const { default: Booking } = await import('../models/Booking');
    const { default: User } = await import('../models/User');

    // Get all bookings with status pending_approval for this property
    const pendingBookings = await Booking.findAll({
      where: {
        property_id: propertyId,
        status: 'pending_approval'
      },
      order: [['created_at', 'DESC']],
      raw: true
    });

    // Parse metadata for each booking
    const bookingsWithMetadata = pendingBookings.map(booking => {
      let metadata = booking.raw;
      if (typeof metadata === 'string') {
        try {
          metadata = JSON.parse(metadata);
        } catch (e) {
          metadata = null;
        }
      }
      return {
        ...booking,
        metadata
      };
    });

    return res.json({
      success: true,
      data: bookingsWithMetadata,
      count: bookingsWithMetadata.length
    });
  } catch (error: any) {
    console.error('Error fetching pending approvals:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching pending approvals',
      error: error.message,
    });
  }
});

// Approve booking (staff only)
router.post('/approve-booking/:bookingId', authenticateToken, requireStaffRole, async (req: AuthRequest, res: Response) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { bookingId } = req.params;
    const staffUser = req.user;
    const propertyId = staffUser?.property_id;

    if (!propertyId) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Staff user must be associated with a property',
      });
    }

    const { default: Booking } = await import('../models/Booking');
    const { default: UserCreditWallet } = await import('../models/UserCreditWallet');
    const { default: CreditTransaction } = await import('../models/CreditTransaction');

    const booking = await Booking.findByPk(bookingId, { transaction });

    if (!booking) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Verify booking belongs to staff's property
    if (booking.property_id !== propertyId) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'You can only approve bookings for your property',
      });
    }

    // Verify it's pending approval
    if (booking.status !== 'pending_approval') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Only bookings with pending_approval status can be approved',
      });
    }

    // Si el booking fue pagado con créditos, confirmar la transacción
    if (booking.payment_method === 'CREDITS') {
      // Buscar la transacción pendiente de créditos
      const creditTx = await CreditTransaction.findOne({
        where: {
          booking_id: booking.id,
          transaction_type: 'SPEND',
          status: 'ACTIVE' // Los créditos están bloqueados pero no gastados
        },
        transaction
      });

      if (creditTx) {
        // Marcar créditos como SPENT (confirmados)
        creditTx.status = 'SPENT';
        
        // Actualizar metadata
        let metadata = creditTx.metadata;
        if (typeof metadata === 'string') {
          try {
            metadata = JSON.parse(metadata);
          } catch (e) {
            metadata = {};
          }
        }
        metadata = { 
          ...metadata, 
          approved_at: new Date(), 
          approved_by: staffUser?.id,
          pending_approval: false 
        };
        creditTx.metadata = metadata;
        creditTx.description = creditTx.description?.replace('pending approval', 'approved');
        
        await creditTx.save({ transaction });
        
        // Ahora SÍ incrementar total_spent (créditos confirmados como gastados)
        const wallet = await UserCreditWallet.getWalletWithLock(creditTx.user_id, transaction);
        wallet.total_spent += Math.abs(creditTx.amount);
        await wallet.save({ transaction });

        console.log('✅ Credits confirmed for approved booking:', {
          booking_id: booking.id,
          transaction_id: creditTx.id,
          amount: creditTx.amount
        });
      }

      // Actualizar payment_status del booking
      await booking.update({ 
        status: 'confirmed',
        payment_status: 'paid'
      }, { transaction });
    } else {
      // Booking sin créditos (invitación normal)
      await booking.update({ status: 'confirmed' }, { transaction });
    }

    await transaction.commit();

    console.log('✅ Booking approved by staff:', {
      booking_id: booking.id,
      staff_id: staffUser?.id,
      property_id: propertyId,
      payment_method: booking.payment_method
    });

    return res.json({
      success: true,
      message: 'Booking approved successfully',
      data: booking,
    });
  } catch (error: any) {
    await transaction.rollback();
    console.error('Error approving booking:', error);
    return res.status(500).json({
      success: false,
      message: 'Error approving booking',
      error: error.message,
    });
  }
});

// Reject booking (staff only)
router.post('/reject-booking/:bookingId', authenticateToken, requireStaffRole, async (req: AuthRequest, res: Response) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { bookingId } = req.params;
    const { reason } = req.body;
    const staffUser = req.user;
    const propertyId = staffUser?.property_id;

    if (!propertyId) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Staff user must be associated with a property',
      });
    }

    const { default: Booking } = await import('../models/Booking');
    const { default: UserCreditWallet } = await import('../models/UserCreditWallet');
    const { default: CreditTransaction } = await import('../models/CreditTransaction');
    const { default: User } = await import('../models/User');

    const booking = await Booking.findByPk(bookingId, { transaction });

    if (!booking) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Verify booking belongs to staff's property
    if (booking.property_id !== propertyId) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'You can only reject bookings for your property',
      });
    }

    // Verify it's pending approval
    if (booking.status !== 'pending_approval') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Only bookings with pending_approval status can be rejected',
      });
    }

    // Si el booking fue pagado con créditos, REVERTIR los créditos bloqueados
    if (booking.payment_method === 'CREDITS') {
      // Buscar el usuario del booking
      const user = await User.findOne({
        where: { email: booking.guest_email },
        transaction
      });

      if (user) {
        // Buscar la transacción pendiente de créditos
        const creditTx = await CreditTransaction.findOne({
          where: {
            booking_id: booking.id,
            transaction_type: 'SPEND',
            status: 'ACTIVE'
          },
          transaction
        });

        if (creditTx) {
          const creditsToRefund = Math.abs(creditTx.amount);
          
          // Marcar transacción original como REFUNDED
          creditTx.status = 'REFUNDED';
          let metadata = creditTx.metadata;
          if (typeof metadata === 'string') {
            try {
              metadata = JSON.parse(metadata);
            } catch (e) {
              metadata = {};
            }
          }
          metadata = { 
            ...metadata, 
            rejected_at: new Date(), 
            rejected_by: staffUser?.id,
            rejection_reason: reason 
          };
          creditTx.metadata = metadata;
          await creditTx.save({ transaction });

          // Crear transacción de REFUND
          const wallet = await UserCreditWallet.getWalletWithLock(user.id, transaction);
          
          await CreditTransaction.create({
            user_id: user.id,
            transaction_type: 'REFUND',
            amount: creditsToRefund,
            balance_after: wallet.total_balance + creditsToRefund,
            status: 'ACTIVE',
            booking_id: booking.id,
            description: `Refund for rejected booking - ${reason || 'Staff rejection'}`,
            metadata: JSON.stringify({
              original_transaction_id: creditTx.id,
              rejected_by: staffUser?.id,
              rejection_reason: reason
            })
          }, { transaction });

          // Actualizar wallet (devolver créditos - no tocar total_spent porque nunca se incrementó)
          wallet.total_balance += creditsToRefund;
          wallet.last_transaction_at = new Date();
          await wallet.save({ transaction });

          console.log('💰 Credits refunded for rejected booking:', {
            booking_id: booking.id,
            user_id: user.id,
            credits_refunded: creditsToRefund,
            new_balance: wallet.total_balance
          });
        }
      }

      // Actualizar payment_status del booking
      await booking.update({ 
        status: 'cancelled',
        payment_status: 'refunded'
      }, { transaction });
    } else {
      // Booking sin créditos (invitación normal)
      await booking.update({ status: 'cancelled' }, { transaction });
    }

    // Update metadata with rejection reason
    let bookingMetadata = booking.raw;
    if (typeof bookingMetadata === 'string') {
      try {
        bookingMetadata = JSON.parse(bookingMetadata);
      } catch (e) {
        bookingMetadata = {};
      }
    }
    bookingMetadata = { 
      ...bookingMetadata, 
      rejection_reason: reason, 
      rejected_at: new Date(), 
      rejected_by: staffUser?.id 
    };
    await booking.update({ raw: bookingMetadata }, { transaction });

    await transaction.commit();

    console.log('❌ Booking rejected by staff:', {
      booking_id: booking.id,
      staff_id: staffUser?.id,
      property_id: propertyId,
      payment_method: booking.payment_method,
      reason
    });

    return res.json({
      success: true,
      message: 'Booking rejected successfully. Credits have been refunded.',
      data: booking,
    });
  } catch (error: any) {
    await transaction.rollback();
    console.error('Error rejecting booking:', error);
    return res.status(500).json({
      success: false,
      message: 'Error rejecting booking',
      error: error.message,
    });
  }
});

// Cancel invitation
router.patch('/cancel-invitation/:id', authenticateToken, requireStaffRole, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const invitation = await OwnerInvitation.findOne({
      where: {
        id,
        created_by_staff_id: (req as any).user.id, // Only allow cancelling own invitations
      },
    });

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found',
      });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Can only cancel pending invitations',
      });
    }

    await invitation.update({ status: 'cancelled' });

    return res.json({
      success: true,
      message: 'Invitation cancelled successfully',
    });
  } catch (error: any) {
    console.error('Error cancelling invitation:', error);
    return res.status(500).json({
      success: false,
      message: 'Error cancelling invitation',
      error: error.message,
    });
  }
});

// Confirm pending booking from invitation (owner confirms they want to keep the booking)
router.post('/confirm-booking/:bookingId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    // Import Booking model
    const { default: Booking } = await import('../models/Booking');

    const booking = await Booking.findByPk(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Verify ownership by checking guest_email matches user email
    const { default: User } = await import('../models/User');
    const user = await User.findByPk(userId);
    
    if (!user || booking.guest_email !== user.email) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to confirm this booking',
      });
    }

    // Verify it's from an invitation and pending
    // Parse raw field if it's a string
    let metadata = booking.raw;
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata);
      } catch (e) {
        console.error('Failed to parse booking.raw:', e);
        metadata = null;
      }
    }
    
    if (metadata?.source !== 'staff_invitation' || booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending invitation bookings can be confirmed',
      });
    }

    // Change status to pending_approval (staff must approve)
    await booking.update({ status: 'pending_approval' });

    console.log('✅ Booking marked as pending approval:', {
      booking_id: booking.id,
      guest_email: booking.guest_email,
      property_id: booking.property_id
    });

    return res.json({
      success: true,
      message: 'Booking request sent to staff for approval',
      data: booking,
    });
  } catch (error: any) {
    console.error('Error confirming booking:', error);
    return res.status(500).json({
      success: false,
      message: 'Error confirming booking',
      error: error.message,
    });
  }
});

// Convert pending booking to credits (owner chooses credits instead of keeping the booking)
router.post('/convert-booking-to-credits/:bookingId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    // Import models
    const { default: Booking } = await import('../models/Booking');
    const { default: UserCreditWallet } = await import('../models/UserCreditWallet');
    const { default: CreditTransaction } = await import('../models/CreditTransaction');
    const { default: CreditCalculationService } = await import('../services/CreditCalculationService');

    const booking = await Booking.findByPk(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Verify ownership by checking guest_email matches user email
    const { default: User } = await import('../models/User');
    const user = await User.findByPk(userId);
    
    if (!user || booking.guest_email !== user.email) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to convert this booking',
      });
    }

    // Verify it's from an invitation and pending
    // Parse raw field if it's a string
    let metadata = booking.raw;
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata);
      } catch (e) {
        console.error('Failed to parse booking.raw:', e);
        metadata = null;
      }
    }
    
    console.log('🔍 Booking verification:', {
      bookingId,
      status: booking.status,
      raw_type: typeof booking.raw,
      raw_value: booking.raw,
      metadata_source: metadata?.source,
      metadata_booking_type: metadata?.booking_type
    });
    
    if (metadata?.source !== 'staff_invitation' || booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending invitation bookings can be converted to credits',
        debug: {
          current_status: booking.status,
          metadata_source: metadata?.source,
          expected_status: 'pending',
          expected_source: 'staff_invitation'
        }
      });
    }

    // Calculate credits based on booking dates
    const checkIn = new Date(booking.check_in);
    const checkOut = new Date(booking.check_out);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    // Calculate credits using the service - needs season type
    const { default: SeasonalCalendar } = await import('../models/SeasonalCalendar');
    const seasonEntry = await SeasonalCalendar.findOne({
      where: {
        property_id: booking.property_id,
        start_date: { [Op.lte]: checkIn },
        end_date: { [Op.gte]: checkIn }
      }
    });
    const seasonType = seasonEntry?.season_type || 'WHITE';

    const creditResult = await CreditCalculationService.calculateBookingCost(
      booking.property_id,
      booking.room_type,
      seasonType,
      nights
    );

    const credits = creditResult.totalCredits; // Ya incluye nights en el cálculo

    // Get or create credit wallet
    let wallet = await UserCreditWallet.findOne({ where: { user_id: userId } });
    if (!wallet) {
      wallet = await UserCreditWallet.create({
        user_id: userId,
        total_balance: 0,
        total_earned: 0,
        total_spent: 0,
        total_expired: 0,
        pending_expiration: 0
      });
    }

    // Add credits to wallet
    const newBalance = parseFloat(wallet.total_balance.toString()) + credits;
    await wallet.update({ 
      total_balance: newBalance,
      total_earned: parseFloat(wallet.total_earned.toString()) + credits 
    });

    // Create credit transaction
    await CreditTransaction.create({
      user_id: userId,
      transaction_type: 'DEPOSIT',
      amount: credits,
      balance_after: newBalance,
      status: 'ACTIVE',
      booking_id: booking.id,
      description: `Converted invitation booking to credits (${nights} nights at ${booking.room_type})`,
      deposited_at: new Date()
    });

    // Cancel the booking
    await booking.update({ status: 'cancelled' });

    console.log('✅ Booking converted to credits:', {
      booking_id: booking.id,
      credits_added: credits,
      new_balance: newBalance,
      user_id: userId
    });

    return res.json({
      success: true,
      message: `Booking converted to ${credits} credits successfully`,
      data: {
        credits_added: credits,
        new_balance: newBalance,
      },
    });
  } catch (error: any) {
    console.error('Error converting booking to credits:', error);
    return res.status(500).json({
      success: false,
      message: 'Error converting booking to credits',
      error: error.message,
    });
  }
});

// Public routes (no authentication required)
export const publicInvitationRoutes = Router();

// Validate invitation token for registration page (public - no auth required)
publicInvitationRoutes.get('/validate-token', async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Token is required',
      });
    }

    const { Op } = await import('sequelize');
    const invitation = await OwnerInvitation.findOne({
      where: {
        token,
        status: 'pending',
        expires_at: { [Op.gt]: new Date() }
      },
      include: [
        {
          model: Property,
          as: 'property',
          attributes: ['id', 'name', 'location', 'tier'],
        }
      ],
    });

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired invitation token',
      });
    }

    // Parse rooms_data if it's a string
    let roomsData = invitation.rooms_data;
    if (typeof roomsData === 'string') {
      roomsData = JSON.parse(roomsData);
    }

    // Import necessary services
    const { default: SeasonalCalendar } = await import('../models/SeasonalCalendar');

    // Calculate estimated credits for each room using REAL Master Formula
    const roomsWithEstimates = await Promise.all(roomsData.map(async (room: any) => {
      const startDate = new Date(room.start_date);
      const endDate = new Date(room.end_date);
      const nights = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Auto-detect season type
      let seasonType: 'RED' | 'WHITE' | 'BLUE' = 'WHITE';
      try {
        seasonType = await SeasonalCalendar.getSeasonForDateWithDefault(invitation.property_id, startDate);
      } catch (error) {
        console.error('Error detecting season, using WHITE fallback:', error);
      }

      // Use Master Formula to estimate credits
      let estimatedCredits = nights;
      try {
        const estimate = await CreditCalculationService.estimateCreditsForWeek(
          invitation.property_id,
          room.room_type,
          seasonType
        );
        estimatedCredits = estimate.estimatedCredits;
        
        console.log(`💡 Credit estimate for room:`, {
          room_type: room.room_type,
          season: seasonType,
          nights,
          credits: estimatedCredits,
          formula: `${estimate.breakdown.baseValue} × ${estimate.breakdown.tierMultiplier} × ${estimate.breakdown.locationMultiplier} × ${estimate.breakdown.roomTypeMultiplier} = ${estimatedCredits}`
        });
      } catch (error) {
        console.error('Error estimating credits, using fallback:', error);
      }

      return {
        ...room,
        nights,
        season_type: seasonType,
        estimated_credits: estimatedCredits
      };
    }));

    const totalNights = roomsWithEstimates.reduce((sum: number, room: any) => sum + room.nights, 0);
    const totalEstimatedCredits = roomsWithEstimates.reduce((sum: number, room: any) => sum + room.estimated_credits, 0);

    return res.json({
      success: true,
      data: {
        invitation: {
          email: invitation.email,
          first_name: invitation.first_name,
          last_name: invitation.last_name,
          property: invitation.property,
          rooms: roomsWithEstimates,
          total_nights: totalNights,
          total_estimated_credits: totalEstimatedCredits,
          expires_at: invitation.expires_at,
        }
      },
    });
  } catch (error: any) {
    console.error('Error validating invitation token:', error);
    return res.status(500).json({
      success: false,
      message: 'Error validating invitation token',
      error: error.message,
    });
  }
});

// Validate invitation token (public - no auth required)
publicInvitationRoutes.get('/invitation/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    console.log('🔍 Validating invitation token:', token);

    const invitation = await OwnerInvitation.findOne({
      where: { token },
      include: [
        {
          model: Property,
          as: 'property',
          attributes: ['id', 'name', 'location'],
        },
      ],
    });

    if (!invitation) {
      console.log('❌ Invitation not found for token:', token);
      return res.status(404).json({
        success: false,
        message: 'Invitation not found',
      });
    }

    console.log('📋 Invitation found:', {
      status: invitation.status,
      expires_at: invitation.expires_at,
      is_valid: invitation.isValid()
    });

    if (!invitation.isValid()) {
      console.log('❌ Invitation is not valid:', {
        status: invitation.status,
        expires_at: invitation.expires_at,
        now: new Date()
      });
      return res.status(400).json({
        success: false,
        message: invitation.status === 'expired' ? 'Invitation has expired' : 'Invitation is no longer valid',
        data: { status: invitation.status },
      });
    }

    return res.json({
      success: true,
      data: {
        email: invitation.email,
        first_name: invitation.first_name,
        last_name: invitation.last_name,
        property: invitation.property,
        rooms_count: invitation.rooms_data.length,
        rooms_data: invitation.rooms_data,
        expires_at: invitation.expires_at,
      },
    });
  } catch (error: any) {
    console.error('Error fetching invitation:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching invitation',
      error: error.message,
    });
  }
});

/* DEPRECATED: These endpoints were for the old flow where invitation acceptance 
   happened AFTER registration. The new flow processes everything during registration.
   Keeping them commented for reference but they are no longer used.

// NEW: Owner accepts invitation AFTER registration and login
// This replaces the old auto-acceptance during registration
router.post(
  '/owner/accept-invitation',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const transaction = await sequelize.transaction();

    try {
      const { acceptance_type } = req.body; // 'booking' or 'credits'
      const userId = req.user?.id;

      if (!userId) {
        await transaction.rollback();
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
      }

      // Validate acceptance_type
      if (!acceptance_type || !['booking', 'credits'].includes(acceptance_type)) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'acceptance_type must be either "booking" or "credits"',
        });
      }

      // Get user with pending invitation token
      const user = await User.findByPk(userId, { transaction });
      if (!user) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Get invitation token from user's metadata
      let userRaw = user.metadata;
      if (typeof userRaw === 'string') {
        try {
          userRaw = JSON.parse(userRaw);
        } catch (e) {
          userRaw = {};
        }
      }

      const invitationToken = (userRaw as any)?.pending_invitation_token;
      if (!invitationToken) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'No pending invitation found for this user',
        });
      }

      // Find the invitation
      const invitation = await OwnerInvitation.findOne({
        where: {
          token: invitationToken,
          status: 'pending',
          expires_at: { [Op.gt]: new Date() },
        },
        include: [{ model: Property, as: 'property' }],
        transaction,
      });

      if (!invitation) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Invitation not found or expired',
        });
      }

      // Verify email matches
      if (invitation.email !== user.email) {
        await transaction.rollback();
        return res.status(403).json({
          success: false,
          message: 'This invitation was not sent to your email',
        });
      }

      // Parse rooms_data
      const roomsData = typeof invitation.rooms_data === 'string' 
        ? JSON.parse(invitation.rooms_data) 
        : invitation.rooms_data;

      let result: any = {};

      // Process based on acceptance type
      if (acceptance_type === 'booking') {
        // Create bookings (owner wants to use the specific dates)
        const { default: Booking } = await import('../models/Booking');
        const bookings = [];

        for (const roomData of roomsData) {
          const booking = await Booking.create({
            property_id: invitation.property_id,
            room_id: roomData.room_id,
            guest_name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            guest_email: user.email,
            guest_phone: user.phone || null,
            check_in: new Date(roomData.start_date),
            check_out: new Date(roomData.end_date),
            room_type: roomData.room_type,
            status: 'pending_approval', // Staff must approve
            guest_token: `owner-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            total_amount: 0,
            currency: 'EUR',
            payment_status: 'completed',
            pms_transfer_status: 'pending',
            raw: {
              source: 'owner_invitation_acceptance',
              booking_type: 'owner_invitation',
              user_id: user.id,
              invitation_id: invitation.id,
              estimated_credits: roomData.estimated_credits,
              season_type: roomData.season_type,
              acceptance_type: 'booking',
              accepted_at: new Date()
            }
          }, { transaction });

          bookings.push(booking);
        }

        result = {
          acceptance_type: 'booking',
          bookings: bookings.map(b => ({
            id: b.id,
            room_id: b.room_id,
            check_in: b.check_in,
            check_out: b.check_out,
            status: b.status
          })),
          message: 'Bookings created successfully. Waiting for staff approval.'
        };

        console.log('📅 Owner accepted invitation as BOOKING:', bookings.length, 'bookings created');

      } else if (acceptance_type === 'credits') {
        // Convert to credits (owner doesn't want specific dates)
        const weeks = [];
        const credits = [];

        for (const roomData of roomsData) {
          const startDate = new Date(roomData.start_date);
          const endDate = new Date(roomData.end_date);
          const nights = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

          // Determine season type
          const SeasonalCalendar = (await import('../models/SeasonalCalendar')).default;
          const seasonEntry = await SeasonalCalendar.findOne({
            where: {
              property_id: invitation.property_id,
              start_date: { [Op.lte]: startDate },
              end_date: { [Op.gte]: startDate }
            },
            transaction
          });
          
          const seasonType = seasonEntry?.season_type || roomData.season_type || 'medium';

          // Create Week record first
          const week = await Week.create({
            owner_id: user.id,
            property_id: invitation.property_id,
            start_date: startDate,
            end_date: endDate,
            nights: nights,
            accommodation_type: roomData.room_type,
            season_type: seasonType as 'RED' | 'WHITE' | 'BLUE',
            status: 'converted'
          }, { transaction });

          weeks.push(week);

          // Calculate credits using Master Formula
          const creditResult = await CreditCalculationService.calculateDepositCredits(week.id);

          // Create NightCredit record
          const expiryDate = new Date();
          expiryDate.setMonth(expiryDate.getMonth() + 18); // 18 months expiry

          const nightCredit = await NightCredit.create({
            owner_id: user.id,
            original_week_id: week.id,
            total_nights: creditResult.credits,
            remaining_nights: creditResult.credits,
            expiry_date: expiryDate,
            status: 'active',
            property_id: invitation.property_id,
            used_nights: 0,
            last_used_date: null
          }, { transaction });

          credits.push(nightCredit);
        }

        const totalCredits = credits.reduce((sum, c) => sum + c.total_nights, 0);

        result = {
          acceptance_type: 'credits',
          total_credits: totalCredits,
          weeks: weeks.length,
          credits: credits.map(c => ({
            id: c.id,
            nights: c.total_nights,
            expiry_date: c.expiry_date,
            status: c.status
          })),
          message: `Successfully converted invitation to ${totalCredits} night credits`
        };

        console.log('💰 Owner accepted invitation as CREDITS:', totalCredits, 'credits created');
      }

      // Mark invitation as accepted with acceptance type
      await invitation.update({
        status: 'accepted',
        created_user_id: user.id,
        accepted_at: new Date(),
        metadata: {
          ...(typeof invitation.metadata === 'string' ? JSON.parse(invitation.metadata) : invitation.metadata || {}),
          acceptance_type,
          accepted_at: new Date()
        }
      }, { transaction });

      // Remove pending invitation token from user
      const updatedRaw = { ...(userRaw as any) };
      delete updatedRaw.pending_invitation_token;
      updatedRaw.invitation_accepted_at = new Date();
      updatedRaw.invitation_acceptance_type = acceptance_type;
      
      await user.update({ metadata: updatedRaw }, { transaction });

      // TODO: Send notification to staff about owner's decision

      await transaction.commit();

      return res.json({
        success: true,
        data: result
      });

    } catch (error: any) {
      await transaction.rollback();
      console.error('❌ Error accepting invitation:', error);
      return res.status(500).json({
        success: false,
        message: 'Error accepting invitation',
        error: error.message,
      });
    }
  }
);

// Get pending invitation details for logged-in owner
router.get(
  '/owner/pending-invitation',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
      }

      // Get user with pending invitation token
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Get invitation token from user's metadata
      let userRaw = user.metadata;
      if (typeof userRaw === 'string') {
        try {
          userRaw = JSON.parse(userRaw);
        } catch (e) {
          userRaw = {};
        }
      }

      const invitationToken = (userRaw as any)?.pending_invitation_token;
      if (!invitationToken) {
        return res.json({
          success: true,
          data: null,
          message: 'No pending invitation found'
        });
      }

      // Find the invitation
      const invitation = await OwnerInvitation.findOne({
        where: {
          token: invitationToken,
          status: 'pending',
          expires_at: { [Op.gt]: new Date() },
        },
        include: [{ model: Property, as: 'property' }],
      });

      if (!invitation) {
        return res.json({
          success: true,
          data: null,
          message: 'Invitation not found or expired'
        });
      }

      // Calculate estimated credits for each room
      const roomsData = typeof invitation.rooms_data === 'string' 
        ? JSON.parse(invitation.rooms_data) 
        : invitation.rooms_data;

      const enrichedRoomsData = await Promise.all(roomsData.map(async (room: any) => {
        const startDate = new Date(room.start_date);
        const endDate = new Date(room.end_date);
        const nights = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Simple estimation - we can't call calculateDepositCredits without a week ID
        // So we'll use a simplified calculation based on nights
        // The actual credits will be calculated when the week is created
        const estimatedCredits = nights; // Simplificado - será más preciso al crear el week

        return {
          ...room,
          nights,
          estimated_credits: estimatedCredits
        };
      }));

      const totalEstimatedCredits = enrichedRoomsData.reduce((sum: number, r: any) => sum + r.estimated_credits, 0);

      return res.json({
        success: true,
        data: {
          invitation_id: invitation.id,
          property: invitation.property,
          rooms_data: enrichedRoomsData,
          total_rooms: enrichedRoomsData.length,
          total_estimated_credits: totalEstimatedCredits,
          expires_at: invitation.expires_at,
          email: invitation.email,
          first_name: invitation.first_name,
          last_name: invitation.last_name
        }
      });

    } catch (error: any) {
      console.error('❌ Error fetching pending invitation:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching pending invitation',
        error: error.message,
      });
    }
  }
);
*/

export default router;
