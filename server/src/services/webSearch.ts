import axios from 'axios';

export interface SearchResult {
  title: string;
  url: string;
  description: string;
  publishedDate?: string;
  source?: string;
}

function hostname(url: string): string {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
}

async function braveSearch(query: string, count: number): Promise<SearchResult[]> {
  const { data } = await axios.get('https://api.search.brave.com/res/v1/web/search', {
    headers: { 'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY!, Accept: 'application/json' },
    params: { q: query, count },
    timeout: 10000,
  });
  return (data.web?.results ?? []).map((r: Record<string, string>) => ({
    title: r.title, url: r.url, description: r.description,
    publishedDate: r.age, source: hostname(r.url),
  }));
}

async function serperSearch(query: string, count: number): Promise<SearchResult[]> {
  const { data } = await axios.post('https://google.serper.dev/search',
    { q: query, num: count },
    { headers: { 'X-API-KEY': process.env.SERPER_API_KEY! }, timeout: 10000 }
  );
  return (data.organic ?? []).map((r: Record<string, string>) => ({
    title: r.title, url: r.link, description: r.snippet,
    publishedDate: r.date, source: r.displayLink,
  }));
}

export async function webSearch(query: string, count = 8): Promise<SearchResult[]> {
  if (process.env.BRAVE_SEARCH_API_KEY) return braveSearch(query, count).catch(() => []);
  if (process.env.SERPER_API_KEY)       return serperSearch(query, count).catch(() => []);
  return [];
}

export function hasSearchProvider(): boolean {
  return !!(process.env.BRAVE_SEARCH_API_KEY || process.env.SERPER_API_KEY);
}
