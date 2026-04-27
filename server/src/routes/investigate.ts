import { Router, Request, Response } from 'express';
import { runInvestigation, InvestigationEntity } from '../services/investigator';

const router = Router();

router.post('/stream', async (req: Request, res: Response) => {
  const { entities } = req.body as { entities: InvestigationEntity[] };

  if (!Array.isArray(entities) || entities.length === 0) {
    res.status(400).json({ error: 'Provide at least one entity.' });
    return;
  }
  if (entities.length > 5) {
    res.status(400).json({ error: 'Maximum 5 primary entities.' });
    return;
  }

  const valid = entities.every(
    (e) => e.name && ['recipient', 'agency', 'person'].includes(e.type)
  );
  if (!valid) {
    res.status(400).json({ error: 'Each entity needs a name and type (recipient|agency|person).' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const controller = new AbortController();

  req.on('close', () => controller.abort());

  const send = (eventType: string, data: unknown) => {
    if (!res.writableEnded) {
      res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  };

  try {
    await runInvestigation(
      entities,
      (event) => send(event.type, event),
      controller.signal
    );
  } catch (err) {
    send('error', { message: 'Investigation failed unexpectedly.' });
  }

  if (!res.writableEnded) {
    res.write('event: done\ndata: {}\n\n');
    res.end();
  }
});

export default router;
