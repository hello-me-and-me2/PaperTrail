import { Router, Request, Response } from 'express';

const router = Router();

// This endpoint is deprecated — the app uses /api/org/search-data for all searches.
router.get('/', (_req: Request, res: Response) => {
  res.status(410).json({ error: 'This endpoint is no longer available. Use /api/org/search-data.' });
});

export default router;
