import PmsMockService from './pmsMockService';
import PmsApiService from './pmsApiService';
import MewsAdapter from './adapters/mewsAdapter';
import { PmsAdapter } from './adapters/pmsAdapterInterface';

export type PmsServiceType = PmsAdapter;

const registry: Record<string, { new(): PmsAdapter }> = {
  mock: (PmsMockService as unknown) as any,
  mews: MewsAdapter
};

export function createPmsService(provider?: string): PmsServiceType {
  const prov = (provider || process.env.PMS_PROVIDER || 'mock').toLowerCase();

  // Safety: during tests default to mock adapter to avoid accidental network calls.
  // If tests explicitly opt-in to real PMS integration by setting `USE_REAL_PMS=true`,
  // allow provider selection (useful for sandbox E2E runs).
  const isTest = ((process.env.NODE_ENV || '').toLowerCase() === 'test');
  // Require an explicit opt-in for real/sandbox PMS during test runs.
  // `USE_REAL_PMS=true` enables real PMS generally, but to allow it in tests
  // the test runner must also set `TEST_USE_REAL_PMS=true` to avoid accidental
  // external calls when developers have a local .env with USE_REAL_PMS=true.
  const useRealInTest = ((process.env.USE_REAL_PMS || '').toLowerCase() === 'true') && ((process.env.TEST_USE_REAL_PMS || '').toLowerCase() === 'true');
  if (isTest && !useRealInTest) {
    return PmsMockService as any;
  }

  // If explicitly requesting the mock, return it directly
  if (prov === 'mock' || prov === 'pmsmock') return PmsMockService as any;
  // Prefer mock behavior for the mews provider unless `USE_REAL_PMS` is explicitly set to 'true'.
  if (prov === 'mews' && (process.env.USE_REAL_PMS || '').toLowerCase() !== 'true') {
    return PmsMockService as any;
  }

  // If the mews provider is requested in real mode, ensure required env vars are present.
  if (prov === 'mews' && (process.env.USE_REAL_PMS || '').toLowerCase() === 'true') {
    const base = process.env.MEWS_BASE_URL;
    const tokenUrl = process.env.MEWS_TOKEN_URL;
    const clientId = process.env.MEWS_CLIENT_ID;
    const clientSecret = process.env.MEWS_CLIENT_SECRET || process.env.MEWS_ACCESS_TOKEN || process.env.MEWS_CLIENT_TOKEN;
    if (!base) {
      throw new Error('MEWS_BASE_URL is required to use the real Mews adapter. Set MEWS_BASE_URL in your .env');
    }
    if (!tokenUrl && (!clientId || !clientSecret)) {
      throw new Error('Mews credentials missing: set MEWS_TOKEN_URL or (MEWS_CLIENT_ID and MEWS_CLIENT_SECRET/MEWS_CLIENT_TOKEN/MEWS_ACCESS_TOKEN)');
    }
  }

  const Adapter = registry[prov];
  if (!Adapter) {
    // Unknown provider — fallback to mock to keep tests stable
    return PmsMockService as any;
  }

  return new Adapter();
}

// Default export: create based on env
export const pmsService = createPmsService();
