import express, { Request, Response, NextFunction } from 'express';
import authRoutes from './routes/authRoutes';
import adminRoutes from './routes/adminRoutes';
import roomRoutes from './routes/roomRoutes';
import pmsRoutes from './routes/pmsRoutes';
import stripeRoutes from './routes/stripeRoutes';
import conversionRoutes from './routes/conversionRoutes';
import clientRoutes from './routes/clientRoutes';
import timeshareRoutes from './routes/timeshareRoutes';
import swapRoutes from './routes/swapRoutes';
import staffSwapRoutes from './routes/staffSwapRoutes';
import paymentMethodRoutes from './routes/paymentMethodRoutes';
import ownerNightCreditRoutes from './routes/ownerNightCreditRoutes';
import staffNightCreditRoutes from './routes/staffNightCreditRoutes';
import hotelGuestRoutes from './routes/hotelGuestRoutes';
import hotelStaffRoutes from './routes/hotelStaffRoutes';
import propertyRoutes from './routes/property.routes';
import dashboardRoutes from './routes/dashboard.routes';
import publicRoutes from './routes/publicRoutes';
import pmsSearchRoutes from './routes/pmsSearch.routes';
import syncRoutes from './routes/sync.routes';
import mewsWebhooks from './routes/mewsWebhookRoute';
import webhookRoutes from './routes/webhookRoutes';
import healthRoutes from './routes/healthRoutes';
import settingsRoutes from './routes/settingsRoutes';
import creditRoutes from './routes/creditRoutes';
import creditAdminRoutes from './routes/creditAdminRoutes';
import adminCreditConfigRoutes from './routes/adminCreditConfigRoutes';
import creditEstimationRoutes from './routes/creditEstimationRoutes';
import invitationRoutes, { publicInvitationRoutes } from './routes/invitationRoutes';
import roomAvailabilityRoutes from './routes/roomAvailabilityRoutes';
import bookingRoutes from './routes/bookingRoutes';
import marketplaceRoutes from './routes/marketplaceRoutes';
import prepaidInventoryRoutes from './routes/prepaidInventoryRoutes';
import unifiedSearchRoutes from './routes/unifiedSearchRoutes';
import mockPMSRoutes from './routes/mockPMSRoutes';
import marketplaceV2Routes from './routes/marketplaceV2Routes';

// V2 Routes (New Architecture)
import weekReleaseRoutes from './routes/v2/weekReleaseRoutes';
import creditRoutesV2 from './routes/v2/creditRoutes';
import ownershipRoutes from './routes/v2/ownershipRoutes';
import searchRoutes from './routes/v2/searchRoutes';
import bookingRoutesV2 from './routes/v2/bookingRoutes';
import ownerRoutes from './routes/ownerRoutes';
import adminCreditConfigRoutesV2 from './routes/v2/adminCreditConfigRoutes';

// Admin Routes (Phase 7: Admin Tools)
import adminUnitsRoutes from './routes/admin/units';
import adminOwnershipsRoutes from './routes/admin/ownerships';
import adminUnitOwnershipsRoutes from './routes/admin/unit-ownerships';
import adminUserOwnershipsRoutes from './routes/admin/user-ownerships';
import adminPropertiesRoutes from './routes/admin/properties';
import adminOwnershipImportRoutes from './routes/admin/ownership-import';
import adminAllocationsRoutes from './routes/admin/allocations';

import { authenticateToken } from './middleware/authMiddleware';
import { authorize } from './middleware/authorizationMiddleware';
import { logAction } from './middleware/loggingMiddleware';
import {
  securityHeaders,
  corsOptions,
  apiLimiter,
  authLimiter,
  adminLimiter,
  sanitizeInput,
  dataMinimization
} from './middleware/securityMiddleware';
import {
  logFailedAuth,
  logSuspiciousActivity,
  validateApiKey,
  enforceHttps,
  addSecurityHeaders
} from './middleware/securityLogger';

// Initialize V2 Models
import sequelize from './config/database';
import { initV2Models } from './models/v2';
initV2Models(sequelize);

const app = express();

// IMPORTANT: Webhook routes MUST be registered BEFORE express.json() 
// because Stripe requires raw body for signature verification
app.use('/hotels/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

// Middleware
app.use(express.json({ limit: '10mb' })); // Limit JSON payload size
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Limit URL-encoded payload size

// Security middleware (applied in order)
app.use(securityHeaders); // Security headers
app.use(corsOptions); // CORS configuration
app.use(enforceHttps); // HTTPS enforcement in production
app.use(addSecurityHeaders); // Additional security headers
app.use(sanitizeInput); // Input sanitization
app.use(dataMinimization); // GDPR compliance
app.use(logSuspiciousActivity); // Log suspicious activities
app.use(apiLimiter); // General rate limiting

// Routes with specific rate limiting and security logging
app.use('/hotels/auth', authLimiter, logFailedAuth, authRoutes); // Stricter rate limiting for auth + failed auth logging
app.use('/hotels/admin', adminLimiter, adminRoutes); // Stricter rate limiting for admin
app.use('/hotels/admin/rooms', adminLimiter, roomRoutes); // Room management for admin
app.use('/hotels/staff/invitations/public', publicInvitationRoutes); // Public invitation routes (no auth required)
app.use('/hotels/staff/invitations', authenticateToken, invitationRoutes); // Staff owner invitations
app.use('/hotels/properties', authenticateToken, propertyRoutes); // Property management (admin + hotel staff)
app.use('/hotels/dashboard', authenticateToken, dashboardRoutes); // Dashboard with property filtering
app.use('/hotels/public', publicRoutes); // Public marketplace routes (no auth required)
app.use('/hotels/pms-search', pmsSearchRoutes); // PMS property search for registration (no auth required)
app.use('/hotels/sync', syncRoutes); // PMS sync worker control and logs
app.use('/hotels/pms', validateApiKey, pmsRoutes); // API key validation for PMS routes
app.use('/hotels/payments', stripeRoutes);
app.use('/hotels/conversion', conversionRoutes);
app.use('/hotels/api', clientRoutes);
app.use('/hotels/client', clientRoutes); // Client routes (profile, payments, etc.)
app.use('/hotels/timeshare', authenticateToken, timeshareRoutes); // Timeshare routes for owners
app.use('/hotels/owner/swaps', authenticateToken, swapRoutes); // Owner swap management
app.use('/hotels/staff/swaps', authenticateToken, staffSwapRoutes); // Staff swap approval
app.use('/hotels/payment-methods', authenticateToken, paymentMethodRoutes); // Payment method management
app.use('/hotels/owner', authenticateToken, ownerNightCreditRoutes); // Owner night credit requests
app.use('/hotels/staff', authenticateToken, staffNightCreditRoutes); // Staff night credit management
app.use('/hotels/hotel', hotelGuestRoutes); // Hotel guest routes (light access)
app.use('/hotels/hotel-staff', authenticateToken, hotelStaffRoutes); // Hotel staff routes
app.use('/hotels/settings', settingsRoutes); // Platform settings (admin only)
app.use('/hotels/credits', authenticateToken, creditRoutes); // Variable credit system (user)
app.use('/hotels/api/credits/admin', authenticateToken, creditAdminRoutes); // Credit admin configuration
app.use('/hotels/api/credits/estimate', authenticateToken, creditEstimationRoutes); // Credit estimation tools
app.use('/hotels/api/admin/credit-config', authenticateToken, adminCreditConfigRoutes); // Credit configuration panel (admin)
app.use('/hotels/api/rooms', roomAvailabilityRoutes); // Room availability with correct types from PMS
app.use('/hotels/api/bookings', authenticateToken, bookingRoutes); // User booking management (cancel, invoice, etc.)
app.use('/hotels/api/marketplace', authenticateToken, marketplaceRoutes); // Unified credit marketplace (release, search, book)
app.use('/hotels/admin/prepaid-inventory', prepaidInventoryRoutes); // Prepaid inventory management (admin/staff)
app.use('/hotels/api/unified-search', unifiedSearchRoutes); // Unified search with prepaid prioritization (public/authenticated)

// ============================================
// V2 API Routes (New Architecture)
// ============================================
app.use('/api/owner', authenticateToken, ownerRoutes); // Owner dashboard & weeks (V2)
app.use('/api/v2/weeks', authenticateToken, weekReleaseRoutes); // Week release operations (owner)
app.use('/api/v2/credits', authenticateToken, creditRoutesV2); // Credit account & transactions
app.use('/api/v2/ownerships', authenticateToken, ownershipRoutes); // Ownership management (admin/owner)
app.use('/api/v2/search', authenticateToken, searchRoutes); // Unified search (timeshare + hotels)
app.use('/api/v2/bookings', authenticateToken, bookingRoutesV2); // Booking management (create, view, cancel)

// ============================================
// Admin API Routes (Phase 7: Admin Tools)
// ============================================
app.use('/api/admin/credits', authenticateToken, adminCreditConfigRoutesV2); // Credit system configuration (V2)
app.use('/api/admin/properties', authenticateToken, adminPropertiesRoutes); // Property management with PMS
app.use('/api/admin/units', authenticateToken, adminUnitsRoutes); // Unit management (admin/staff)
app.use('/api/admin/ownerships', authenticateToken, adminOwnershipsRoutes); // Ownership management (admin/staff)
app.use('/api/admin/ownerships/import', authenticateToken, adminOwnershipImportRoutes); // CSV import
app.use('/api/admin/units', authenticateToken, adminUnitOwnershipsRoutes); // Unit-specific ownerships
app.use('/api/admin/users', authenticateToken, adminUserOwnershipsRoutes); // User-specific ownerships
app.use('/api/admin/allocations', authenticateToken, adminAllocationsRoutes); // Week allocation generation

// Public webhook endpoint for Mews
app.use('/hotels/webhooks/mews', mewsWebhooks);
app.use('/hotels', healthRoutes);

// ============================================
// Mock PMS API Routes (Development/Testing)
// ============================================
app.use('/hotels/api/mock-pms', mockPMSRoutes); // Mock PMS management endpoints

// ============================================
// Marketplace V2 Routes (Mock PMS Integration)
// ============================================
app.use('/hotels/api/marketplace', marketplaceV2Routes); // Marketplace with Mock PMS data

// Root route
app.get('/hotels', (req: Request, res: Response) => {
  res.json({ message: 'SW2 Backend API' });
});

// Protected route example
app.get('/hotels/admin', authenticateToken, authorize(['create_user']), logAction('admin_access'), (req: Request, res: Response) => {
  res.json({ message: 'Admin access granted' });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

export default app;