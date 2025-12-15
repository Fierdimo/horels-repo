import { describe, it, expect, vi, beforeEach } from 'vitest';
import MewsAdapter from '../../src/services/mews/mewsAdapter';
import TokenManager from '../../src/services/mews/tokenManager';

describe('MewsAdapter (mocked)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('passes auth headers from TokenManager to fetch', async () => {
    const tm = new TokenManager({});
    // mock tokenManager.getAuthHeaders
    const spyGet = vi.spyOn(tm as any, 'getAuthHeaders').mockResolvedValue({ Authorization: 'Bearer tok' });

    const fakeJson = { foo: 'bar' };
    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => JSON.stringify(fakeJson), json: async () => fakeJson }));
    // @ts-ignore
    global.fetch = fetchMock;

    const adapter = new MewsAdapter({ tokenManager: tm });
    const res = await adapter.configurationGet();
    expect(res).toMatchObject({ foo: 'bar' });
    expect(spyGet).toHaveBeenCalled();
    // assert fetch called with authorization header merged
    expect(fetchMock).toHaveBeenCalled();
    const calledWith = fetchMock.mock.calls[0][0] as string;
    expect(calledWith).toContain('/api/connector/v1/configuration/get');
  });
});
