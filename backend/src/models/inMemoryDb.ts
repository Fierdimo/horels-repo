export type Week = {
  id: string
  ownerId: string
  propertyId: string
  startDate: string
  endDate: string
  color: 'Red' | 'Blue' | 'White'
  status: 'available' | 'confirmed' | 'converted'
}

export type Booking = {
  id: string
  weekId?: string
  userId: string
  reservationId?: string
  startUtc: string
  endUtc: string
  rateId?: string
  serviceId?: string
  totalPrice?: number
  currency?: string
}

export type SwapRequest = {
  id: string
  requesterWeekId: string
  responderWeekId?: string
  status: 'open' | 'matched' | 'completed' | 'cancelled'
}

export type NightCredit = {
  id: string
  ownerId: string
  nights: number
  expiresAt: string
  remaining: number
}

class InMemoryDb {
  weeks: Map<string, Week> = new Map()
  bookings: Map<string, Booking> = new Map()
  swaps: Map<string, SwapRequest> = new Map()
  credits: Map<string, NightCredit> = new Map()

  reset() {
    this.weeks.clear()
    this.bookings.clear()
    this.swaps.clear()
    this.credits.clear()
  }
}

export const db = new InMemoryDb()

export default InMemoryDb
