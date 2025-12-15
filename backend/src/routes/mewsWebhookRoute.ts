import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { saveRawWebhook } from '../services/webhookStore';
import { enqueueWebhookPayload } from '../workers/webhookWorker';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const token = (req.query.token as string) || '';
  const expectedToken = process.env.MEWS_WEBHOOK_TOKEN || '';
  if (expectedToken && token !== expectedToken) return res.status(401).json({ error: 'unauthorized' });

  try {
    const secret = process.env.MEWS_WEBHOOK_SECRET;
    if (secret) {
      const raw = JSON.stringify(req.body);
      const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
      const received = (req.headers[process.env.MEWS_WEBHOOK_SIGNATURE_HEADER || 'mews-signature'] as string) || '';
      if (!received || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received))) {
        return res.status(400).json({ error: 'Invalid signature' });
      }
    }

    const body = req.body || {};
    const webhookType = body.Events ? 'general' : 'integration';
    const enterpriseId = body.EnterpriseId || body.Data?.Enterprise?.Id || null;
    const integrationId = body.IntegrationId || body.Data?.Integration?.Id || null;
    const action = body.Action || null;

    const record = await saveRawWebhook({
      provider: 'mews',
      enterpriseId,
      integrationId,
      webhookType: webhookType as 'general' | 'integration',
      action,
      events: body.Events || null,
      raw: body,
    });

    await enqueueWebhookPayload(record.id);
    return res.status(202).send();
  } catch (err: any) {
    console.error('Error handling Mews webhook:', err?.message || err);
    return res.status(500).json({ error: 'Webhook handling failed' });
  }
});

export default router;
