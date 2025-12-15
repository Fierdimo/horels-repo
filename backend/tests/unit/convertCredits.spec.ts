import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../src/models/inMemoryDb'
import { MockMewsAdapter } from '../../src/services/mews/mewsAdapter'
import TimeshareController from '../../src/controllers/timeshareController'

describe('TimeshareController.convertWeekToCredits', () => {
  beforeEach(() => db.reset())

  it('converts a week into night credits and marks week converted', async () => {
    const week = {
      id: 'W2',
      ownerId: 'U2',
      propertyId: 'P1',
      startDate: '2026-02-01T14:00:00Z',
      endDate: '2026-02-08T10:00:00Z',
      color: 'Blue' as const,
      status: 'available' as const,
    }
    db.weeks.set(week.id, week)
    const ctrl = new TimeshareController(new MockMewsAdapter())
    const credit = await ctrl.convertWeekToCredits('U2', 'W2')
    expect(credit).toBeDefined()
    expect(credit.ownerId).toBe('U2')
    expect(credit.nights).toBe(5)
    const updated = db.weeks.get('W2')
    expect(updated?.status).toBe('converted')
  })
})
