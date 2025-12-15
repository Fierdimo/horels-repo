import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../src/models/inMemoryDb'
import { MockMewsAdapter } from '../../src/services/mews/mewsAdapter'
import TimeshareController from '../../src/controllers/timeshareController'

describe('TimeshareController.confirmWeek', () => {
  beforeEach(() => {
    db.reset()
  })

  it('confirms a week when pricing and add succeed', async () => {
    // arrange
    const week = {
      id: 'W1',
      ownerId: 'U1',
      propertyId: 'P1',
      startDate: '2026-01-01T14:00:00Z',
      endDate: '2026-01-08T10:00:00Z',
      color: 'Red' as const,
      status: 'available' as const,
    }
    db.weeks.set(week.id, week)
    const adapter = new MockMewsAdapter()
    const ctrl = new TimeshareController(adapter)

    // act
    const booking = await ctrl.confirmWeek('U1', 'W1')

    // assert
    expect(booking).toBeDefined()
    expect(booking.weekId).toBe('W1')
    const persisted = Array.from(db.bookings.values()).find(b => b.weekId === 'W1')
    expect(persisted).toBeDefined()
    const updatedWeek = db.weeks.get('W1')
    expect(updatedWeek?.status).toBe('confirmed')
  })

  it('throws when week not found', async () => {
    const adapter = new MockMewsAdapter()
    const ctrl = new TimeshareController(adapter)
    await expect(ctrl.confirmWeek('U1', 'NOPE')).rejects.toThrow('Week not found')
  })
})
