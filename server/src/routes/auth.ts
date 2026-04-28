import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { userQueries } from '../db';
import { signToken, requireAuth, JwtPayload } from '../middleware/auth';

const router = Router();

// POST /api/auth/signup
router.post('/signup', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Invalid email address.' });
    return;
  }
  if (password.length < 4) {
    res.status(400).json({ error: 'Password must be at least 4 characters.' });
    return;
  }

  const existing = userQueries.findByEmail.get(email.trim().toLowerCase());
  if (existing) {
    res.status(409).json({ error: 'An account with that email already exists.' });
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  const result = userQueries.create.run(email.trim().toLowerCase(), hash);
  const newUser = userQueries.findById.get(result.lastInsertRowid as number)!;

  const token = signToken({ userId: newUser.id, email: newUser.email, role: newUser.role });
  res.status(201).json({
    token,
    user: { id: newUser.id, email: newUser.email, role: newUser.role },
  });
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const user = userQueries.findByEmail.get(email.trim().toLowerCase());
  if (!user) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  res.json({
    token,
    user: { id: user.id, email: user.email, role: user.role },
  });
});

// GET /api/auth/me  — validate token & return current user
router.get('/me', requireAuth, (req: Request, res: Response) => {
  const { userId, email, role } = (req as Request & { user: JwtPayload }).user;
  const user = userQueries.findById.get(userId);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  res.json({ user: { id: userId, email, role } });
});

export default router;
