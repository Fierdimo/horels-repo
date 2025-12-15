import { describe, it, expect, beforeEach } from 'vitest'
import { TimeshareController } from '../../src/controllers/timeshareController'
import { MockMewsAdapter } from '../../src/services/mews/mewsAdapter'
import { db } from '../../src/models/inMemoryDb'

beforeEach(() => {
  // reset in-memory DB
  db.weeks.clear()
  db.bookings.clear()
  db.credits.clear()
  db.swaps.clear()
})

describe('Timeshare stories with Mock PMS Fabric', () => {
  it('confirmWeek flow - price and add succeed via mock', async () => {
    const adapter = new MockMewsAdapter()
    const controller = new TimeshareController(adapter as any)

    // prepare week in db
    const week = { id: 'week-1', ownerId: 'owner-1', startDate: '2025-12-01', endDate: '2025-12-08', status: 'available', color: 'Red' }
    db.weeks.set('week-1', week as any)

    const booking = await controller.confirmWeek('owner-1', 'week-1')
    expect(booking).toHaveProperty('id')
    expect(db.bookings.size).toBe(1)
    const savedWeek = db.weeks.get('week-1')
    expect(savedWeek.status).toBe('confirmed')
  })

  it('convertWeekToCredits creates credits and marks week converted', async () => {
    const adapter = new MockMewsAdapter()
    const controller = new TimeshareController(adapter as any)

    const week = { id: 'week-2', ownerId: 'owner-2', startDate: '2025-12-01', endDate: '2025-12-08', status: 'available', color: 'Blue' }
    db.weeks.set('week-2', week as any)

    const credit = await controller.convertWeekToCredits('owner-2', 'week-2')
    expect(credit).toHaveProperty('id')
    expect(credit.remaining).toBeGreaterThan(0)
    const savedWeek = db.weeks.get('week-2')
    expect(savedWeek.status).toBe('converted')
  })

  it('requestSwap creates swap and can be matched', async () => {
    const adapter = new MockMewsAdapter()
    const controller = new TimeshareController(adapter as any)

    const swap = await controller.requestSwap('week-3')
    expect(swap.status).toBe('open')

    const matched = await controller.requestSwap('week-4', 'week-3')
    expect(matched.status).toBe('matched')
  })

  it('guest access returns booking by token mapping', () => {
    const adapter = new MockMewsAdapter()
    const controller = new TimeshareController(adapter as any)

    const booking = { id: 'BK-1', weekId: 'w1', userId: 'u1', reservationId: 'R1', startUtc: '2025-12-01', endUtc: '2025-12-08', totalPrice: 100 }
    db.bookings.set('BK-1', booking as any)

    const b = controller.getBookingForToken('BK-1')
    expect(b).toHaveProperty('reservationId')
  })
})
