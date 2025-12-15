import MewsWebhook from '../models/MewsWebhook';

type SaveOpts = {
  provider: string;
  enterpriseId?: string | null;
  integrationId?: string | null;
  webhookType: 'general' | 'integration';
  action?: string | null;
  events?: any | null;
  raw: any;
};

export const saveRawWebhook = async (opts: SaveOpts) => {
  const rec = await MewsWebhook.create({
    provider: opts.provider,
    enterprise_id: opts.enterpriseId,
    integration_id: opts.integrationId,
    webhook_type: opts.webhookType,
    action: opts.action,
    events: opts.events,
    raw: opts.raw,
  } as any);
  return rec;
};

export default {
  saveRawWebhook,
};
