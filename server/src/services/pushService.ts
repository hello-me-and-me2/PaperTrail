import webpush from 'web-push';
import { pushSubQueries } from '../db';

let vapidReady = false;

export function initVapid() {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL || 'mailto:noreply@papertrail.io';

  if (pub && priv) {
    webpush.setVapidDetails(email, pub, priv);
    vapidReady = true;
    console.log('[push] VAPID configured');
  } else {
    // Auto-generate for this session (not stable across restarts — set env vars for production)
    try {
      const keys = webpush.generateVAPIDKeys();
      webpush.setVapidDetails(email, keys.publicKey, keys.privateKey);
      vapidReady = true;
      console.log('[push] Auto-generated VAPID keys (set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY env vars for persistence)');
      console.log('[push] VAPID_PUBLIC_KEY=' + keys.publicKey);
      console.log('[push] VAPID_PRIVATE_KEY=' + keys.privateKey);
      // Expose public key for client
      process.env.VAPID_PUBLIC_KEY = keys.publicKey;
    } catch { console.error('[push] Failed to generate VAPID keys'); }
  }
}

export function getVapidPublicKey(): string {
  return process.env.VAPID_PUBLIC_KEY || '';
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

export async function sendPushNotification(userId: number, payload: PushPayload): Promise<number> {
  if (!vapidReady) return 0;
  const subs = pushSubQueries.listByUser.all(userId);
  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ ...payload, icon: '/icon-192.png', badge: '/icon-192.png' }),
      );
      sent++;
    } catch (e: unknown) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 410 || status === 404) {
        // Subscription expired — remove it
        pushSubQueries.deleteByEndpoint.run(sub.endpoint);
      }
    }
  }
  return sent;
}
