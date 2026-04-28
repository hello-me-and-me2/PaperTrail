import express from 'express';
import cors from 'cors';
import path from 'path';
import rateLimit from 'express-rate-limit';
import searchRouter from './routes/search';
import analysisRouter from './routes/analysis';
import investigateRouter from './routes/investigate';

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

// In production allow all origins (Railway reverse-proxies the domain).
// In dev allow local Vite dev server.
app.use(
  cors(
    isProd
      ? {}
      : { origin: ['http://localhost:5173', 'http://localhost:3000'] }
  )
);

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

// Serve the built React app in production.
// __dirname in compiled JS = server/dist — so client/dist is two levels up.
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');

if (isProd) {
  app.use(express.static(clientDist));
  // All non-API routes return the React app (SPA client-side routing).
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`PaperTrail server running on http://localhost:${PORT} [${isProd ? 'production' : 'development'}]`);
});

export default app;
