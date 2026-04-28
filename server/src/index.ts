import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import searchRouter from './routes/search';
import analysisRouter from './routes/analysis';
import investigateRouter from './routes/investigate';

const app = express();
const PORT = process.env.PORT || 3001;

// Allow all origins — Railway reverse-proxies behind the custom domain.
// In local dev the Vite proxy handles /api calls so CORS isn't needed there either.
app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please slow down.' },
});
app.use('/api', limiter);

app.use('/api/search', searchRouter);
app.use('/api/analysis', analysisRouter);
app.use('/api/investigate', investigateRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve the built React app whenever the dist folder exists.
// Works in both Railway (NODE_ENV=production) and any other deployment.
// __dirname = server/dist  →  ../../client/dist = repo root / client / dist
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');

if (fs.existsSync(clientDist)) {
  console.log(`Serving static files from ${clientDist}`);
  app.use(express.static(clientDist));
  // SPA fallback — all non-API routes return index.html
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  console.log('No client/dist found — running API-only (dev mode)');
}

app.listen(PORT, () => {
  console.log(`PaperTrail running on http://localhost:${PORT}`);
});

export default app;
