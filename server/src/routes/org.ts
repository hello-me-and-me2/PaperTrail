import { Router, Request, Response } from 'express';
import { webSearch } from '../services/webSearch';
import { requireAuth } from '../middleware/auth';

const router = Router();

function parseOrgName(title: string): string {
  return title
    .replace(/\s*[-|–—·]\s*.{0,80}$/, '')
    .replace(/\s*\([^)]*\)$/, '')
    .trim()
    .slice(0, 100);
}

function detectOrgType(title: string, desc: string = ''): string {
  const text = `${title} ${desc}`.toLowerCase();
  if (/\b(government|federal|agency|department|bureau|ministry|municipal|county|city of|state of|office of|commission|authority|administration|public sector)\b/.test(text)) {
    return 'Government Agency';
  }
  if (/\b(nonprofit|non-profit|foundation|charity|association|ngo|501c|institute|coalition|society|union|cooperative|trust|not-for-profit)\b/.test(text)) {
    return 'Organization';
  }
  if (/\b(inc\b|corp\b|llc\b|ltd\b|limited|corporation|company|co\b|technologies|solutions|services|group|holding|enterprises|ventures)\b/.test(text)) {
    return 'Company';
  }
  return 'Organization';
}

// GET /api/org/search?q=... — find organizations by name (requires auth)
router.get('/search', requireAuth, async (req: Request, res: Response) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2) { res.json([]); return; }

  try {
    const results = await webSearch(`${q}`, 12);
    const seen = new Set<string>();
    const suggestions = results
      .map((r) => {
        const name = parseOrgName(r.title);
        const key = name.toLowerCase();
        if (!name || name.length < 2 || seen.has(key)) return null;
        seen.add(key);
        return {
          name,
          type: detectOrgType(r.title, r.description),
          description: (r.description ?? '').slice(0, 130),
          source: r.source ?? '',
        };
      })
      .filter(Boolean)
      .slice(0, 8);

    res.json(suggestions);
  } catch {
    res.json([]);
  }
});

export default router;
