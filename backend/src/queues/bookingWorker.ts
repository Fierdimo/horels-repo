import { pmsService } from '../services/pmsServiceFactory'
import { db } from '../models/inMemoryDb'

export async function onCreateBooking(payload: any) {
  try {
    const idempotency = payload.idempotencyKey || null
    // call underlying PMS to create booking (mock by default)
    const res = (pmsService as any).createBooking ? await (pmsService as any).createBooking(payload, idempotency) : await (pmsService as any).addReservation(payload)

    // persist into in-memory DB if PMS returns reservationId
    const reservationId = res?.reservationId || res?.pmsBookingId || res?.ReservationId || res?.id || null
    if (reservationId) {
      const booking = {
        id: 'BK-' + Math.random().toString(36).slice(2, 9).toUpperCase(),
        weekId: payload.weekId || null,
        userId: payload.userId || null,
        reservationId,
        startUtc: payload?.Reservations?.[0]?.StartUtc || payload.checkIn || null,
        endUtc: payload?.Reservations?.[0]?.EndUtc || payload.checkOut || null,
        totalPrice: payload.totalPrice || 0
      }
      db.bookings.set(booking.id, booking as any)
      return booking
    }

    return { success: false }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export default { onCreateBooking }
