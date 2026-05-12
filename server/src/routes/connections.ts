import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { requireAuth, JwtPayload } from '../middleware/auth';
import { connectionQueries, orgFileQueries } from '../db';

const router = Router();

// GET /api/connections — list user's connections
router.get('/', requireAuth, (req: Request, res: Response) => {
  const { userId } = (req as Request & { user: JwtPayload }).user;
  const conns = connectionQueries.listByUser.all(userId).map(c => ({
    id: c.id,
    service: c.service,
    label: c.label,
    status: c.status,
    webhookToken: c.webhook_token,
    lastSyncAt: c.last_sync_at,
    connectedAt: c.connected_at,
  }));
  res.json(conns);
});

// POST /api/connections — add a new connection
router.post('/', requireAuth, (req: Request, res: Response) => {
  const { userId } = (req as Request & { user: JwtPayload }).user;
  const { service, label, credentials } = req.body as { service?: string; label?: string; credentials?: Record<string, string> };

  if (!service?.trim()) { res.status(400).json({ error: 'Service is required.' }); return; }

  // Generate a unique webhook token for webhook-type connections
  const webhookToken = crypto.randomBytes(24).toString('hex');

  const result = connectionQueries.insert.run(
    userId,
    service.trim(),
    label?.trim() || null,
    webhookToken,
    credentials ? JSON.stringify(credentials) : null,
  );

  res.status(201).json({
    id: result.lastInsertRowid,
    service,
    label: label || null,
    status: 'active',
    webhookToken,
    webhookUrl: `${process.env.APP_URL || ''}/api/connections/webhook/${webhookToken}`,
  });
});

// DELETE /api/connections/:id — remove a connection
router.delete('/:id', requireAuth, (req: Request, res: Response) => {
  const { userId } = (req as Request & { user: JwtPayload }).user;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
  connectionQueries.deleteById.run(id, userId);
  res.json({ success: true });
});

// POST /api/connections/webhook/:token — public webhook endpoint (no auth, secured by token)
router.post('/webhook/:token', async (req: Request, res: Response) => {
  const token = req.params.token;
  const conn = connectionQueries.findByWebhookToken.get(token);
  if (!conn) { res.status(404).json({ error: 'Invalid webhook token.' }); return; }

  const body = req.body;
  let content = '';

  if (typeof body === 'string') {
    content = body;
  } else if (Buffer.isBuffer(body)) {
    content = body.toString('utf-8');
  } else if (typeof body === 'object') {
    content = JSON.stringify(body);
  }

  if (content.length > 0) {
    // Store as an org file so it gets picked up by the monitor
    const originalName = `webhook-${conn.service}-${Date.now()}.json`;
    orgFileQueries.insert.run(
      conn.user_id,
      originalName,
      'json',
      content.slice(0, 60000),
      content.length,
    );
    connectionQueries.updateLastSync.run(conn.id);
  }

  res.json({ received: true });
});

export default router;
