import { Router, Request, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { User, Role } from '../models';
import UserV2 from '../models/v2/User'; // V2 model with correct schema
import { authenticateToken } from '../middleware/authMiddleware';
import LoggingService from '../services/loggingService';
import emailService from '../services/emailService';
import { validateRegistration, validateLogin, validateRequest } from '../middleware/securityMiddleware';

interface AuthRequest extends Request {
  user?: any; // Can be User (V1) or UserV2 - using any to avoid type conflicts
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
      hotelName, // Added for staff registration
      hotelLocation, // Added for staff registration
      // Datos del hotel seleccionado del PMS
      pms_property_id,
      property_data, // Datos del hotel obtenidos del PMS
      // Token de invitación para owners
      invitationToken
    } = req.body;

    // V2: Check if user exists
    const existingUser = await UserV2.findOne({ where: { email } });
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

    let userStatus: 'approved' | 'pending' = 'approved'; // V2 uses 'approved' for active users
    let property_id: number | null = null;
    
    if (requestedRole === 'staff') {
      // Staff requires admin approval
      userStatus = 'pending';
      
      // If staff provided hotel name, find the property
      if (hotelName) {
        const Property = (await import('../models')).Property;
        const property = await Property.findOne({
          where: { name: hotelName }
        });
        
        if (property) {
          property_id = property.id;
          console.log(`[Register] Staff ${email} registered with property: ${hotelName} (ID: ${property_id})`);
        } else {
          console.log(`[Register] Staff ${email} registered, but property "${hotelName}" not found. Will need manual assignment.`);
        }
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await UserV2.create({
      email,
      password_hash: hashedPassword,
      role: requestedRole as 'guest' | 'staff' | 'owner' | 'admin',
      status: userStatus,
      property_id: property_id,
      first_name: firstName || '',
      last_name: lastName || '',
      phone: phone || null,
      email_verified: false
    });

    // Log successful registration
    await LoggingService.logRegistration(user.id, req);

    // Generate JWT token for the new user
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: requestedRole,
        status: user.status,
        property_id: user.property_id || null
      },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    const message = userStatus === 'pending' 
      ? 'Registration submitted. Waiting for admin approval.'
      : 'User created successfully';

    res.status(201).json({ 
      message, 
      token,
      user: {
        id: user.id,
        email: user.email,
        role: requestedRole,
        status: user.status,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone
      },
      userId: user.id,
      status: userStatus
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login (V2 - using new schema)
router.post('/login', validateLogin, validateRequest, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    console.log('[LOGIN] Attempting login for:', email);

    // Use V2 model with correct schema (password_hash, role enum)
    const user = await UserV2.findOne({ 
      where: { email }
    });
    
    if (!user) {
      console.log('[LOGIN] User not found:', email);
      // Log failed login attempt
      await LoggingService.logFailedLogin(email, req);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('[LOGIN] User found, checking password...');
    console.log('[LOGIN] User role:', user.role);
    console.log('[LOGIN] User status:', user.status);

    // Verify password (using password_hash field)
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      console.log('[LOGIN] Invalid password for:', email);
      // Log failed login attempt
      await LoggingService.logFailedLogin(email, req);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('[LOGIN] Password valid, generating token...');

    // Check if user is active
    if (user.status === 'rejected') {
      return res.status(403).json({ error: 'Account was rejected. Please contact support.' });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({ error: 'Account is inactive. Please contact support.' });
    }

    // Update last login
    await user.update({ last_login_at: new Date() });

    // Generate JWT token (role is directly in user table, no role_id)
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role, // enum: admin, owner, guest, staff
        status: user.status,
        property_id: user.property_id || null
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
        role: user.role,
        status: user.status,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        property_id: user.property_id || null,
        must_change_password: user.must_change_password || false
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user (V2)
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  // Fetch latest user data with V2 model
  const user = await UserV2.findByPk(req.user.id);

  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  res.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone
    }
  });
});

// REMOVED - OLD V1 ENDPOINT - Use endpoint at line ~334 instead
// Update user profile
// router.put('/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
//   [OLD CODE REMOVED]
// });

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
      attributes: ['id', 'email', 'first_name', 'last_name', 'phone', 'role', 'status', 'stripe_customer_id']
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
    const { firstName, lastName, phone } = req.body;

    const user = await User.findByPk(req.user!.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update only allowed fields
    await user.update({
      first_name: firstName !== undefined ? firstName : user.first_name,
      last_name: lastName !== undefined ? lastName : user.last_name,
      phone: phone !== undefined ? phone : user.phone
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
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone
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
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    
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
    await user.update({ password_hash: hashedPassword });

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
      user.first_name ?? undefined,
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
      password_hash: hashedPassword,
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

// Change temporary password (authenticated endpoint)
router.post('/change-temporary-password', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate inputs
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    // Get user
    const user = await UserV2.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and reset flag
    await user.update({
      password_hash: hashedPassword,
      must_change_password: false
    });

    // Log the action
    await LoggingService.logAction({
      user_id: user.id,
      action: 'temporary_password_changed',
      details: {
        ip: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown'
      }
    });

    res.json({ 
      message: 'Password changed successfully',
      user: {
        id: user.id,
        email: user.email,
        must_change_password: false
      }
    });
  } catch (error) {
    console.error('Change temporary password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

/**
 * Complete invitation - Set password for new owner
 */
router.post('/complete-invitation', async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        error: 'Token and password are required'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long'
      });
    }

    // Verify JWT token
    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired invitation token'
      });
    }

    if (decoded.type !== 'ownership_invitation') {
      return res.status(401).json({
        success: false,
        error: 'Invalid invitation type'
      });
    }

    // Get user
    const user = await User.findByPk(decoded.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user password and mark as no longer needing password change
    await user.update({
      password_hash: hashedPassword,
      must_change_password: false
    });

    // Generate new session token
    const sessionToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Account activated successfully',
      token: sessionToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        first_name: (user as any).first_name,
        last_name: (user as any).last_name
      }
    });
  } catch (error: any) {
    console.error('Error completing invitation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete invitation',
      message: error.message
    });
  }
});

export default router;