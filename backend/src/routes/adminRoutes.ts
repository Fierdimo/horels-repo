import { Router, Request, Response } from 'express';
import { Op } from 'sequelize';
import { ActionLog, User, Role, Property, Week } from '../models';
import PlatformSetting from '../models/PlatformSetting';
import { authenticateToken } from '../middleware/authMiddleware';
import { authorize } from '../middleware/authorizationMiddleware';
import { logAction } from '../middleware/loggingMiddleware';
import pricingService from '../services/pricingService';
import { checkAndConvertToOwner } from '../utils/roleConversion';

const router = Router();

// Get all users (admin only)
router.get('/users', authenticateToken, authorize(['view_users']), logAction('view_all_users'), async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 50, role, status, search } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const where: any = {};

    // Filter by role
    if (role && typeof role === 'string' && role !== 'all') {
      const roleName: string = role;
      const roleRecord = await Role.findOne({ where: { name: roleName } });
      if (roleRecord) {
        where.role_id = roleRecord.id;
      }
    }

    // Filter by status
    if (status && typeof status === 'string' && status !== 'all') {
      where.status = status;
    }

    // Search by email, first name, or last name
    if (search) {
      where[Op.or] = [
        { email: { [Op.like]: `%${search}%` } },
        { first_name: { [Op.like]: `%${search}%` } },
        { last_name: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows: users } = await User.findAndCountAll({
      where,
      include: [
        {
          model: Role,
          attributes: ['name']
        },
        {
          model: Property,
          attributes: ['name', 'location', 'city', 'country']
        }
      ],
      limit: Number(limit),
      offset,
      order: [['createdAt', 'DESC']],
      attributes: { exclude: ['password'] }
    });

    res.json({
      users,
      pagination: {
        total: count,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(count / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get action logs (admin only)
router.get('/logs', authenticateToken, authorize(['view_users']), logAction('view_logs'), async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 50, user_id, action, start_date, end_date } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const where: any = {};

    if (user_id) where.user_id = user_id;
    if (action) where.action = action;
    if (start_date || end_date) {
      where.createdAt = {};
      if (start_date) where.createdAt[Op.gte] = new Date(start_date as string);
      if (end_date) where.createdAt[Op.lte] = new Date(end_date as string);
    }

    const logs = await ActionLog.findAndCountAll({
      where,
      limit: Number(limit),
      offset,
      order: [['createdAt', 'DESC']],
      include: [{
        model: (await import('../models')).User,
        attributes: ['id', 'email'],
        required: false
      }]
    });

    res.json({
      logs: logs.rows,
      pagination: {
        total: logs.count,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(logs.count / Number(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Get log statistics
router.get('/logs/stats', authenticateToken, authorize(['view_users']), logAction('view_log_stats'), async (req: Request, res: Response) => {
  try {
    const { period = '7d' } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case '1d':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Get action counts
    const actionStats = await ActionLog.findAll({
      attributes: [
        'action',
        [ActionLog.sequelize!.fn('COUNT', ActionLog.sequelize!.col('id')), 'count']
      ],
      where: {
        createdAt: {
          [Op.gte]: startDate
        }
      },
      group: ['action'],
      order: [[ActionLog.sequelize!.fn('COUNT', ActionLog.sequelize!.col('id')), 'DESC']],
      raw: true
    });

    // Get daily activity
    const dailyStats = await ActionLog.findAll({
      attributes: [
        [ActionLog.sequelize!.fn('DATE', ActionLog.sequelize!.col('createdAt')), 'date'],
        [ActionLog.sequelize!.fn('COUNT', ActionLog.sequelize!.col('id')), 'count']
      ],
      where: {
        createdAt: {
          [Op.gte]: startDate
        }
      },
      group: [ActionLog.sequelize!.fn('DATE', ActionLog.sequelize!.col('createdAt'))],
      order: [[ActionLog.sequelize!.fn('DATE', ActionLog.sequelize!.col('createdAt')), 'ASC']],
      raw: true
    });

    res.json({
      period,
      actionStats,
      dailyStats
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch log statistics' });
  }
});

// Update user (admin only)
router.patch('/users/:userId', authenticateToken, authorize(['update_user']), logAction('update_user'), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { status, role, email, firstName, lastName, phone, address } = req.body;
    const currentUser = (req as any).user;

    console.log('PATCH /users/:userId - Request body:', req.body);
    console.log('PATCH /users/:userId - Extracted fields:', { status, role, email, firstName, lastName, phone, address });
    console.log('PATCH /users/:userId - firstName type:', typeof firstName, 'value:', firstName);
    console.log('PATCH /users/:userId - lastName type:', typeof lastName, 'value:', lastName);

    // Prevent admin from modifying themselves
    if (currentUser && currentUser.id === parseInt(userId)) {
      return res.status(400).json({ error: 'Cannot modify your own account. Use PUT /auth/profile instead' });
    }

    const userToUpdate = await User.findByPk(userId, {
      include: [{
        model: Role,
        attributes: ['name']
      }]
    });

    if (!userToUpdate) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Build update object
    const updates: any = {};
    
    if (status !== undefined) updates.status = status;
    if (email !== undefined) updates.email = email;
    if (firstName !== undefined) {
      console.log('Setting firstName to:', firstName);
      updates.firstName = firstName;
    }
    if (lastName !== undefined) {
      console.log('Setting lastName to:', lastName);
      updates.lastName = lastName;
    }
    if (phone !== undefined) updates.phone = phone;
    if (address !== undefined) updates.address = address;

    console.log('PATCH /users/:userId - Updates object before save:', updates);

    // Handle role change
    if (role !== undefined) {
      const roleRecord = await Role.findOne({ where: { name: role } });
      if (!roleRecord) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      updates.role_id = roleRecord.id;
    }

    // Update user
    await userToUpdate.update(updates);
    console.log('PATCH /users/:userId - User after update:', {
      id: userToUpdate.id,
      email: userToUpdate.email,
      firstName: userToUpdate.firstName,
      lastName: userToUpdate.lastName,
      phone: userToUpdate.phone
    });

    // Fetch updated user with relations
    const updatedUser = await User.findByPk(userId, {
      include: [
        {
          model: Role,
          attributes: ['name']
        },
        {
          model: Property,
          attributes: ['name', 'location', 'city', 'country']
        }
      ],
      attributes: { exclude: ['password'] }
    });

    res.json({
      message: 'User updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user by ID (admin only)
router.delete('/users/:userId', authenticateToken, authorize(['view_users']), logAction('delete_user'), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUser = (req as any).user;

    // Prevent admin from deleting themselves
    if (currentUser && currentUser.id === parseInt(userId)) {
      return res.status(400).json({ error: 'Cannot delete your own account. Use DELETE /auth/me instead' });
    }

    const { User } = await import('../models');
    const userToDelete = await User.findByPk(userId, {
      include: [{
        model: (await import('../models')).Role,
        attributes: ['name']
      }]
    });

    if (!userToDelete) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Store user info for logging before deletion
    const userEmail = userToDelete.email;
    const userRole = (userToDelete as any).Role?.name;

    // Delete the user
    await userToDelete.destroy();

    res.json({
      message: 'User deleted successfully',
      deletedUser: {
        id: userId,
        email: userEmail,
        role: userRole
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Create admin user (admin only)
router.post('/create-admin', authenticateToken, authorize(['create_user']), logAction('create_admin'), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const currentUser = (req as any).user;

    // Verify current user is admin
    if (currentUser.Role?.name !== 'admin') {
      return res.status(403).json({ error: 'Only administrators can create admin accounts' });
    }

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Get admin role
    const adminRole = await Role.findOne({ where: { name: 'admin' } });
    if (!adminRole) {
      return res.status(500).json({ error: 'Admin role not found in database' });
    }

    // Hash password and create admin user
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    const newAdmin = await User.create({
      email,
      password: hashedPassword,
      role_id: adminRole.id,
      status: 'approved'
    });

    // Log admin creation
    const LoggingService = (await import('../services/loggingService')).default;
    await LoggingService.logAction({
      user_id: currentUser.id,
      action: 'admin_created',
      details: `Created new admin account: ${email}`,
      req
    });

    res.status(201).json({
      message: 'Admin account created successfully',
      admin: {
        id: newAdmin.id,
        email: newAdmin.email,
        role: 'admin',
        status: 'approved'
      }
    });
  } catch (error) {
    console.error('Error creating admin:', error);
    res.status(500).json({ error: 'Failed to create admin account' });
  }
});

// Get pending staff requests for the user's hotel (staff/admin)
router.get('/staff-requests', authenticateToken, authorize(['view_users']), logAction('view_staff_requests'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const staffRole = await Role.findOne({ where: { name: 'staff' } });
    if (!staffRole) {
      return res.status(500).json({ error: 'Staff role not found' });
    }
    const where: any = { status: 'pending', role_id: staffRole.id };

    // If not admin, filter by property_id
    if (user.Role.name !== 'admin') {
      where.property_id = user.property_id;
    }

    const pendingUsers = await User.findAll({
      where,
      include: [{
        model: Role,
        attributes: ['name']
      }, {
        model: Property,
        attributes: ['name', 'location', 'city', 'country']
      }]
    });

    res.json({ requests: pendingUsers });
  } catch (error) {
    console.error('Error fetching staff requests:', error);
    res.status(500).json({ error: 'Failed to fetch staff requests' });
  }
});

// Approve or reject staff request (staff/admin)
router.post('/staff-requests/:userId', authenticateToken, authorize(['update_user']), logAction('manage_staff_request'), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { action } = req.body; // 'approve' or 'reject'
    const user = (req as any).user;

    const targetUser = await User.findByPk(userId, { include: Role });
    if (!targetUser || targetUser.status !== 'pending') {
      return res.status(404).json({ error: 'Pending user request not found' });
    }

    // Solo se pueden aprobar usuarios staff
    const targetRole = (targetUser as any).Role?.name;
    if (targetRole !== 'staff') {
      return res.status(400).json({ error: 'Only staff users can be approved through this endpoint' });
    }

    // Admin puede aprobar cualquier staff
    // Staff aprobado puede aprobar otros staff del mismo hotel
    const userRole = user.Role?.name || user.role;
    
    if (userRole === 'admin') {
      // Admin puede aprobar cualquier staff
    } else if (userRole === 'staff' && user.status === 'approved') {
      // Staff aprobado solo puede aprobar staff de su mismo hotel
      if (!user.property_id || user.property_id !== targetUser.property_id) {
        return res.status(403).json({ error: 'You can only manage staff requests for your own property' });
      }
    } else {
      return res.status(403).json({ error: 'Insufficient permissions to manage staff requests' });
    }

    if (action === 'approve') {
      await targetUser.update({ status: 'approved' });
    } else if (action === 'reject') {
      await targetUser.update({ status: 'rejected' });
    } else {
      return res.status(400).json({ error: 'Invalid action. Must be "approve" or "reject"' });
    }

    res.json({ 
      message: `Staff request ${action}d successfully`,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        status: targetUser.status
      }
    });
  } catch (error) {
    console.error('Staff request error:', error);
    res.status(500).json({ error: 'Failed to process staff request' });
  }
});

// Get staff auto-approval settings (admin only)
router.get('/settings/staff-auto-approval', authenticateToken, authorize(['manage_permissions']), logAction('view_staff_auto_approval_settings'), async (req: Request, res: Response) => {
  try {
    const { default: PlatformSetting } = await import('../models/PlatformSetting');
    
    const setting = await PlatformSetting.findOne({ 
      where: { key: 'staff_auto_approval_mode' } 
    });
    
    const mode = (setting && (setting as any).value) ? (setting as any).value : 'none'; // 'none', 'first', 'all'
    
    res.json({
      mode,
      description: {
        none: 'All staff require manual approval',
        first: 'First staff member of each property is auto-approved',
        all: 'All staff members are auto-approved'
      }
    });
  } catch (error) {
    console.error('Error fetching staff auto-approval settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update staff auto-approval settings (admin only)
router.put('/settings/staff-auto-approval', authenticateToken, authorize(['manage_permissions']), logAction('update_staff_auto_approval_settings'), async (req: Request, res: Response) => {
  try {
    const { mode } = req.body;
    const validModes = ['none', 'first', 'all'];
    
    if (!mode || !validModes.includes(mode)) {
      return res.status(400).json({ 
        error: 'Invalid mode. Must be one of: none, first, all',
        validModes
      });
    }
    
    const { default: PlatformSetting } = await import('../models/PlatformSetting');
    
    const [setting, created] = await PlatformSetting.findOrCreate({
      where: { key: 'staff_auto_approval_mode' },
      defaults: { key: 'staff_auto_approval_mode', value: mode }
    });
    
    if (!created) {
      await setting.update({ value: mode });
    }
    
    // Log the change
    const LoggingService = (await import('../services/loggingService')).default;
    await LoggingService.logAction({
      user_id: (req as any).user.id,
      action: 'staff_auto_approval_updated',
      details: `Changed staff auto-approval mode to: ${mode}`,
      req
    });
    
    const descriptions: Record<string, string> = {
      none: 'All staff require manual approval',
      first: 'First staff member of each property is auto-approved',
      all: 'All staff members are auto-approved'
    };
    
    res.json({
      message: 'Staff auto-approval settings updated successfully',
      mode,
      description: descriptions[mode] || descriptions.none
    });
  } catch (error) {
    console.error('Error updating staff auto-approval settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

/**
 * @route   GET /admin/settings/commission
 * @desc    Get current marketplace commission rate
 * @access  Admin only
 */
router.get('/settings/commission', authenticateToken, authorize(['manage_permissions']), logAction('view_commission_settings'), async (req: Request, res: Response) => {
  try {
    const commissionRate = await pricingService.getPlatformCommissionRate();
    
    // Ejemplo de cálculo
    const examplePrice = 100;
    const breakdown = await pricingService.getPriceBreakdown(examplePrice);

    res.json({
      success: true,
      data: {
        commissionRate,
        description: `La plataforma cobra ${commissionRate}% de comisión sobre el precio base`,
        example: {
          hotelPrice: examplePrice,
          ...breakdown
        }
      }
    });
  } catch (error) {
    console.error('Error fetching commission settings:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch commission settings' 
    });
  }
});

/**
 * @route   PATCH /admin/settings/commission
 * @desc    Update marketplace commission rate
 * @access  Admin only
 */
router.patch('/settings/commission', authenticateToken, authorize(['manage_permissions']), logAction('update_commission_settings'), async (req: Request, res: Response) => {
  try {
    const { rate } = req.body;

    if (rate === undefined || rate === null) {
      return res.status(400).json({
        success: false,
        error: 'Commission rate is required'
      });
    }

    const rateNum = parseFloat(rate);

    if (isNaN(rateNum) || rateNum < 0 || rateNum > 50) {
      return res.status(400).json({
        success: false,
        error: 'Commission rate must be between 0 and 50 percent'
      });
    }

    // Buscar o crear setting
    const [setting, created] = await PlatformSetting.findOrCreate({
      where: { key: 'marketplace_commission_rate' },
      defaults: { 
        key: 'marketplace_commission_rate',
        value: String(rateNum) 
      }
    });

    if (!created) {
      await setting.update({ value: String(rateNum) });
    }

    // Ejemplo de cálculo con nuevo rate
    const examplePrice = 100;
    const guestPrice = parseFloat((examplePrice * (1 + rateNum / 100)).toFixed(2));
    const commission = guestPrice - examplePrice;

    res.json({
      success: true,
      message: 'Commission rate updated successfully',
      data: {
        commissionRate: rateNum,
        description: `La plataforma ahora cobra ${rateNum}% de comisión`,
        example: {
          hotelPrice: examplePrice,
          commissionRate: rateNum,
          commission: parseFloat(commission.toFixed(2)),
          guestPrice,
          hotelPayout: examplePrice
        }
      }
    });
  } catch (error) {
    console.error('Error updating commission settings:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update commission settings' 
    });
  }
});

// Get owners list (staff/admin) - simplified endpoint for dropdowns
router.get('/owners', authenticateToken, authorize(['manage_users', 'manage_bookings']), logAction('view_owners_list'), async (req: Request, res: Response) => {
  try {
    const ownerRole = await Role.findOne({ where: { name: 'owner' } });
    
    if (!ownerRole) {
      return res.status(404).json({ 
        success: false,
        error: 'Owner role not found' 
      });
    }

    const owners = await User.findAll({
      where: { 
        role_id: ownerRole.id,
        status: 'active'
      },
      attributes: ['id', 'firstName', 'lastName', 'email'],
      order: [['firstName', 'ASC'], ['lastName', 'ASC']]
    });

    res.json({
      success: true,
      data: owners
    });
  } catch (error) {
    console.error('Error fetching owners:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch owners' 
    });
  }
});

// Assign period to owner (staff/admin)
router.post('/assign-period', authenticateToken, authorize(['manage_users', 'manage_bookings']), logAction('assign_period_to_owner'), async (req: Request, res: Response) => {
  try {
    const { owner_id, property_id, start_date, end_date, accommodation_type } = req.body;

    // Validate required fields
    if (!owner_id || !property_id || !start_date || !end_date || !accommodation_type) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields: owner_id, property_id, start_date, end_date, accommodation_type' 
      });
    }

    // Validate owner exists and is an owner role
    const owner = await User.findOne({
      where: { id: owner_id },
      include: [{ model: Role, where: { name: 'owner' } }]
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

    // Validate dates
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid date format' 
      });
    }

    if (startDate >= endDate) {
      return res.status(400).json({ 
        success: false,
        error: 'End date must be after start date' 
      });
    }

    const nights = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    if (nights < 1) {
      return res.status(400).json({ 
        success: false,
        error: 'Period must have at least 1 night' 
      });
    }

    // Create the week/period
    const week = await Week.create({
      owner_id,
      property_id,
      start_date: startDate,
      end_date: endDate,
      accommodation_type,
      status: 'available'
    });

    // Load relations
    await week.reload({
      include: [{ model: Property, attributes: ['name', 'location', 'city', 'country'] }]
    });

    // Auto-convert guest to owner if this is their first week
    await checkAndConvertToOwner(owner_id);

    res.json({
      success: true,
      message: `Period of ${nights} night(s) assigned successfully`,
      data: {
        week,
        nights,
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
});

export default router;