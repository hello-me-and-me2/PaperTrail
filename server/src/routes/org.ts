import { Router, Request, Response } from 'express';
import multer from 'multer';
import { webSearch } from '../services/webSearch';
import { requireAuth, JwtPayload } from '../middleware/auth';
import { userQueries, orgFileQueries, User, OrgFile } from '../db';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

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

function detectIndustry(title: string, desc: string = ''): string {
  const text = `${title} ${desc}`.toLowerCase();
  if (/\b(defense|military|aerospace|pentagon|army|navy|air force|marines|weapons|munitions|missile|combat|contractor defense)\b/.test(text)) return 'Defense & Aerospace';
  if (/\b(tech|software|cloud|ai\b|artificial intelligence|data|saas|platform|digital|cybersecurity|semiconductor|hardware|developer)\b/.test(text)) return 'Technology';
  if (/\b(pharma|healthcare|medical|health|hospital|clinic|drug|biotech|life sciences|pharmaceutical|patient|clinical)\b/.test(text)) return 'Healthcare';
  if (/\b(bank|finance|insurance|financial|investment|capital|fund|wealth|asset management|trading|mortgage|credit)\b/.test(text)) return 'Finance';
  if (/\b(logistics|shipping|delivery|transport|freight|supply chain|cargo|warehouse|trucking|courier|fleet)\b/.test(text)) return 'Logistics & Delivery';
  if (/\b(oil|gas|energy|petroleum|pipeline|refinery|power|utilities|renewable|solar|wind|nuclear|electricity)\b/.test(text)) return 'Energy';
  if (/\b(construction|engineering|infrastructure|building|contractor|architecture|civil|structural|facilities)\b/.test(text)) return 'Construction';
  if (/\b(retail|consumer|ecommerce|e-commerce|shopping|store|merchandise|brand|fashion|apparel)\b/.test(text)) return 'Retail';
  if (/\b(media|entertainment|broadcasting|film|television|streaming|publishing|news|music|studio)\b/.test(text)) return 'Media';
  if (/\b(education|school|university|college|learning|academic|student|campus|training|edtech)\b/.test(text)) return 'Education';
  if (/\b(food|restaurant|agriculture|farming|beverage|grocery|catering|hospitality|culinary)\b/.test(text)) return 'Food & Agriculture';
  if (/\b(telecom|wireless|broadband|telecommunications|network|carrier|fiber|mobile|internet provider)\b/.test(text)) return 'Telecom';
  if (/\b(consulting|advisory|accounting|audit|management consulting|professional services|staffing|legal|law firm)\b/.test(text)) return 'Professional Services';
  if (/\b(nonprofit|foundation|charity|ngo|not-for-profit|philanthropic|humanitarian|advocacy)\b/.test(text)) return 'Nonprofit';
  return '';
}

const ALLOWED_TYPES = new Set(['.csv', '.txt', '.json', '.tsv']);

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
          industry: detectIndustry(r.title, r.description),
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

// POST /api/org/upload — upload an org data file (requires auth)
router.post('/upload', requireAuth, upload.single('file'), (req: Request, res: Response) => {
  const { userId } = (req as Request & { user: JwtPayload }).user;

  if (!req.file) {
    res.status(400).json({ error: 'No file provided.' });
    return;
  }

  const originalName = req.file.originalname;
  const ext = originalName.slice(originalName.lastIndexOf('.')).toLowerCase();

  if (!ALLOWED_TYPES.has(ext)) {
    res.status(400).json({ error: 'Only .csv, .txt, .json, and .tsv files are accepted.' });
    return;
  }

  const content = req.file.buffer.toString('utf-8').slice(0, 60000);
  const fileType = ext.slice(1); // strip leading dot
  const fileSize = req.file.size;

  const result = orgFileQueries.insert.run(userId, originalName, fileType, content, fileSize);
  const id = result.lastInsertRowid as number;

  res.status(201).json({ id, originalName, fileType, fileSize });
});

// GET /api/org/files — list files for the authenticated user
router.get('/files', requireAuth, (req: Request, res: Response) => {
  const { userId } = (req as Request & { user: JwtPayload }).user;
  const files = orgFileQueries.listByUser.all(userId);
  res.json(files);
});

// DELETE /api/org/files/:id — delete a file belonging to the authenticated user
router.delete('/files/:id', requireAuth, (req: Request, res: Response) => {
  const { userId } = (req as Request & { user: JwtPayload }).user;
  const fileId = parseInt(req.params.id, 10);

  if (isNaN(fileId)) {
    res.status(400).json({ error: 'Invalid file ID.' });
    return;
  }

  orgFileQueries.deleteById.run(fileId, userId);
  res.json({ success: true });
});

// POST /api/org/complete-setup — mark data setup as complete
router.post('/complete-setup', requireAuth, (req: Request, res: Response) => {
  const { userId } = (req as Request & { user: JwtPayload }).user;
  userQueries.markDataSetupComplete.run(userId);
  const user = userQueries.findById.get(userId);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  res.json({ user: safeUser(user) });
});

export default router;
