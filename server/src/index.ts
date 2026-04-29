import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import './db'; // initialise DB & seed admin on startup
import authRouter from './routes/auth';
import searchRouter from './routes/search';
import analysisRouter from './routes/analysis';
import investigateRouter from './routes/investigate';
import orgRouter from './routes/org';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Stricter limit on auth endpoints to slow brute-force attempts
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
app.use('/api/auth', authLimiter);

const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 100 });
app.use('/api', apiLimiter);

app.use('/api/auth', authRouter);
app.use('/api/search', searchRouter);
app.use('/api/analysis', analysisRouter);
app.use('/api/investigate', investigateRouter);
app.use('/api/org', orgRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  console.log(`[static] Serving ${clientDist}`);
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.listen(PORT, () => console.log(`PaperTrail running on http://localhost:${PORT}`));
export default app;
