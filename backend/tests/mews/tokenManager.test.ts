import { describe, it, expect, vi, beforeEach } from 'vitest';
import TokenManager from '../../src/services/mews/tokenManager';

describe('TokenManager', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.MEWS_CLIENT_TOKEN;
    delete process.env.MEWS_ACCESS_TOKEN;
    delete process.env.MEWS_TOKEN_URL;
    delete process.env.MEWS_CLIENT_ID;
    delete process.env.MEWS_CLIENT_SECRET;
  });

  it('uses static connector tokens when present', async () => {
    process.env.MEWS_CLIENT_TOKEN = 'CT-123';
    process.env.MEWS_ACCESS_TOKEN = 'AT-456';
    const tm = new TokenManager();
    const headers = await tm.getAuthHeaders();
    expect(headers.ClientToken).toBe('CT-123');
    expect(headers.AccessToken).toBe('AT-456');
  });

  it('fetches oauth token when no static tokens', async () => {
    const fakeRes = { access_token: 'bearer-xyz', expires_in: 3600 };
    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => JSON.stringify(fakeRes), json: async () => fakeRes }));
    // @ts-ignore
    global.fetch = fetchMock;

    const tm = new TokenManager({ tokenUrl: 'https://token.test/oauth/token', clientId: 'cid', clientSecret: 'csecret' });
    const h = await tm.getAuthHeaders();
    expect(h.Authorization).toBe('Bearer bearer-xyz');
    expect(fetchMock).toHaveBeenCalled();
  });
});
