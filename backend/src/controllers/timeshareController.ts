import { db, Week, Booking, NightCredit } from '../models/inMemoryDb'
import { IMewsAdapter } from '../services/mews/mewsAdapter'
import { pmsService } from '../services/pmsServiceFactory'

export class TimeshareController {
  adapter: IMewsAdapter

  constructor(adapter?: IMewsAdapter) {
    // If no adapter provided, use the central factory default (mock by default)
    this.adapter = adapter ?? (pmsService as unknown as IMewsAdapter)
  }

  async confirmWeek(ownerId: string, weekId: string, options?: { upsellNights?: number }) {
    const week = db.weeks.get(weekId)
    if (!week) throw new Error('Week not found')
    if (week.ownerId !== ownerId) throw new Error('Forbidden')
    if (week.status !== 'available') throw new Error('Week not available')

    // Build a minimal price payload
    const payload = {
      Reservations: [
        {
          ServiceId: week.id,
          RateId: 'default',
          StartUtc: week.startDate,
          EndUtc: week.endDate,
          AdultCount: 2,
        },
      ],
    }

    const price = await this.adapter.priceReservation({ ...payload })
    if (!price.success) {
      throw new Error(`Pricing failed: ${price.reason || 'unknown'}`)
    }

    // simulate payment for upsell if any (omitted)

    const addRes = await this.adapter.addReservation({ ...payload })
    if (!addRes.success) throw new Error(`Reservation creation failed: ${addRes.reason}`)

    // persist booking
    const booking: Booking = {
      id: 'BK-' + Date.now().toString(36),
      weekId: weekId,
      userId: ownerId,
      reservationId: addRes.reservationId,
      startUtc: week.startDate,
      endUtc: week.endDate,
      totalPrice: price.total,
      currency: price.currency,
    }
    db.bookings.set(booking.id, booking)

    week.status = 'confirmed'
    db.weeks.set(weekId, week)

    return booking
  }

  async convertWeekToCredits(ownerId: string, weekId: string) {
    const week = db.weeks.get(weekId)
    if (!week) throw new Error('Week not found')
    if (week.ownerId !== ownerId) throw new Error('Forbidden')
    if (week.status !== 'available') throw new Error('Week not available')

    const nights = week.color === 'Red' ? 6 : week.color === 'Blue' ? 5 : 4
    const credit: NightCredit = {
      id: 'NC-' + Date.now().toString(36),
      ownerId,
      nights,
      remaining: nights,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString(),
    }
    db.credits.set(credit.id, credit)
    week.status = 'converted'
    db.weeks.set(weekId, week)
    return credit
  }

  async requestSwap(requesterWeekId: string, responderWeekId?: string) {
    const reqId = 'SW-' + Date.now().toString(36)
    const swap = {
      id: reqId,
      requesterWeekId,
      responderWeekId,
      status: (responderWeekId ? 'matched' : 'open') as 'matched' | 'completed' | 'cancelled' | 'open',
    }
    db.swaps.set(reqId, swap)
    return swap
  }

  // guest access: return booking if token/book id found
  getBookingForToken(token: string) {
    // token mapping not implemented; assume token equals booking.id for demo
    const b = db.bookings.get(token)
    if (!b) throw new Error('Not found')
    return b
  }
}

export default TimeshareController
