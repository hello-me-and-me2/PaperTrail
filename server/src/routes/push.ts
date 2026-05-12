import { Router, Request, Response } from 'express';
import { requireAuth, JwtPayload } from '../middleware/auth';
import { pushSubQueries } from '../db';
import { getVapidPublicKey } from '../services/pushService';

const router = Router();

// GET /api/push/vapid-key — return VAPID public key for client subscription
router.get('/vapid-key', (_req: Request, res: Response) => {
  const key = getVapidPublicKey();
  if (!key) { res.status(503).json({ error: 'Push notifications not configured.' }); return; }
  res.json({ publicKey: key });
});

// POST /api/push/subscribe — save a push subscription
router.post('/subscribe', requireAuth, (req: Request, res: Response) => {
  const { userId } = (req as Request & { user: JwtPayload }).user;
  const { endpoint, keys } = req.body as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ error: 'endpoint and keys (p256dh, auth) are required.' });
    return;
  }

  pushSubQueries.upsert.run(userId, endpoint, keys.p256dh, keys.auth);
  res.status(201).json({ success: true });
});

// DELETE /api/push/subscribe — remove a push subscription
router.delete('/subscribe', requireAuth, (req: Request, res: Response) => {
  const { endpoint } = req.body as { endpoint?: string };
  if (!endpoint) { res.status(400).json({ error: 'endpoint is required.' }); return; }
  pushSubQueries.deleteByEndpoint.run(endpoint);
  res.json({ success: true });
});

export default router;
