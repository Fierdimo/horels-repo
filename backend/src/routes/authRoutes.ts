import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Role } from '../models';
import { authenticateToken } from '../middleware/authMiddleware';
import LoggingService from '../services/loggingService';
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
      property_data // Datos del hotel obtenidos del PMS
    } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Validar rol: solo guest y staff pueden registrarse públicamente
    // Admin solo puede ser creado por otro admin
    // Owner se convierte automáticamente cuando recibe su primera semana
    const allowedInitialRoles = ['guest', 'staff'];
    const requestedRole = roleName || 'guest';
    
    if (!allowedInitialRoles.includes(requestedRole)) {
      const errorMessages: Record<string, string> = {
        'owner': 'Cannot register as owner. Users are automatically upgraded to owner when they receive their first timeshare week.',
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
        where: { key: 'staff_auto_approval_mode' } 
      });
      const autoApprovalMode = (autoApprovalSetting && (autoApprovalSetting as any).value) 
        ? (autoApprovalSetting as any).value 
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
          is_marketplace_enabled: false
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

    const message = userStatus === 'pending' 
      ? 'Registration submitted. Waiting for admin approval.'
      : 'User created successfully';

    res.status(201).json({ 
      message, 
      token,
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

    const user = await User.findOne({ where: { email }, include: Role });
    if (!user) {
      // Log failed login attempt
      await LoggingService.logFailedLogin(email, req);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      // Log failed login attempt
      await LoggingService.logFailedLogin(email, req);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

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
        status: user.status 
      },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    // Log successful login
    await LoggingService.logLogin(user.id, req);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: (user as any).Role?.name,
        status: user.status,
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

  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      role: (req.user as any).Role?.name,
      status: req.user.status,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      phone: req.user.phone,
      address: req.user.address
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
      attributes: ['id', 'email', 'firstName', 'lastName', 'phone', 'address', 'stripe_customer_id'],
      include: [
        {
          model: Role,
          as: 'Role',
          attributes: ['id', 'name']
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

export default router;