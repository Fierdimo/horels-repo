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
app.use('/hotels/properties', authenticateToken, propertyRoutes); // Property management (admin + hotel staff)
app.use('/hotels/dashboard', authenticateToken, dashboardRoutes); // Dashboard with property filtering
app.use('/hotels/public', publicRoutes); // Public marketplace routes (no auth required)
app.use('/hotels/pms-search', pmsSearchRoutes); // PMS property search for registration (no auth required)
app.use('/hotels/sync', syncRoutes); // PMS sync worker control and logs
app.use('/hotels/pms', validateApiKey, pmsRoutes); // API key validation for PMS routes
app.use('/hotels/payments', stripeRoutes);
app.use('/hotels/conversion', conversionRoutes);
app.use('/hotels/api', clientRoutes);
app.use('/hotels/timeshare', authenticateToken, timeshareRoutes); // Timeshare routes for owners
app.use('/hotels/owner/swaps', authenticateToken, swapRoutes); // Owner swap management
app.use('/hotels/staff/swaps', authenticateToken, staffSwapRoutes); // Staff swap approval
app.use('/hotels/owner', authenticateToken, ownerNightCreditRoutes); // Owner night credit requests
app.use('/hotels/staff', authenticateToken, staffNightCreditRoutes); // Staff night credit management
app.use('/hotels/hotel', hotelGuestRoutes); // Hotel guest routes (light access)
app.use('/hotels/hotel-staff', authenticateToken, hotelStaffRoutes); // Hotel staff routes
app.use('/hotels/settings', settingsRoutes); // Platform settings (admin only)
// Public webhook endpoint for Mews
app.use('/hotels/webhooks/mews', mewsWebhooks);
app.use('/hotels', healthRoutes);

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