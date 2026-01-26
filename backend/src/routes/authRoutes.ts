import { Router, Request, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { User, Role } from '../models';
import { authenticateToken } from '../middleware/authMiddleware';
import LoggingService from '../services/loggingService';
import emailService from '../services/emailService';
import { validateRegistration, validateLogin, validateRequest } from '../middleware/securityMiddleware';

interface AuthRequest extends Request {
  user?: User;
}

const router = Router();

// Register
router.post('/register', validateRegistration, validateRequest, async (req: Request, res: Response) => {
  try {
    const { 
      email, 
      password, 
      roleName,
      firstName,
      lastName,
      phone,
      address,
      // Datos del hotel seleccionado del PMS
      pms_property_id,
      property_data, // Datos del hotel obtenidos del PMS
      // Token de invitación para owners
      invitationToken
    } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Validar rol: guest, staff y owner pueden registrarse
    // Admin solo puede ser creado por otro admin
    // Owner puede registrarse directamente desde invitaciones
    const allowedInitialRoles = ['guest', 'staff', 'owner'];
    const requestedRole = roleName || 'guest';
    
    if (!allowedInitialRoles.includes(requestedRole)) {
      const errorMessages: Record<string, string> = {
        'admin': 'Cannot register as admin publicly. Admin accounts can only be created by existing administrators.'
      };
      
      return res.status(400).json({ 
        error: errorMessages[requestedRole] || 'Invalid role',
        allowedRoles: allowedInitialRoles,
        hint: requestedRole === 'admin' ? 'Contact an existing administrator to create your admin account.' : undefined
      });
    }

    let role = await Role.findOne({ where: { name: requestedRole } });
    if (!role) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    let propertyId = null;
    let userStatus: 'pending' | 'approved' = 'approved';
    
    if (role.name === 'staff') {
      // Staff DEBE registrarse con un hotel del PMS de la plataforma
      if (!pms_property_id) {
        return res.status(400).json({ 
          error: 'Property ID from PMS is required for staff registration',
          hint: 'Use /hotels/pms-search/properties to find your hotel'
        });
      }

      // Validar que el property_data tenga los campos mínimos
      if (!property_data || !property_data.name) {
        return res.status(400).json({ 
          error: 'Property data from PMS is required',
          hint: 'Use /hotels/pms-search/validate-property to get property details'
        });
      }

      // Obtener credenciales de la plataforma (no del usuario)
      const pms_provider = (process.env.PMS_PROVIDER || 'mews') as 'mews' | 'cloudbeds' | 'resnexus' | 'opera' | 'none';
      const pms_credentials = {
        clientToken: process.env.MEWS_CLIENT_ID,
        accessToken: process.env.MEWS_CLIENT_SECRET
      };

      // Obtener configuración de auto-aprobación
      const { default: PlatformSetting } = await import('../models/PlatformSetting');
      const autoApprovalSetting = await PlatformSetting.findOne({ 
        where: { setting_key: 'staff_auto_approval_mode' } 
      });
      const autoApprovalMode = (autoApprovalSetting && (autoApprovalSetting as any).setting_value) 
        ? (autoApprovalSetting as any).setting_value 
        : 'none'; // 'none', 'first', 'all'

      // Verificar si el hotel ya está registrado
      let property = await (await import('../models')).Property.findOne({ 
        where: { 
          pms_provider,
          pms_property_id 
        } 
      });

      if (property) {
        // Hotel ya existe, determinar si auto-aprobar
        propertyId = property.id;
        
        // Verificar si hay staff aprobado existente para este hotel
        const existingStaff = await User.findOne({
          where: {
            property_id: propertyId,
            role_id: role.id,
            status: 'approved'
          }
        });

        if (autoApprovalMode === 'all') {
          // Auto-aprobar todos los staff
          userStatus = 'approved';
        } else if (autoApprovalMode === 'first' && !existingStaff) {
          // Auto-aprobar solo el primero
          userStatus = 'approved';
        } else {
          // Requiere aprobación manual
          userStatus = 'pending';
        }
      } else {
        // Crear nueva property con datos del PMS y credenciales de la plataforma
        const { encryptPMSCredentials } = await import('../utils/pmsEncryption');
        const encryptedCredentials = encryptPMSCredentials(pms_credentials);

        property = await (await import('../models')).Property.create({ 
          name: property_data.name,
          location: `${property_data.city}, ${property_data.country}`,
          description: property_data.description || null,
          city: property_data.city,
          country: property_data.country,
          address: property_data.address || null,
          timezone: property_data.timezone || 'UTC',
          pms_provider,
          pms_property_id,
          pms_credentials: encryptedCredentials,
          pms_sync_enabled: true,
          pms_sync_status: 'never',
          pms_verified: false, // Admin debe verificar
          status: 'pending_verification',
          commission_percentage: 10.00,
          check_in_time: '15:00:00',
          check_out_time: '11:00:00',
          // Auto-populate marketplace fields from PMS data if available
          marketplace_description: property_data.description || null,
          marketplace_images: property_data.images || null,
          marketplace_amenities: property_data.amenities || null,
          // Keep marketplace disabled by default - staff must activate manually
          is_marketplace_enabled: false,
          // Credit valuation defaults
          tier: 'STANDARD',
          location_multiplier: 1.00
        });

        propertyId = property.id;
        
        // Primera vez registrando este hotel
        if (autoApprovalMode === 'all' || autoApprovalMode === 'first') {
          // Auto-aprobar (es el primero por defecto)
          userStatus = 'approved';
        } else {
          // Requiere aprobación manual
          userStatus = 'pending';
        }
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      email,
      password: hashedPassword,
      role_id: role.id,
      property_id: propertyId,
      status: userStatus,
      firstName: firstName || null,
      lastName: lastName || null,
      phone: phone || null,
      address: address || null
    });

    // Log successful registration
    await LoggingService.logRegistration(user.id, req);

    // If owner is registering with an invitation token, process the invitation
    let invitationResult: any = null;
    if (invitationToken && role.name === 'owner') {
      try {
        const { OwnerInvitation, Week, NightCredit, Booking } = await import('../models');
        const { default: CreditCalculationService } = await import('../services/CreditCalculationService');
        const { default: SeasonalCalendar } = await import('../models/SeasonalCalendar');
        const { Op } = await import('sequelize');
        
        // Find the invitation
        const invitation = await OwnerInvitation.findOne({
          where: {
            token: invitationToken,
            status: 'pending',
            expires_at: { [Op.gt]: new Date() }
          }
        });

        if (!invitation) {
          console.log('⚠️ Invalid invitation token:', invitationToken);
          return res.status(400).json({ 
            error: 'Invalid or expired invitation token' 
          });
        }

        // Compare emails case-insensitively (validation middleware lowercases email)
        const invitationEmail = ((invitation as any).email || '').toLowerCase().trim();
        const requestEmail = (email || '').toLowerCase().trim();
        
        console.log('📧 Email validation:', {
          invitation_email: (invitation as any).email,
          request_email: email,
          normalized_match: invitationEmail === requestEmail
        });

        if (invitationEmail !== requestEmail) {
          console.log('⚠️ Email mismatch with invitation');
          return res.status(400).json({ 
            error: 'Email does not match invitation',
            debug: {
              invitation_email: (invitation as any).email,
              request_email: email
            }
          });
        }

        // Get acceptance_type from request
        const { acceptance_type } = req.body;

        if (!acceptance_type || !['booking', 'credits'].includes(acceptance_type)) {
          console.log('⚠️ Missing or invalid acceptance_type');
          return res.status(400).json({ 
            error: 'acceptance_type is required (must be "booking" or "credits")' 
          });
        }

        console.log(`✅ Processing invitation with acceptance_type: ${acceptance_type}`);

        // Parse rooms_data if it's a string
        let roomsData = (invitation as any).rooms_data;
        if (typeof roomsData === 'string') {
          roomsData = JSON.parse(roomsData);
        }

        if (acceptance_type === 'booking') {
          // FLOW A: Create Bookings - Automatically confirmed since staff already approved these dates
          const createdBookings = [];
          
          for (const roomData of roomsData) {
            const guestToken = `owner-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            
            const booking = await Booking.create({
              property_id: (invitation as any).property_id,
              room_id: roomData.room_id,
              guest_name: `${firstName || ''} ${lastName || ''}`.trim() || email,
              guest_email: email,
              guest_phone: phone || null,
              check_in: new Date(roomData.start_date),
              check_out: new Date(roomData.end_date),
              room_type: roomData.room_type || 'standard',
              status: 'confirmed', // Automatically confirmed since staff already approved these dates
              guest_token: guestToken,
              total_amount: 0,
              currency: 'EUR',
              payment_status: 'completed',
              raw: {
                source: 'staff_invitation',
                booking_type: 'owner_invitation_auto_confirmed',
                user_id: user.id,
                invitation_id: (invitation as any).id
              }
            });
            
            createdBookings.push(booking);
          }

          invitationResult = {
            acceptance_type: 'booking',
            bookings_created: createdBookings.length,
            bookings: createdBookings.map((b: any) => ({
              id: b.id,
              check_in: b.check_in,
              check_out: b.check_out,
              status: b.status
            }))
          };

          console.log(`✅ Created ${createdBookings.length} booking(s) with status confirmed (auto-approved)`);

        } else if (acceptance_type === 'credits') {
          // FLOW B: Convert to Credits (using NEW system)
          const { default: UserCreditWallet } = await import('../models/UserCreditWallet');
          const { default: CreditTransaction } = await import('../models/CreditTransaction');
          
          const createdWeeks = [];
          const createdTransactions = [];
          let totalNights = 0;
          let totalCredits = 0;

          // Get or create wallet for user
          const wallet = await UserCreditWallet.getOrCreateWallet(user.id);

          for (const roomData of roomsData) {
            const startDate = new Date(roomData.start_date);
            const endDate = new Date(roomData.end_date);
            const nights = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

            if (nights < 1) {
              console.warn(`Invalid period: ${roomData.start_date} to ${roomData.end_date}`);
              continue;
            }

            // Auto-detect season type
            let seasonType: 'RED' | 'WHITE' | 'BLUE' = 'WHITE';
            try {
              seasonType = await SeasonalCalendar.getSeasonForDateWithDefault((invitation as any).property_id, startDate);
            } catch (error) {
              console.error('Error detecting season, using WHITE fallback:', error);
            }

            console.log('📦 Creating week record:', {
              owner_id: user.id,
              property_id: (invitation as any).property_id,
              room_type: roomData.room_type,
              season_type: seasonType,
              nights: nights
            });

            // Create week record
            const week = await Week.create({
              owner_id: user.id,
              property_id: (invitation as any).property_id,
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
            console.log(`✅ Week created with ID: ${week.id}`);

            // Calculate credits using Master Formula for BOOKING COST (not deposit!)
            let weekCredits = nights;
            let calculationBreakdown = null;
            
            console.log(`🧮 Calling CreditCalculationService.calculateBookingCost for ${nights} nights...`);
            
            try {
              const creditResult = await CreditCalculationService.calculateBookingCost(
                (invitation as any).property_id,
                roomData.room_type,
                seasonType,
                nights
              );
              weekCredits = creditResult.totalCredits;
              calculationBreakdown = creditResult.breakdown;
              
              console.log(`✅ Credits calculated for ${nights} nights:`, {
                credits_per_night: creditResult.creditsPerNight,
                total_credits: creditResult.totalCredits,
                formula: `${creditResult.breakdown.baseRate} × ${creditResult.breakdown.roomTypeMultiplier} × ${creditResult.breakdown.tierMultiplier} × ${creditResult.breakdown.locationMultiplier} × ${nights} nights = ${creditResult.totalCredits}`,
                breakdown: creditResult.breakdown
              });
              
              // Update week with calculation details
              await week.update({
                credits_generated: weekCredits,
                deposit_calculation: calculationBreakdown
              });
            } catch (error) {
              console.error('❌ CRITICAL ERROR calculating credits with Master Formula:', error);
              console.error('❌ Error details:', {
                message: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
                week_id: week.id,
                property_id: (invitation as any).property_id
              });
              console.warn(`⚠️ Using fallback: ${nights} credits (should be using Master Formula!)`);
            }

            // Calculate expiration date (6 months)
            const expiryDate = CreditCalculationService.calculateExpirationDate(new Date());

            console.log(`💳 Creating transaction: ${weekCredits} credits for user ${user.id}`);
            
            // Create credit transaction (DEPOSIT)
            const transaction = await CreditTransaction.create({
              user_id: user.id,
              transaction_type: 'DEPOSIT',
              amount: weekCredits,
              balance_after: parseFloat(wallet.total_balance.toString()) + weekCredits,
              status: 'ACTIVE',
              week_id: week.id,
              description: `Deposit from invitation: ${nights} nights at ${roomData.room_type}`,
              expires_at: expiryDate,
              deposited_at: new Date(),
              metadata: JSON.stringify({
                invitation_id: (invitation as any).id,
                property_id: (invitation as any).property_id,
                season_type: seasonType,
                nights: nights,
                room_type: roomData.room_type,
                calculation: calculationBreakdown
              })
            });

            console.log(`✅ Transaction created: ID ${transaction.id}, Amount: ${weekCredits}`);
            createdTransactions.push(transaction);
            
            // Update wallet balance
            const oldBalance = parseFloat(wallet.total_balance.toString());
            wallet.total_balance = oldBalance + weekCredits;
            wallet.total_earned = parseFloat(wallet.total_earned.toString()) + weekCredits;
            wallet.last_transaction_at = new Date();
            
            console.log(`💰 Wallet updated: ${oldBalance} → ${wallet.total_balance}`);
            
            totalNights += nights;
            totalCredits += weekCredits;
          }

          // Save wallet updates
          console.log(`💾 Saving wallet for user ${user.id}...`);
          await wallet.save();
          console.log(`✅ Wallet saved successfully. Final balance: ${wallet.total_balance}`);

          invitationResult = {
            acceptance_type: 'credits',
            weeks_created: createdWeeks.length,
            transactions_created: createdTransactions.length,
            total_nights: totalNights,
            total_credits: totalCredits,
            wallet_balance: parseFloat(wallet.total_balance.toString()),
            expiration_date: createdTransactions[0]?.expires_at
          };

          console.log(`✅ COMPLETED: Created ${totalCredits} credits for new owner using NEW system`);
          console.log(`📊 Summary:`, {
            user_id: user.id,
            weeks: createdWeeks.length,
            transactions: createdTransactions.length,
            total_credits: totalCredits,
            wallet_balance: parseFloat(wallet.total_balance.toString())
          });
        }

        // Mark invitation as accepted
        await invitation.update({
          status: 'accepted',
          acceptance_type: acceptance_type,
          accepted_at: new Date(),
          created_user_id: user.id,
        });

        console.log('✅ Invitation marked as accepted');

      } catch (invError) {
        console.error('❌ Failed to process invitation during registration:', invError);
        return res.status(500).json({ 
          error: 'Failed to process invitation',
          details: invError instanceof Error ? invError.message : 'Unknown error'
        });
      }
    }

    // Generate JWT token for the new user
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: role.name,
        status: user.status 
      },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    let message = userStatus === 'pending' 
      ? 'Registration submitted. Waiting for admin approval.'
      : 'User created successfully';

    // Add invitation-specific message
    if (invitationResult) {
      if (invitationResult.acceptance_type === 'booking') {
        message = `Account created successfully. ${invitationResult.bookings_created} booking(s) pending staff approval.`;
      } else if (invitationResult.acceptance_type === 'credits') {
        message = `Account created successfully. ${invitationResult.total_credits} credits added to your wallet.`;
      }
    }

    res.status(201).json({ 
      message, 
      token,
      invitation_result: invitationResult,
      user: {
        id: user.id,
        email: user.email,
        role: role.name,
        status: user.status,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        address: user.address
      },
      userId: user.id,
      status: userStatus,
      propertyId: propertyId
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', validateLogin, validateRequest, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    console.log('[LOGIN] Attempting login for:', email);

    const user = await User.findOne({ 
      where: { email }, 
      include: [
        {
          model: Role,
          as: 'Role'
        },
        {
          model: (await import('../models')).Property,
          as: 'Property',
          attributes: ['id', 'name', 'location', 'city', 'country'],
          required: false
        }
      ]
    });
    
    if (!user) {
      console.log('[LOGIN] User not found:', email);
      // Log failed login attempt
      await LoggingService.logFailedLogin(email, req);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('[LOGIN] User found, checking password...');
    console.log('[LOGIN] User role:', (user as any).Role?.name);
    console.log('[LOGIN] User status:', user.status);

    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      console.log('[LOGIN] Invalid password for:', email);
      // Log failed login attempt
      await LoggingService.logFailedLogin(email, req);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('[LOGIN] Password valid, generating token...');

    // Only reject accounts that are explicitly rejected
    if (user.status === 'rejected') {
      return res.status(403).json({ error: 'Account rejected. Please contact support.' });
    }

    // Allow login for pending accounts (they will be redirected to pending approval page)
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: (user as any).Role?.name,
        status: user.status,
        property_id: user.property_id
      },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    console.log('[LOGIN] Token generated successfully');

    // Log successful login
    await LoggingService.logLogin(user.id, req);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: (user as any).Role?.name,
        status: user.status,
        property_id: user.property_id,
        property: (user as any).Property || null,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        address: user.address
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  // Fetch latest user data with property info
  const user = await User.findByPk(req.user.id, {
    include: [
      {
        model: Role,
        as: 'Role',
        attributes: ['id', 'name']
      },
      {
        model: (await import('../models')).Property,
        as: 'Property',
        attributes: ['id', 'name', 'location', 'city', 'country'],
        required: false
      }
    ]
  });

  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  res.json({
    user: {
      id: user.id,
      email: user.email,
      role: (user as any).Role?.name,
      status: user.status,
      property_id: user.property_id,
      property: (user as any).Property || null,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      address: user.address
    }
  });
});

// Update user profile
router.put('/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    const { firstName, lastName, phone, address } = req.body;
    
    await User.update(
      {
        firstName: firstName || null,
        lastName: lastName || null,
        phone: phone || null,
        address: address || null
      },
      { where: { id: req.user.id } }
    );

    // Get updated user
    const updatedUser = await User.findByPk(req.user.id, {
      include: [{
        model: Role,
        as: 'Role',
        attributes: ['name']
      }]
    });

    res.json({
      success: true,
      user: {
        id: updatedUser!.id,
        email: updatedUser!.email,
        role: (updatedUser as any).Role?.name,
        status: updatedUser!.status,
        firstName: updatedUser!.firstName,
        lastName: updatedUser!.lastName,
        phone: updatedUser!.phone,
        address: updatedUser!.address
      }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Delete own account (user self-deletion)
router.delete('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const userId = req.user.id;

    // Log the deletion action before deleting
    await LoggingService.logAction({
      user_id: userId,
      action: 'delete_own_account',
      req,
      details: {
        email: req.user.email
      }
    });

    // Delete the user
    await User.destroy({ where: { id: userId } });

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findByPk(req.user!.id, {
      attributes: ['id', 'email', 'firstName', 'lastName', 'phone', 'address', 'property_id', 'status', 'stripe_customer_id'],
      include: [
        {
          model: Role,
          as: 'Role',
          attributes: ['id', 'name']
        },
        {
          model: (await import('../models')).Property,
          as: 'Property',
          attributes: ['id', 'name', 'location', 'city', 'country'],
          required: false // LEFT JOIN para permitir usuarios sin property
        }
      ]
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

/**
 * @route   PUT /api/auth/profile
 * @desc    Update current user profile
 * @access  Private
 */
router.put('/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { firstName, lastName, phone, address } = req.body;

    const user = await User.findByPk(req.user!.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update only allowed fields
    await user.update({
      firstName: firstName !== undefined ? firstName : user.firstName,
      lastName: lastName !== undefined ? lastName : user.lastName,
      phone: phone !== undefined ? phone : user.phone,
      address: address !== undefined ? address : user.address
    });

    await LoggingService.logAction({
      user_id: user.id,
      action: 'update_profile',
      req,
      details: {
        updatedFields: Object.keys(req.body)
      }
    });

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        address: user.address
      }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * @route   GET /api/auth/payment-methods
 * @desc    Get saved payment methods for current user
 * @access  Private
 */
router.get('/payment-methods', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { StripeService } = require('../services/stripeService');
    const stripeService = new StripeService();
    
    const paymentMethods = await stripeService.getPaymentMethods(req.user!.id);

    res.json({
      success: true,
      data: paymentMethods.map((pm: any) => ({
        id: pm.id,
        brand: pm.card?.brand,
        last4: pm.card?.last4,
        exp_month: pm.card?.exp_month,
        exp_year: pm.card?.exp_year
      }))
    });
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({ error: 'Failed to fetch payment methods' });
  }
});

/**
 * @route   POST /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post('/change-password', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    const user = await User.findByPk(req.user!.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    
    if (!isValidPassword) {
      await LoggingService.logAction({
        user_id: user.id,
        action: 'failed_password_change',
        req,
        details: { reason: 'invalid_current_password' }
      });
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash and update new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hashedPassword });

    await LoggingService.logAction({
      user_id: user.id,
      action: 'password_changed',
      req,
      details: { success: true }
    });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

/**
 * @route   GET /api/auth/sessions
 * @desc    Get active sessions / login history
 * @access  Private
 */
router.get('/sessions', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const { ActionLog } = await import('../models');
    
    // Get login history
    const { count, rows: sessions } = await ActionLog.findAndCountAll({
      where: {
        user_id: req.user!.id,
        action: 'login'
      },
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset,
      attributes: ['id', 'createdAt', 'ip_address', 'user_agent', 'details']
    });

    res.json({
      success: true,
      data: {
        sessions: sessions.map((session: any) => ({
          id: session.id,
          loginAt: session.createdAt,
          ipAddress: session.ip_address,
          userAgent: session.user_agent,
          location: session.details?.location || 'Unknown',
          device: parseUserAgent(session.user_agent)
        })),
        pagination: {
          total: count,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(count / Number(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

/**
 * @route   GET /api/auth/preferences
 * @desc    Get user notification preferences
 * @access  Private
 */
router.get('/preferences', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { UserPreference } = await import('../models');
    
    let preferences = await UserPreference.findOne({
      where: { user_id: req.user!.id }
    });

    // If no preferences exist, create default ones
    if (!preferences) {
      preferences = await UserPreference.create({
        user_id: req.user!.id,
        email_notifications: true,
        swap_notifications: true,
        booking_notifications: true,
        marketing_emails: false,
        credit_expiry_alerts: true,
        weekly_summary: true
      });
    }

    res.json({
      success: true,
      data: preferences
    });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

/**
 * @route   PUT /api/auth/preferences
 * @desc    Update user notification preferences
 * @access  Private
 */
router.put('/preferences', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const {
      email_notifications,
      swap_notifications,
      booking_notifications,
      marketing_emails,
      credit_expiry_alerts,
      weekly_summary
    } = req.body;

    const { UserPreference } = await import('../models');
    
    let preferences = await UserPreference.findOne({
      where: { user_id: req.user!.id }
    });

    if (!preferences) {
      preferences = await UserPreference.create({
        user_id: req.user!.id,
        email_notifications: email_notifications ?? true,
        swap_notifications: swap_notifications ?? true,
        booking_notifications: booking_notifications ?? true,
        marketing_emails: marketing_emails ?? false,
        credit_expiry_alerts: credit_expiry_alerts ?? true,
        weekly_summary: weekly_summary ?? true
      });
    } else {
      await preferences.update({
        email_notifications: email_notifications ?? preferences.email_notifications,
        swap_notifications: swap_notifications ?? preferences.swap_notifications,
        booking_notifications: booking_notifications ?? preferences.booking_notifications,
        marketing_emails: marketing_emails ?? preferences.marketing_emails,
        credit_expiry_alerts: credit_expiry_alerts ?? preferences.credit_expiry_alerts,
        weekly_summary: weekly_summary ?? preferences.weekly_summary
      });
    }

    await LoggingService.logAction({
      user_id: req.user!.id,
      action: 'update_preferences',
      req,
      details: { updatedFields: Object.keys(req.body) }
    });

    res.json({
      success: true,
      data: preferences
    });
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// Helper function to parse user agent
function parseUserAgent(userAgent: string): string {
  if (!userAgent) return 'Unknown Device';
  
  if (userAgent.includes('Mobile')) {
    if (userAgent.includes('iPhone')) return 'iPhone';
    if (userAgent.includes('Android')) return 'Android Phone';
    return 'Mobile Device';
  }
  
  if (userAgent.includes('iPad')) return 'iPad';
  if (userAgent.includes('Tablet')) return 'Tablet';
  
  if (userAgent.includes('Windows')) return 'Windows PC';
  if (userAgent.includes('Macintosh')) return 'Mac';
  if (userAgent.includes('Linux')) return 'Linux PC';
  
  return 'Desktop Browser';
}

// Forgot Password - Generate reset token and send email
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await User.findOne({ where: { email } });

    // Always return success even if user doesn't exist (security best practice)
    if (!user) {
      return res.json({ 
        message: 'If an account with that email exists, a password reset link has been sent.' 
      });
    }

    // Generate secure random token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    
    // Token expires in 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // Save hashed token to database
    await user.update({
      password_reset_token: hashedToken,
      password_reset_expires: expiresAt,
    });

    // Send password reset email
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
    
    const emailSent = await emailService.sendPasswordResetEmail(
      user.email,
      user.firstName ?? undefined,
      resetUrl
    );

    if (emailSent) {
      console.log('✅ Password reset email sent to:', user.email);
    } else {
      console.error('❌ Failed to send password reset email to:', user.email);
      // In development, log the URL for manual testing
      if (process.env.NODE_ENV === 'development') {
        console.log('Password reset URL (for testing):', resetUrl);
        console.log('Token expires at:', expiresAt);
      }
    }

    // Log the action
    await LoggingService.logAction({
      user_id: user.id,
      action: 'password_reset_requested',
      details: {
        ip: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        email_sent: emailSent
      }
    });

    res.json({ 
      message: 'If an account with that email exists, a password reset link has been sent.',
      // Include resetUrl in development only if email failed
      ...(process.env.NODE_ENV === 'development' && !emailSent && { resetUrl })
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

// Reset Password - Validate token and update password
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Hash the token to compare with database
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid token
    const user = await User.findOne({
      where: {
        password_reset_token: hashedToken,
      },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Check if token is expired
    if (user.password_reset_expires && new Date() > user.password_reset_expires) {
      return res.status(400).json({ error: 'Reset token has expired' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password and clear reset token
    await user.update({
      password: hashedPassword,
      password_reset_token: null,
      password_reset_expires: null,
    });

    // Log the action
    await LoggingService.logAction({
      user_id: user.id,
      action: 'password_reset_completed',
      details: {
        ip: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown'
      }
    });

    res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;