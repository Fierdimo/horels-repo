import crypto from 'crypto';
import MewsWebhook from '../models/MewsWebhook';
import MewsWebhookEvent from '../models/MewsWebhookEvent';
import Booking from '../models/Booking';
import { pmsService } from '../services/pmsServiceFactory';
// Enqueue a job via the queue abstraction (BullMQ when enabled, otherwise in-memory)
export const enqueueWebhookPayload = async (webhookId: number) => {
  // dynamic import to avoid circular import and work with vitest/ts-node resolution
  const q = await import('../queues/webhookQueue');
  return (q as any).addJob(webhookId as number);
};

// Process a single webhook record: split events, dedupe, and reconcile bookings.
export const processWebhook = async (webhookId: number) => {
  const rec = await MewsWebhook.findByPk(webhookId);
  if (!rec) return;

  // Mark attempt
  try {
    await rec.increment('processing_attempts');
  } catch (err) {
    console.error('Failed to increment processing_attempts', err);
  }

  const body: any = (rec.raw as any) || {};
  if (rec.webhook_type === 'general' && Array.isArray(body.Events)) {
    for (const ev of body.Events) {
      const disc = ev.Discriminator || ev.discriminator || 'Unknown';
      const entityId = ev.Value?.Id || ev.Value?.id || String(ev.Value || '');
      if (!entityId) continue;

      const idempotency = crypto.createHash('sha256').update(String(rec.integration_id || '') + '|' + disc + '|' + String(entityId)).digest('hex');

      // Try to create event record; if exists skip
      try {
        const [evt, created] = await MewsWebhookEvent.findOrCreate({ where: { idempotency_key: idempotency }, defaults: { webhook_id: rec.id, discriminator: disc, entity_id: String(entityId), idempotency_key: idempotency } as any });
        if (!created) {
          // already processed or queued
          continue;
        }

        // Basic reconciliation: if this looks like a reservation/serviceorder event, try to update local booking status
        const et = String(disc || '').toLowerCase();
        if (et.includes('serviceorder') || et.includes('reservation') || et.includes('serviceorderupdated') || et.includes('serviceorderadded')) {
          // Look up local booking by pms_booking_id
          const booking = await Booking.findOne({ where: { pms_booking_id: String(entityId) } });
          if (booking) {
            let newStatus: any = null;
            const evText = JSON.stringify(ev).toLowerCase();
            if (evText.includes('cancel') || evText.includes('cancelled')) newStatus = 'cancelled';
            if (evText.includes('checkin') || evText.includes('arrive')) newStatus = 'checked_in';
            if (evText.includes('checkout') || evText.includes('depart')) newStatus = 'checked_out';
            if (evText.includes('create') || evText.includes('reservation') || evText.includes('book')) newStatus = 'confirmed';

            if (newStatus) {
              await booking.update({ status: newStatus });
            }
          }
        }

        // Mark event processed
        await evt.update({ processed_at: new Date() });
      } catch (err: any) {
        // If unique constraint violation occurred for idempotency_key, skip
        if (err && err.name && err.name.includes('SequelizeUniqueConstraintError')) {
          continue;
        }
        console.error('Error processing webhook event', err);
      }
    }
  }

  // After processing events, mark the webhook record as processed
  try {
    await rec.update({ processed: true });
  } catch (err) {
    console.error('Failed to mark webhook processed', err);
  }
};

export default {
  enqueueWebhookPayload,
  processWebhook,
};
