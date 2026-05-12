import { Router, Request, Response } from 'express';
import { requireAuth, JwtPayload } from '../middleware/auth';
import { alertQueries } from '../db';

const router = Router();

// GET /api/alerts — list all alerts for the user
router.get('/', requireAuth, (req: Request, res: Response) => {
  const { userId } = (req as Request & { user: JwtPayload }).user;
  const alerts = alertQueries.listByUser.all(userId);
  res.json(alerts);
});

// GET /api/alerts/unread — unread count for badge
router.get('/unread', requireAuth, (req: Request, res: Response) => {
  const { userId } = (req as Request & { user: JwtPayload }).user;
  const { n } = alertQueries.unreadCount.get(userId) as { n: number };
  res.json({ count: n });
});

// PATCH /api/alerts/:id/read — mark one alert as read
router.patch('/:id/read', requireAuth, (req: Request, res: Response) => {
  const { userId } = (req as Request & { user: JwtPayload }).user;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
  alertQueries.markRead.run(id, userId);
  res.json({ success: true });
});

// POST /api/alerts/read-all — mark all alerts as read
router.post('/read-all', requireAuth, (req: Request, res: Response) => {
  const { userId } = (req as Request & { user: JwtPayload }).user;
  alertQueries.markAllRead.run(userId);
  res.json({ success: true });
});

export default router;
