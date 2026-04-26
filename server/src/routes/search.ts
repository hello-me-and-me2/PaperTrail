import { Router, Request, Response } from 'express';
import {
  searchAwardsByKeyword,
  autocompleteRecipients,
} from '../services/usaSpending';
import { RecipientSummary, AgencySummary } from '../types';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const query = (req.query.q as string || '').trim();
  if (!query || query.length < 2) {
    res.status(400).json({ error: 'Query must be at least 2 characters.' });
    return;
  }

  try {
    const [awardsResult, recipientsResult] = await Promise.allSettled([
      searchAwardsByKeyword(query, 1, 20),
      autocompleteRecipients(query),
    ]);

    const awards =
      awardsResult.status === 'fulfilled' ? awardsResult.value.results : [];

    const recipientAutocomplete =
      recipientsResult.status === 'fulfilled'
        ? recipientsResult.value.results
        : [];

    const recipientMap: Record<
      string,
      { count: number; amount: number; topAgency: string }
    > = {};
    const agencyMap: Record<
      string,
      { count: number; amount: number; topRecipient: string; topRecipientAmt: number }
    > = {};

    for (const award of awards) {
      const rName = award['Recipient Name'] || 'Unknown';
      const agency = award['Awarding Agency'] || 'Unknown';
      const amount = award['Award Amount'] || 0;

      if (!recipientMap[rName]) {
        recipientMap[rName] = { count: 0, amount: 0, topAgency: agency };
      }
      recipientMap[rName].count += 1;
      recipientMap[rName].amount += amount;

      if (!agencyMap[agency]) {
        agencyMap[agency] = { count: 0, amount: 0, topRecipient: rName, topRecipientAmt: amount };
      }
      agencyMap[agency].count += 1;
      agencyMap[agency].amount += amount;
      if (amount > agencyMap[agency].topRecipientAmt) {
        agencyMap[agency].topRecipient = rName;
        agencyMap[agency].topRecipientAmt = amount;
      }
    }

    const autoNames = new Set(
      recipientAutocomplete.map((r: { recipient_name: string }) => r.recipient_name)
    );
    for (const r of recipientAutocomplete) {
      if (!recipientMap[r.recipient_name]) {
        recipientMap[r.recipient_name] = { count: 0, amount: 0, topAgency: '' };
      }
    }

    const recipients: RecipientSummary[] = Object.entries(recipientMap)
      .sort((a, b) => b[1].amount - a[1].amount)
      .slice(0, 8)
      .map(([name, stats]) => ({
        id: encodeURIComponent(name),
        name,
        location: '',
        totalAmount: stats.amount,
        awardCount: stats.count,
        topAgency: stats.topAgency,
        fromAutocomplete: autoNames.has(name),
      }));

    const agencies: AgencySummary[] = Object.entries(agencyMap)
      .sort((a, b) => b[1].amount - a[1].amount)
      .slice(0, 5)
      .map(([name, stats]) => ({
        id: encodeURIComponent(name),
        name,
        totalAmount: stats.amount,
        awardCount: stats.count,
        topRecipient: stats.topRecipient,
      }));

    res.json({
      query,
      recipients,
      agencies,
      contracts: awards.slice(0, 10),
      totalResults: awards.length + recipientAutocomplete.length,
    });
  } catch (err) {
    console.error('Search error:', err);
    res.status(502).json({ error: 'Failed to fetch data from USASpending.gov.' });
  }
});

export default router;
