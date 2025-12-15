import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { logAction } from '../middleware/loggingMiddleware';
import { Booking, HotelService } from '../models';
import { StripeService } from '../services/stripeService';

const router = Router();

// Get booking details (for hotel guests via token or QR)
router.get('/booking/:token', logAction('view_booking_guest'), async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    // Find booking by token (this would be a secure token, not the ID)
    const booking = await Booking.findOne({
      where: { guest_token: token },
      include: [{
        association: 'Property',
        attributes: ['name', 'location', 'coordinates']
      }]
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check if booking is still valid (current booking or within 30 days post-checkout)
    const checkInDate = new Date(booking.check_in);
    const checkOutDate = new Date(booking.check_out);
    const now = new Date();
    const daysSinceCheckOut = (now.getTime() - checkOutDate.getTime()) / (1000 * 60 * 60 * 24);

    // Allow access if: current date is between check-in and check-out (active booking)
    // OR check-out was less than 30 days ago
    const isActiveBooking = now >= checkInDate && now <= checkOutDate;
    const isWithinPostCheckoutWindow = daysSinceCheckOut <= 30 && daysSinceCheckOut >= 0;

    if (!isActiveBooking && !isWithinPostCheckoutWindow) {
      return res.status(403).json({ error: 'Booking access expired' });
    }

    res.json({
      booking: {
        id: booking.id,
        property: booking.Property || null,
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        roomType: booking.room_type,
        status: booking.status,
        guest_name: booking.guest_name,
        guest_email: booking.guest_email
      },
      hotel: booking.Property || null,
      services: [] // We'll populate this later
    });
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// Request hotel service (for hotel guests)
router.post('/services', logAction('request_hotel_service'), async (req: Request, res: Response) => {
  try {
    const { bookingToken, serviceType, description, urgency } = req.body;

    // Validate token format (basic validation)
    if (!bookingToken || typeof bookingToken !== 'string' || bookingToken.length < 15) {
      return res.status(400).json({ error: 'invalid booking token format' });
    }

    if (!serviceType) {
      return res.status(400).json({ error: 'Service type is required' });
    }

    const booking = await Booking.findOne({
      where: { guest_token: bookingToken }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Optional payment handling
    const amount = req.body.amount; // decimal, EUR
    const currency = req.body.currency || 'EUR';
    let paymentIntentId: string | undefined;
    let clientSecret: string | undefined;

    if (amount) {
      const stripeService = new StripeService();
      const payment = await stripeService.createPaymentIntent(Number(amount), currency, 'hotel_service', { bookingId: booking.id.toString(), serviceType });
      paymentIntentId = payment.id;
      clientSecret = payment.client_secret || undefined;
    }

    // Create service request, attach payment info if present
    // Only include payment columns if they exist in the DB (migration may not have been applied in some test environments)
    const createPayload: any = {
      booking_id: booking.id,
      service_type: serviceType,
      status: 'requested',
      notes: description,
      quantity: 1,
      requested_at: new Date(),
      price: amount ? Number(amount) : null,
    };

    try {
      const qi = (HotelService.sequelize as any).getQueryInterface();
      const desc = await qi.describeTable('hotel_services');
      if (desc['stripe_payment_intent']) createPayload['stripe_payment_intent'] = paymentIntentId || null;
      if (desc['payment_status']) createPayload['payment_status'] = paymentIntentId ? 'pending' : null;
    } catch (err) {
      // If describeTable fails, proceed without payment columns
    }

    const serviceRequest = await HotelService.create(createPayload);

    const responseBody: any = {
      message: 'Service request submitted',
      serviceRequest: {
        id: serviceRequest.id,
        service_type: serviceRequest.service_type,
        status: serviceRequest.status,
        notes: serviceRequest.notes,
        requested_at: serviceRequest.requested_at,
        price: serviceRequest.price
      }
    };

    if (clientSecret) responseBody.payment = { clientSecret, paymentIntentId };

    res.status(201).json(responseBody);
  } catch (error) {
    console.error('Error requesting service:', error);
    res.status(500).json({ error: 'Failed to request service' });
  }
});

// Get service requests for a booking
router.get('/services/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const booking = await Booking.findOne({
      where: { guest_token: token }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    let services: any[] = [];
    try {
      const qi = (HotelService.sequelize as any).getQueryInterface();
      const desc = await qi.describeTable('hotel_services');

      const baseAttrs = [
        'id', 'booking_id', 'service_type', 'status', 'quantity', 'notes', 'price',
        'requested_at', 'created_at', 'updated_at'
      ];

      const hasStripe = Boolean(desc['stripe_payment_intent']);
      const hasPaymentStatus = Boolean(desc['payment_status']);

      const attributes = (hasStripe || hasPaymentStatus)
        ? ['id','booking_id','service_type','status','quantity','notes','price','stripe_payment_intent','payment_status','requested_at','created_at','updated_at']
        : baseAttrs;

      services = await HotelService.findAll({
        attributes,
        where: { booking_id: booking.id },
        order: [['requested_at', 'DESC']]
      });
    } catch (err) {
      // If describeTable fails (migration not applied or DB access issue), fall back to selecting default attributes
      services = await HotelService.findAll({
        where: { booking_id: booking.id },
        order: [['requested_at', 'DESC']]
      });
    }

    res.json({
      services: services.map(service => ({
        id: service.id,
        service_type: service.service_type,
        status: service.status,
        notes: service.notes,
        requested_at: service.requested_at
      })),
      count: services.length
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// Get Secret World content for location (nearby cards/itineraries)
router.get('/nearby/:token', logAction('view_nearby_content'), async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { radius = 5 } = req.query;

    const booking = await Booking.findOne({
      where: { guest_token: token },
      include: [{
        association: 'Property',
        attributes: ['coordinates', 'location']
      }]
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Here we would call Secret World API to get nearby content
    // For now, return mock data
    const nearbyContent = {
      location: booking.Property?.location || 'Test City',
      coordinates: booking.Property?.coordinates || { lat: 40.7128, lng: -74.0060 },
      cards: [
        {
          id: 'card1',
          title: 'City Walking Tour',
          description: 'Explore the historic center',
          type: 'itinerary',
          distance: '0.5km'
        },
        {
          id: 'card2',
          title: 'Local Restaurant Guide',
          description: 'Best places to eat nearby',
          type: 'guide',
          distance: '0.3km'
        }
      ],
      itineraries: [
        {
          id: 'itinerary1',
          title: 'Weekend in the City',
          description: 'Perfect 2-day itinerary',
          duration: '2 days'
        }
      ]
    };

    // Normalize coordinates: Property.coordinates may be stored as JSON string, CSV "lat,lng", or object
    const _coords = (() => {
      const raw = nearbyContent.coordinates;
      if (!raw) return { lat: 40.7128, lng: -74.0060 };
      if (typeof raw === 'object') return raw as { lat: number; lng: number };
      if (typeof raw === 'string') {
        // Try JSON
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') return parsed;
        } catch (_) {
          // not JSON, try CSV
          const parts = raw.split(',').map(p => parseFloat(p.trim()));
          if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return { lat: parts[0], lng: parts[1] };
        }
      }
      return { lat: 40.7128, lng: -74.0060 };
    })();

    res.json({
      content: nearbyContent.cards,
      location: {
        name: nearbyContent.location,
        latitude: _coords.lat,
        longitude: _coords.lng
      }
    });
  } catch (error) {
    console.error('Error fetching nearby content:', error);
    res.status(500).json({ error: 'Failed to fetch nearby content' });
  }
});

export default router;