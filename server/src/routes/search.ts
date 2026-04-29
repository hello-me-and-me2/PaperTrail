import { Router, Request, Response } from 'express';
import {
  searchAwardsByKeyword,
  autocompleteRecipients,
} from '../services/usaSpending';
import { webSearch } from '../services/webSearch';
import { RecipientSummary, AgencySummary } from '../types';

const router = Router();

function parseTitle(title: string): string {
  return title
    .replace(/\s*[-|]\s*Wikipedia\s*$/, '')
    .replace(/\s*\|\s*Website\s*$/, '')
    .trim();
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

router.get('/', async (req: Request, res: Response) => {
  const query = (req.query.q as string || '').trim();
  if (!query || query.length < 2) {
    res.status(400).json({ error: 'Query must be at least 2 characters.' });
    return;
  }

  try {
    const [awardsResult, recipientsResult, webResult] = await Promise.allSettled([
      searchAwardsByKeyword(query, 1, 20),
      autocompleteRecipients(query),
      webSearch(query, 8),
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

    const rawWebResults = webResult.status === 'fulfilled' ? webResult.value : [];
    const webResults = rawWebResults.map((r) => ({
      name: parseTitle(r.title),
      industry: detectIndustry(r.title, r.description),
      description: (r.description || '').slice(0, 120),
      type: 'web' as const,
    }));

    res.json({
      query,
      recipients,
      agencies,
      contracts: awards.slice(0, 10),
      totalResults: awards.length + recipientAutocomplete.length,
      webResults,
    });
  } catch (err) {
    console.error('Search error:', err);
    res.status(502).json({ error: 'Failed to fetch data from USASpending.gov.' });
  }
});

export default router;
