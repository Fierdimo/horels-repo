import { Router } from 'express';
import PMSController from '../controllers/pmsController';
import { authenticateToken } from '../middleware/authMiddleware';
import { authorize } from '../middleware/authorizationMiddleware';
import { logAction } from '../middleware/loggingMiddleware';

const router = Router();
const pmsController = new PMSController();

// Apply authentication to all PMS routes
router.use(authenticateToken);

// Get room availability
router.get('/availability/:propertyId', authorize(['view_availability']), logAction('check_availability'), (req, res) => pmsController.getAvailability(req, res));

// Create a new booking
router.post('/bookings', authorize(['create_booking']), logAction('create_booking'), (req, res) => pmsController.createBooking(req, res));

// Get booking details
router.get('/bookings/:bookingId', authorize(['view_booking']), logAction('view_booking'), (req, res) => pmsController.getBooking(req, res));

// Update a booking
router.put('/bookings/:bookingId', authorize(['update_booking']), logAction('update_booking'), (req, res) => pmsController.updateBooking(req, res));

// Cancel a booking
router.delete('/bookings/:bookingId', authorize(['cancel_booking']), logAction('cancel_booking'), (req, res) => pmsController.cancelBooking(req, res));

// Get property information
router.get('/properties/:propertyId', authorize(['view_property']), logAction('view_property'), (req, res) => pmsController.getProperty(req, res));

// Get user's properties (for owners)
router.get('/properties', authorize(['view_own_properties']), logAction('list_properties'), (req, res) => pmsController.getUserProperties(req, res));

export default router;