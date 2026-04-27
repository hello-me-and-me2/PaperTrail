import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import searchRouter from './routes/search';
import analysisRouter from './routes/analysis';
import investigateRouter from './routes/investigate';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'] }));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests, please slow down.' },
});
app.use(limiter);

app.use('/api/search', searchRouter);
app.use('/api/analysis', analysisRouter);
app.use('/api/investigate', investigateRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`PaperTrail server running on http://localhost:${PORT}`);
});

export default app;
