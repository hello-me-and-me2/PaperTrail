import { Router, Request, Response } from 'express';
import {
  searchAwardsByKeyword,
  searchAwardsByRecipient,
  searchAwardsByAgency,
  getSpendingOverTime,
  getSoleSourceAwards,
} from '../services/usaSpending';
import { analyzeEntity } from '../services/analyzer';

const router = Router();

router.get('/recipient/:name', async (req: Request, res: Response) => {
  const name = decodeURIComponent(req.params.name);
  try {
    const [byRecipient, byKeyword, soleSource] = await Promise.allSettled([
      searchAwardsByRecipient(name, 1, 100),
      searchAwardsByKeyword(name, 1, 50),
      getSoleSourceAwards(name, 50),
    ]);

    const recipientAwards =
      byRecipient.status === 'fulfilled' ? byRecipient.value.results : [];
    const keywordAwards =
      byKeyword.status === 'fulfilled' ? byKeyword.value.results : [];
    const soleSourceAwards =
      soleSource.status === 'fulfilled' ? soleSource.value : [];

    const seenIds = new Set<string>();
    const allAwards = [...recipientAwards, ...keywordAwards, ...soleSourceAwards].filter(
      (a) => {
        if (seenIds.has(a['Award ID'])) return false;
        seenIds.add(a['Award ID']);
        return true;
      }
    );

    const spendingOverTime = await getSpendingOverTime({
      recipient_search_text: [name],
      award_type_codes: ['A', 'B', 'C', 'D', '02', '03', '04', '05'],
      time_period: [{ start_date: '2018-01-01', end_date: new Date().toISOString().split('T')[0] }],
    }).catch(() => []);

    const analysis = analyzeEntity(name, 'recipient', allAwards);

    res.json({ ...analysis, spendingOverTime });
  } catch (err) {
    console.error('Recipient analysis error:', err);
    res.status(502).json({ error: 'Failed to analyze recipient.' });
  }
});

router.get('/agency/:name', async (req: Request, res: Response) => {
  const name = decodeURIComponent(req.params.name);
  try {
    const [byAgency, byKeyword, soleSource] = await Promise.allSettled([
      searchAwardsByAgency(name, 1, 100),
      searchAwardsByKeyword(name, 1, 50),
      getSoleSourceAwards(name, 30),
    ]);

    const agencyAwards =
      byAgency.status === 'fulfilled' ? byAgency.value.results : [];
    const keywordAwards =
      byKeyword.status === 'fulfilled' ? byKeyword.value.results : [];
    const soleSourceAwards =
      soleSource.status === 'fulfilled' ? soleSource.value : [];

    const seenIds = new Set<string>();
    const allAwards = [...agencyAwards, ...keywordAwards, ...soleSourceAwards].filter(
      (a) => {
        if (seenIds.has(a['Award ID'])) return false;
        seenIds.add(a['Award ID']);
        return true;
      }
    );

    const spendingOverTime = await getSpendingOverTime({
      agencies: [{ type: 'awarding', tier: 'toptier', name }],
      award_type_codes: ['A', 'B', 'C', 'D'],
      time_period: [{ start_date: '2018-01-01', end_date: new Date().toISOString().split('T')[0] }],
    }).catch(() => []);

    const analysis = analyzeEntity(name, 'agency', allAwards);
    res.json({ ...analysis, spendingOverTime });
  } catch (err) {
    console.error('Agency analysis error:', err);
    res.status(502).json({ error: 'Failed to analyze agency.' });
  }
});

router.get('/person/:name', async (req: Request, res: Response) => {
  const name = decodeURIComponent(req.params.name);
  try {
    const [keywordResult, soleSource] = await Promise.allSettled([
      searchAwardsByKeyword(name, 1, 100),
      getSoleSourceAwards(name, 50),
    ]);

    const keywordAwards =
      keywordResult.status === 'fulfilled' ? keywordResult.value.results : [];
    const soleSourceAwards =
      soleSource.status === 'fulfilled' ? soleSource.value : [];

    const seenIds = new Set<string>();
    const allAwards = [...keywordAwards, ...soleSourceAwards].filter((a) => {
      if (seenIds.has(a['Award ID'])) return false;
      seenIds.add(a['Award ID']);
      return true;
    });

    const spendingOverTime = await getSpendingOverTime({
      keywords: [name],
      award_type_codes: ['A', 'B', 'C', 'D', '02', '03', '04', '05'],
      time_period: [{ start_date: '2018-01-01', end_date: new Date().toISOString().split('T')[0] }],
    }).catch(() => []);

    const analysis = analyzeEntity(name, 'person', allAwards);
    res.json({ ...analysis, spendingOverTime });
  } catch (err) {
    console.error('Person analysis error:', err);
    res.status(502).json({ error: 'Failed to analyze person/keyword.' });
  }
});

export default router;
