import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { userQueries, User } from '../db';
import { signToken, requireAuth, JwtPayload } from '../middleware/auth';

const router = Router();

function safeUser(u: User) {
  return {
    id: u.id,
    email: u.email,
    role: u.role as 'user' | 'admin',
    orgName: u.org_name ?? null,
    orgType: u.org_type ?? null,
    orgDisplayName: u.org_display_name ?? null,
    onboardingComplete: u.onboarding_complete === 1,
    dataSetupComplete: u.data_setup_complete === 1,
  };
}

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
  res.status(201).json({ token, user: safeUser(newUser) });
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
  res.json({ token, user: safeUser(user) });
});

// GET /api/auth/me — validate token & return current user
router.get('/me', requireAuth, (req: Request, res: Response) => {
  const { userId } = (req as Request & { user: JwtPayload }).user;
  const user = userQueries.findById.get(userId);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  res.json({ user: safeUser(user) });
});

// POST /api/auth/onboarding — save org info (one-time, requires auth)
router.post('/onboarding', requireAuth, (req: Request, res: Response) => {
  const { userId } = (req as Request & { user: JwtPayload }).user;
  const { org_name, org_type, org_display_name } = req.body as {
    org_name?: string;
    org_type?: string;
    org_display_name?: string;
  };

  if (!org_name?.trim() || !org_type?.trim()) {
    res.status(400).json({ error: 'Organization name and type are required.' });
    return;
  }

  const validTypes = ['government_agency', 'organization', 'company'];
  if (!validTypes.includes(org_type)) {
    res.status(400).json({ error: 'Invalid organization type.' });
    return;
  }

  userQueries.updateOrg.run(
    org_name.trim(),
    org_type,
    (org_display_name ?? org_name).trim(),
    userId
  );

  const user = userQueries.findById.get(userId)!;
  res.json({ user: safeUser(user) });
});

export default router;
