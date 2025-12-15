import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../src/models/inMemoryDb'
import TimeshareController from '../../src/controllers/timeshareController'
import { MockMewsAdapter } from '../../src/services/mews/mewsAdapter'

describe('Guest access (light token)', () => {
  beforeEach(() => db.reset())

  it('retrieves booking by token (demo mapping)', async () => {
    // create booking and use booking.id as token for demo
    const booking = {
      id: 'BK-TOKEN',
      userId: 'G1',
      startUtc: '2026-03-01T14:00:00Z',
      endUtc: '2026-03-05T10:00:00Z',
    }
    db.bookings.set(booking.id, booking as any)
    const ctrl = new TimeshareController(new MockMewsAdapter())
    const found = ctrl.getBookingForToken('BK-TOKEN')
    expect(found).toBeDefined()
    expect(found.id).toBe('BK-TOKEN')
  })
})
